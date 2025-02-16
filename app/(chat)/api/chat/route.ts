import { streamText, createDataStreamResponse, smoothStream } from 'ai';
import { createClient } from '@/utils/supabase/server';
import { myProvider } from '@/lib/ai/models';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  saveChat,
  saveMessages,
  getMessagesByChatId,
  deleteMessagesByChatIdAfterTimestamp,
  getChatById,
  deleteChatById,
} from '@/lib/db/queries';
import { Message as DBMessage } from '@/lib/db/schema';

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
      console.log('Request payload:', JSON.stringify(json, null, 2));
      
      const { messages, chatId, model }: { messages: any[], chatId: string, model: string } = json;
      console.log('Parsed request data:', {
        messagesCount: messages?.length,
        chatId,
        model
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
        .single();

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

        const selectedModel = model ?? 'chat-model-small';

        // Prepare all messages with system prompt
        const aiMessages: any[] = [
          {
            id: crypto.randomUUID(),
            role: 'system' as const,
            content: systemPrompt({ selectedChatModel: selectedModel }),
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
            sizeKB: (messagesSize / 1024).toFixed(2) + ' KB',
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
              const result = streamText({
                model: myProvider.languageModel(selectedModel),
                system: systemPrompt({ selectedChatModel: selectedModel }),
                messages: modelMessages,
                experimental_transform: smoothStream({ chunking: 'word' }),
                onFinish: async ({ response }) => {
                  if (user?.id) {
                    try {
                      console.log('Chat completion finished', {
                        chatId: id,
                        timestamp: new Date().toISOString()
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
