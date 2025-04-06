import { streamText, createDataStreamResponse, smoothStream, experimental_generateImage as generateImage } from 'ai';
import { createClient } from '@/utils/supabase/server';
import { myProvider } from '@/lib/ai/models';
import { regularPrompt, artifactsPrompt } from '@/lib/ai/prompts';
import { createDocument } from '@/lib/ai/tools/create-document';
import {
  saveMessages,
  getChatById,
  deleteChatById,
} from '@/lib/db/queries';
import type { Message as DBMessage } from '@/lib/db/schema';

// 定数の定義
const MESSAGE_SIZE_LIMIT = 1024 * 1024; // 1MB
const CHUNK_SIZE = 16 * 1024; // 16KB

// メッセージの型定義
interface MessageContent {
  type: 'text';
  text: string;
}

type MessageContentType = string | MessageContent;

// メッセージの正規化関数
function normalizeMessageContent(content: MessageContentType): MessageContent {
  if (typeof content === 'string') {
    return {
      type: 'text',
      text: content
    };
  }
  return content;
}

// Edge Runtimeを使用
export const runtime = 'edge'

export async function POST(request: Request): Promise<Response> {
  console.log('Received chat POST request');
  const requestStartTime = Date.now();
  
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      console.error('Unauthorized: No valid user found', authError);
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized', 
          details: 'Please sign in to continue.'
        }),
        {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Bearer',
            'X-Error': 'true',
            'X-Error-Type': 'Unauthorized'
          }
        }
      );
    }

    try {
      const json = await request.json();
      console.log('[Debug] Full request payload:', {
        rawJson: JSON.stringify(json, null, 2),
        chatRequestOptions: json.chatRequestOptions,
        xSearchEnabled: json.chatRequestOptions?.xSearchEnabled,
        model: json.model
      });
      
      const { messages, chatId, model, chatRequestOptions } = json;
      console.log('Parsed request data:', {
        messagesCount: messages?.length,
        chatId,
        model,
        chatRequestOptions,
        command: chatRequestOptions?.data?.command,
        isImageGeneration: chatRequestOptions?.data?.command === 'generate-image'
      });

      // chatRequestOptionsが存在することを確認
      if (!chatRequestOptions) {
        console.warn('No chatRequestOptions provided');
      }

      const { xSearchEnabled = false } = chatRequestOptions || {};
      
      console.log('[Chat] Request options:', { 
        xSearchEnabled,
        model,
        userId: user.id,
        chatRequestOptions
      });

      const userId = user.id;

      // chatIdが必須であることを確認
      if (!chatId) {
        return new Response(
          JSON.stringify({
            error: 'Invalid input',
            details: 'Chat ID is required'
          }),
          {
            status: 400,
            headers: {
              'X-Error': 'true',
              'X-Error-Type': 'InvalidInput'
            }
          }
        );
      }

      // ユーザーが存在しない場合は作成
      const { data: existingUser, error: getUserError } = await supabase
        .from('User')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (!existingUser) {
        const { error: createUserError } = await supabase
          .from('User')
          .insert([
            { 
              id: userId,
              email: user.email || 'no-email'
            }
          ]);

        if (createUserError) {
          console.error('Failed to create user:', createUserError);
          return new Response(
            JSON.stringify({ 
              error: 'User creation failed', 
              details: 'Failed to create user record' 
            }),
            { 
              status: 500,
              headers: {
                'X-Error': 'true',
                'X-Error-Type': 'UserCreationFailed'
              }
            }
          );
        }
      }

      // 入力検証
      if (!messages || !Array.isArray(messages)) {
        return new Response(
          JSON.stringify({
            error: 'Invalid input',
            details: 'Messages must be an array'
          }),
          { 
            status: 400,
            headers: {
              'X-Error': 'true',
              'X-Error-Type': 'InvalidInput'
            }
          }
        );
      }

      // メッセージサイズの制限をチェック
      const messageSize = JSON.stringify(messages).length;
      if (messageSize > MESSAGE_SIZE_LIMIT) {
        return new Response(
          JSON.stringify({ 
            error: 'Message size limit exceeded', 
            details: `Message size (${messageSize} bytes) exceeds limit (${MESSAGE_SIZE_LIMIT} bytes)`
          }),
          { 
            status: 413,
            headers: {
              'X-Error': 'true',
              'X-Error-Type': 'MessageSizeLimitExceeded'
            }
          }
        );
      }

      try {
        // タイトルの生成を改善
        let chatTitle = 'New Chat';
        const typedMessages: any[] = messages;
        console.log('Processing messages for chat title');
        if (typedMessages[0]) {
          if (typeof typedMessages[0].content === 'string') {
            chatTitle = typedMessages[0].content.substring(0, 100) || 'New Chat';
          } else if (Array.isArray(typedMessages[0].content)) {
            const textContent = (typedMessages[0].content as Array<string | { text: string }>)
              .map((item: string | { text: string }) => {
                if (typeof item === 'string') return item;
                if (typeof item === 'object' && item && 'text' in item) return item.text;
                return ''; // Default case
              })
              .join(' ')
              .trim();
            chatTitle = textContent.substring(0, 100) || 'New Chat';
          }
        }

        // 画像生成コマンドの処理
        console.log('[Chat] リクエストタイプ確認:', chatRequestOptions?.data);
        
        if (chatRequestOptions?.data?.command === 'generate-image') {
          console.log('[Chat] Starting image generation processing');
          console.log('[Chat] リクエストデータ:', chatRequestOptions.data);
          
          const imagePrompt = chatRequestOptions.data.prompt;
          const selectedModelId = chatRequestOptions.data.selectedModelId || '';
          const imageModel = chatRequestOptions.data.model || 'grok-image-model';
          const forceImageGeneration = chatRequestOptions.data.forceImageGeneration === true;
          const useDirectImageGeneration = chatRequestOptions.data.useDirectImageGeneration === true;
          
          console.log('[Chat] 画像プロンプト:', imagePrompt);
          console.log('[Chat] 選択されたモデル:', selectedModelId);
          console.log('[Chat] 画像モデル:', imageModel);
          console.log('[Chat] 強制画像生成モード:', forceImageGeneration);
          console.log('[Chat] 直接画像生成モード:', useDirectImageGeneration);
          
          // 選択されたモデルがGrokモデルであるか確認
          const isGrokModel = selectedModelId === 'grok-vision-model' || selectedModelId === 'grok-model';
          
          if (!imagePrompt) {
            return new Response(
              JSON.stringify({
                error: 'Invalid input',
                details: 'Image prompt is required'
              }),
              {
                status: 400,
                headers: {
                  'X-Error': 'true',
                  'X-Error-Type': 'InvalidInput'
                }
              }
            );
          }
          
          // 強制画像生成モードが有効でない場合は、Grokモデルであるか確認
          if (!forceImageGeneration && !isGrokModel) {
            console.error('[画像] 選択されたモデルは画像生成をサポートしていません:', selectedModelId);
            return new Response(
              JSON.stringify({
                error: '画像生成に失敗しました',
                details: '選択されたモデルは画像生成をサポートしていません'
              }),
              {
                status: 400,
                headers: {
                  'X-Error': 'true',
                  'X-Error-Type': 'UnsupportedModel'
                }
              }
            );
          }
          
          // 強制画像生成モードが有効な場合は、モデルに関わらず画像生成を実行
          console.log('[画像] 画像生成を実行します');
          
          try {
            console.log('[Image] Generating image with prompt:', imagePrompt);
            
            // 画像生成を試みる
            console.log('[画像] 画像生成を開始');
            
            let imageResponse;
            let usedModel = '';
            
            try {
              console.log('[画像] 画像生成リクエストを実行します:', imageModel);
              
              // 選択されたモデルに基づいて使用するモデルを決定
              let modelToUse;
              
              if (imageModel === 'grok-image-model' && isGrokModel) {
                // Grokモデルを使用する場合
                modelToUse = myProvider.imageModel('grok-image-model');
                usedModel = 'grok';
              } else {
                // それ以外の場合はDALL-E 3を使用
                modelToUse = myProvider.imageModel('large-model');
                usedModel = 'dall-e-3';
              }
              
              console.log('[画像] 使用するモデル:', usedModel);
              
              // モデルの詳細情報をログに出力
              console.log('[画像] 使用するモデルの詳細情報:', {
                modelName: modelToUse,
                modelType: typeof modelToUse,
                isGrokModel: usedModel === 'grok'
              });
              
              // generateImage関数を使用して画像を生成
              const generateImageParams = {
                model: modelToUse as any,
                prompt: imagePrompt,
                size: usedModel === 'grok' ? undefined : "1024x1024" as `${number}x${number}`,
                providerOptions: {}
              };
              
              console.log('[画像] generateImageのパラメータ:', generateImageParams);
              
              const result = await generateImage(generateImageParams);
              
              // 画像データを取得
              console.log('[画像] 画像生成成功:', result);
              
              // 画像データをレスポンス形式に変換
              // 画像データが正しく取得できたか確認
              if (result && result.image && result.image.base64) {
                console.log('[画像] 画像データが正常に取得できました');
                imageResponse = { images: [result.image.base64] };
              } else {
                console.error('[画像] 画像データの形式が不正です:', result);
                throw new Error('画像データの形式が不正です');
              }
              
            } catch (error) {
              console.error('[画像] 画像生成に失敗しました:', error);
              
              // DALL-E 3で再試行
              try {
                console.log('[画像] DALL-E 3で画像生成を再試行します');
                
                console.log('[画像] DALL-E 3での再試行パラメータを設定します');
                
                const dallEParams = {
                  model: myProvider.imageModel('large-model') as any,
                  prompt: imagePrompt,
                  size: "1024x1024" as `${number}x${number}`,
                  providerOptions: {}
                };
                
                console.log('[画像] DALL-E 3パラメータ:', dallEParams);
                
                const result = await generateImage(dallEParams);
                
                usedModel = 'dall-e-3';
                console.log('[画像] DALL-E 3で画像生成成功:', result);
                
                // 画像データをレスポンス形式に変換
                // 画像データが正しく取得できたか確認
                if (result && result.image && result.image.base64) {
                  console.log('[画像] DALL-E 3の画像データが正常に取得できました');
                  imageResponse = { images: [result.image.base64] };
                } else {
                  console.error('[画像] DALL-E 3の画像データの形式が不正です:', result);
                  throw new Error('DALL-E 3の画像データの形式が不正です');
                }
                
              } catch (fallbackError) {
                console.error('[画像] DALL-E 3での再試行にも失敗しました:', fallbackError);
                throw fallbackError;
              }
            }
            
            console.log('[画像] 画像生成レスポンス:', imageResponse, '使用モデル:', usedModel);
            
            // base64画像データを取得
            const imageBase64 = imageResponse.images[0];
            console.log('[Image] Generated image data available (base64)');
            
            // ドキュメントIDを生成
            const documentId = crypto.randomUUID();
            const currentTime = new Date();
            
            // ドキュメントオブジェクトを作成
            // データベーススキーマに合わせて型を指定
            const document = {
              id: documentId,
              title: `Generated Image: ${imagePrompt.substring(0, 30)}${imagePrompt.length > 30 ? '...' : ''}`,
              kind: 'image' as 'text' | 'code' | 'image' | 'sheet', // データベーススキーマに合わせた型
              content: imageBase64,
              createdAt: currentTime,
              userId: userId
            };
            
            // ユーザーメッセージとアシスタントメッセージを作成
            const userMessage = {
              id: crypto.randomUUID(),
              chatId,
              role: 'user',
              content: `/image ${imagePrompt}`,
              createdAt: new Date().toISOString()
            };
            
            const assistantMessage = {
              id: crypto.randomUUID(),
              chatId,
              role: 'assistant',
              content: `I've generated an image based on your prompt: "${imagePrompt}"

Image generated using ${usedModel === 'grok' ? 'Grok Vision' : 'DALL-E 3'}`,
              createdAt: new Date().toISOString(),
              toolInvocations: [
                {
                  toolName: 'createDocument',
                  toolCallId: crypto.randomUUID(),
                  state: 'result',
                  args: {
                    title: document.title,
                    kind: 'image'
                  },
                  result: document
                }
              ]
            };
            
            await saveMessages({ messages: [userMessage, assistantMessage] });
            
            // ★★★ デバッグログ追加: DB保存直前のデータ確認 ★★★
            const dataToSave = {
              id: assistantMessage.id,
              chat_id: chatId,
              user_id: userId,
              role: assistantMessage.role, // ← この値を確認！
              content: JSON.stringify(assistantMessage.content),
              created_at: assistantMessage.createdAt.toISOString(),
              updated_at: new Date().toISOString(),
            };
            console.log('[API Chat][onCompletion] Saving assistant message data:', dataToSave);
            // ★★★ ここまで ★★★

            // ★ 直接 Supabase insert を使用
            const { error: assistantMsgError } = await supabase.from('Message').insert(dataToSave);

            if (assistantMsgError) {
              console.error('Failed to save assistant message:', assistantMsgError);
              throw new Error(`Failed to save assistant message: ${assistantMsgError.message}`);
            }

            // レスポンスを返す
            return new Response(
              JSON.stringify({
                id: assistantMessage.id,
                role: 'assistant',
                content: assistantMessage.content,
                createdAt: assistantMessage.createdAt,
                toolInvocations: assistantMessage.toolInvocations
              }),
              {
                status: 200,
                headers: {
                  'Content-Type': 'application/json'
                }
              }
            );
          } catch (error) {
            console.error('[Image] Error generating image:', error);
            return new Response(
              JSON.stringify({
                error: 'Image generation failed',
                details: error instanceof Error ? error.message : String(error)
              }),
              {
                status: 500,
                headers: {
                  'X-Error': 'true',
                  'X-Error-Type': 'ImageGenerationFailed'
                }
              }
            );
          }
          // 画像生成コマンドの場合はここで処理終了
          // エラーが発生した場合のフォールバックレスポンス
          return new Response(
            JSON.stringify({
              error: 'Unexpected error in image generation process',
              details: 'The image generation process completed but did not return a proper response'
            }),
            {
              status: 500,
              headers: {
                'Content-Type': 'application/json',
                'X-Error': 'true',
                'X-Error-Type': 'ImageGenerationError'
              }
            }
          );
        }
        
        // 画像生成コマンドでない場合は通常のチャット処理を実行
        console.log('[Chat] Starting normal chat processing');
        const selectedModel = model ?? 'chat-model-small';
        const useArtifacts = selectedModel !== 'chat-model-reasoning';

        // プロンプトの使用状況をログ出力
        console.log('[Chat] Using prompt:', {
          type: 'REGULAR_CHAT_PROMPT',
          systemPrompt: useArtifacts 
            ? `${regularPrompt}\n\n${artifactsPrompt}`
            : regularPrompt
        });

        // 通常モード用のプロンプトを設定
        const aiMessages: any[] = [
          {
            id: crypto.randomUUID(),
            role: 'system' as const,
            content: useArtifacts 
              ? `${regularPrompt}\n\n${artifactsPrompt}`
              : regularPrompt,
          },
          ...typedMessages
        ];

        // Transform messages to match LanguageModelV1Prompt format
        const modelMessages = aiMessages.map((msg: any) => {
          const baseContent = typeof msg.content === 'string' 
            ? msg.content.substring(0, 1000)
            : Array.isArray(msg.content)
              ? (msg.content as (string | { text: string })[]).map(item => 
                  typeof item === 'string' 
                    ? item.substring(0, 1000) 
                    : item
                )
              : msg.content;

          if (msg.role === 'system') {
            return {
              role: 'system' as const,
              content: baseContent as string,
            };
          } else if (msg.role === 'user') {
            return {
              role: 'user' as const,
              content: [{ type: 'text' as const, text: baseContent as string }],
            };
          } else if (msg.role === 'assistant') {
            return {
              role: 'assistant' as const,
              content: [{ type: 'text' as const, text: baseContent as string }],
            };
          }
          
          throw new Error(`Unsupported role: ${msg.role}`);
        });

        // Generate completion
        const completion = await myProvider.languageModel(selectedModel).doGenerate({
          inputFormat: "messages",
          mode: {
            type: "regular"
          },
          prompt: modelMessages
        });

        // プロンプト情報をログに出力
        console.log('Using prompt:', {
          type: 'REGULAR_CHAT_PROMPT',
          systemPrompt: useArtifacts 
            ? `${regularPrompt}\n\n${artifactsPrompt}`
            : regularPrompt,
          modelMessages
        });

        // UUIDを生成
        const id = chatId;
        const timestamp = new Date().toISOString();

        try {
          // チャットの保存/更新
          const { data: existingChat, error: getChatError } = await supabase
            .from('Chat')
            .select('*')
            .eq('id', id)
            .maybeSingle();

          if (getChatError && getChatError.code !== 'PGRST116') {
            console.error('Failed to get existing chat:', getChatError);
            throw new Error(`Failed to get existing chat: ${getChatError.message}`);
          }

          if (!existingChat) {
            console.log('Creating new chat:', { id, title: chatTitle, userId });
            const { error: insertError } = await supabase
              .from('Chat')
              .insert([
                {
                  id,
                  title: chatTitle || 'New Chat',
                  userId,
                  createdAt: timestamp
                }
              ]);

            if (insertError) {
              console.error('Failed to create chat:', insertError);
              throw new Error(`Failed to create chat: ${insertError.message}`);
            }
          } else {
            console.log('Updating existing chat:', id);
            const { error: updateError } = await supabase
              .from('Chat')
              .update({ updatedAt: timestamp })
              .eq('id', id);

            if (updateError) {
              console.error('Failed to update chat:', updateError);
              throw new Error(`Failed to update chat: ${updateError.message}`);
            }
          }

          // メッセージの保存
          console.log('Preparing messages to save:', {
            messageCount: typedMessages.length,
            firstMessageId: typedMessages[0]?.id,
            lastMessageId: typedMessages[typedMessages.length - 1]?.id,
            chatId: id,
            timestamp: new Date().toISOString()
          });
          
          // メッセージサイズの検証
          const messagesSize = JSON.stringify(typedMessages).length;
          console.log('Messages validation:', {
            size: messagesSize,
            sizeKB: `${(messagesSize / 1024).toFixed(2)} KB`,
            limit: '1MB',
            isOverLimit: messagesSize > 1024 * 1024
          });

          if (messagesSize > 1024 * 1024) { // 1MB制限
            throw new Error(`Message size (${messagesSize} bytes) exceeds limit (1MB)`);
          }

          // completionの内容を文字列に変換
          const messageText = completion.text || JSON.stringify({
            text: completion.text,
            reasoning: completion.reasoning,
            finishReason: completion.finishReason
          });

          // メッセージを作成
          const messagesToSave: DBMessage[] = [
            // ユーザーのメッセージ
            {
              id: crypto.randomUUID(),
              chatId: id,
              role: 'user',
              content: {
                type: 'text',
                text: messages[messages.length - 1].content
              },
              createdAt: new Date(timestamp)
            },
            // アシスタントのメッセージ
            {
              id: crypto.randomUUID(),
              chatId: id,
              role: 'assistant',
              content: {
                type: 'text',
                text: messageText
              },
              createdAt: new Date(timestamp)
            }
          ];

          // メッセージをデータベースに保存
          try {
            await saveMessages({ 
              messages: messagesToSave.map(msg => ({
                id: msg.id,
                chatId: msg.chatId,
                role: msg.role,
                content: typeof msg.content === 'object' ? JSON.stringify(msg.content) : msg.content,
                createdAt: msg.createdAt
              }))
            });
            console.log('Messages saved:', {
              count: messagesToSave.length,
              chatId: id,
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            console.error('Failed to save messages:', error);
            throw error;
          }

          // ストリーミングレスポンスを返す
          return createDataStreamResponse({
            execute: (dataStream) => {
              // createDocumentツールを設定
              const documentTool = createDocument({
                session: { user: { id: user.id } } as any,
                dataStream
              });
              
              const result = streamText({
                model: myProvider.languageModel(selectedModel),
                system: regularPrompt,
                messages: modelMessages,
                tools: {
                  createDocument: documentTool
                },
                experimental_transform: smoothStream({ chunking: 'word' }),
                onFinish: async ({ response }) => {
                  if (user?.id) {
                    try {
                      console.log('Chat completion finished', {
                        chatId: id,
                        timestamp: new Date().toISOString(),
                        usedPrompt: {
                          type: 'REGULAR_CHAT_PROMPT',
                          systemPrompt: useArtifacts 
                            ? `${regularPrompt}\n\n${artifactsPrompt}`
                            : regularPrompt
                        }
                      });
                    } catch (error) {
                      console.error('Error in onFinish callback:', error);
                    }
                  }
                },
              });

              result.mergeIntoDataStream(dataStream);
            },
            onError: () => {
              return 'メッセージの送信に失敗しました。もう一度お試しください。';
            },
          });
        } catch (error) {
          console.error('API error:', {
            error,
            errorType: error instanceof Error ? 'Error' : typeof error,
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            context: {
              chatId: id,
              messageCount: typedMessages?.length || 0,
              requestId: request.headers.get('x-request-id'),
              timestamp: new Date().toISOString()
            },
            request: {
              method: request.method,
              headers: Object.fromEntries(request.headers.entries()),
              url: request.url
            }
          });

          const errorResponse = {
            error: 'Failed to process chat request',
            errorType: error instanceof Error ? 'Error' : typeof error,
            message: error instanceof Error ? error.message : 'Unknown error occurred',
            details: error instanceof Error ? error.stack : JSON.stringify(error),
            context: {
              chatId: id,
              messageCount: typedMessages?.length || 0,
              timestamp: new Date().toISOString()
            }
          };

          return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: {
              'X-Error': 'true',
              'X-Error-Type': error instanceof Error ? error.name : 'Unknown',
              'X-Error-Message': error instanceof Error ? error.message : 'Unknown error'
            }
          });
        }
      } catch (error) {
        console.error('API Error details:', {
          error,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          type: error instanceof Error ? error.constructor.name : typeof error
        });

        return new Response(
          JSON.stringify({
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : 'An unknown error occurred',
            type: error instanceof Error ? error.constructor.name : typeof error,
            stack: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.stack : undefined : undefined
          }),
          { 
            status: 500,
            headers: { 
              'X-Error': 'true',
              'X-Error-Type': error instanceof Error ? error.constructor.name : 'Unknown'
            }
          }
        );
      }
    } catch (error) {
      console.error('API Error details:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        type: error instanceof Error ? error.constructor.name : typeof error
      });

      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          details: error instanceof Error ? error.message : 'An unknown error occurred',
          type: error instanceof Error ? error.constructor.name : typeof error,
          stack: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.stack : undefined : undefined
        }),
        { 
          status: 500,
          headers: { 
            'X-Error': 'true',
            'X-Error-Type': error instanceof Error ? error.constructor.name : 'Unknown'
          }
        }
      );
    }
  } catch (error) {
    console.error('API Error details:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'An unknown error occurred',
        type: error instanceof Error ? error.constructor.name : typeof error,
        stack: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.stack : undefined : undefined
      }),
      { 
        status: 500,
        headers: { 
          'X-Error': 'true',
          'X-Error-Type': error instanceof Error ? error.constructor.name : 'Unknown'
        }
      }
    );
  }
}

export async function DELETE(
  req: Request
): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return new Response('Not Found', { status: 404 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const chat = await getChatById({ id });

    if (!chat || chat.userId !== user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });
    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    console.error('Failed to process DELETE request:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
