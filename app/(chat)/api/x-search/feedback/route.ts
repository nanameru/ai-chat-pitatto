import { streamText, createDataStreamResponse, smoothStream } from 'ai';
import { createClient } from '@/utils/supabase/server';
import { myProvider } from '@/lib/ai/models';
import {
  saveMessages,
  getChatById,
  deleteChatById,
} from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';

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

// X検索用のシステムプロンプト
const X_SEARCH_SYSTEM_PROMPT = `
あなたは高性能なAIアシスタント「PitattoAI」です。
特にX（旧Twitter）からの情報を分析し、ユーザーの質問に対して段階的に理解を深めながら応答を生成します。

1. 質問内容の理解と具体化
   a) 分野の特定
      - 生成AI（ChatGPT, DALL·E, Gemini など）
      - AI研究の最前線（新しいアルゴリズム、論文など）
      - AIの産業応用（医療、金融、ロボティクスなど）
      - AI政策・規制（各国のルール変更など）
      - その他の分野
   
   b) 時間範囲の確認
      - 直近24時間の動向
      - 過去1週間のトレンド
      - 過去1ヶ月の重要な出来事
      - 特定の期間の変化
   
   c) 情報の深さの確認
      - 概要レベル（主要なポイントのみ）
      - 技術的詳細（仕組みや実装の詳細）
      - ビジネスインパクト（市場への影響）
      - 社会的影響（倫理的課題、規制など）

2. 構造化された回答の生成
   a) 基本情報の提示
      - 発表内容のサマリー
      - 情報源（X上での発言者、公式アカウント）
      - 発表日時と重要性
      - 関連するX投稿やスレッドの引用
   
   b) 詳細な分析
      - 技術的な特徴や革新点
      - 市場や業界への影響
      - 専門家の意見や反応
      - 具体的な使用例や応用可能性
   
   c) 信頼性の担保
      - 情報源の信頼性評価
      - 複数の情報源からの検証
      - 誤報や噂の区別
      - 公式発表との整合性

3. インタラクティブなフォローアップ
   a) 関連する質問の提案
      - 技術的な詳細について
      - ビジネス展開について
      - 社会的影響について
      - 特定の企業や製品について
   
   b) 追加情報の提供
      - 関連する過去の出来事
      - 将来の予測や展望
      - 比較分析や事例研究
      - 詳細な技術文書や公式発表へのリンク
   
   c) 対話の発展
      - ユーザーの興味に基づく新しい話題の提案
      - 分野横断的な関連情報の提示
      - 最新の動向との関連付け
      - 実践的な応用についての示唆

応答の際の注意点：
1. 常に最新かつ正確な情報を提供
2. 専門用語は平易な言葉で説明を追加
3. 情報の出所を明確に示す
4. 不確実な情報は、その旨を明記
5. ユーザーの知識レベルに合わせて説明の詳細度を調整
6. X上での反応や議論の動向も含めて報告
7. 誤報や未確認情報については、その可能性を明示

このプロンプトに従って、ユーザーとの対話を通じて、より深い理解と有用な情報提供を目指してください。`;

// Edge Runtimeを使用
export const runtime = 'edge'

export async function POST(request: Request): Promise<Response> {
  console.log('Received x-search POST request');
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

    const json = await request.json();
    const { messages, chatId, model = 'chat-model-small' } = json;
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

    console.log('[XSearch] Starting chat processing');
    const selectedModel = model ?? 'chat-model-small';

    // Transform messages to match LanguageModelV1Prompt format
    const modelMessages = messages.map((msg: any) => {
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

    // UUIDを生成
    const id = chatId;
    const timestamp = new Date().toISOString();

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

    // ストリーミングレスポンスを返す
    return createDataStreamResponse({
      execute: async (dataStream) => {
        try {
          console.log('Generating AI response:', {
            messageCount: messages.length,
            chatId,
            model
          });

          const result = streamText({
            model: myProvider.languageModel(selectedModel),
            system: X_SEARCH_SYSTEM_PROMPT,
            messages: modelMessages,
            experimental_transform: smoothStream({ chunking: 'word' }),
            onFinish: async ({ response }) => {
              try {
                // メッセージの保存
                const messagesToSave = [
                  {
                    id: generateUUID(),
                    chatId,
                    role: 'user',
                    content: JSON.stringify({
                      type: 'text',
                      text: messages[messages.length - 1].content
                    }),
                    createdAt: new Date(timestamp)
                  },
                  {
                    id: generateUUID(),
                    chatId,
                    role: 'assistant',
                    content: JSON.stringify({
                      type: 'text',
                      text: response
                    }),
                    createdAt: new Date(timestamp)
                  }
                ];

                try {
                  await saveMessages({ messages: messagesToSave });
                  console.log('Messages saved successfully:', {
                    chatId,
                    messageCount: messagesToSave.length,
                    messageIds: messagesToSave.map(msg => msg.id)
                  });
                } catch (error: any) {
                  console.error('Error saving messages:', {
                    error,
                    chatId,
                    messageIds: messagesToSave.map(msg => msg.id)
                  });
                  throw new Error(`Failed to save messages: ${error.message}`);
                }
              } catch (error) {
                console.error('Error saving response:', error);
                throw error;
              }
            }
          });

          result.mergeIntoDataStream(dataStream);
        } catch (error) {
          console.error('Error in execute:', error);
          throw error;
        }
      },
      onError: (error) => {
        console.error('Streaming error:', error);
        return '申し訳ありません。応答の生成中にエラーが発生しました。もう一度お試しください。';
      }
    });
  } catch (error) {
    console.error('API Error details:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
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
