import type { NextRequest, } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { saveMessages } from '@/lib/db/queries';
import { randomUUID } from 'node:crypto';
import { type CoreMessage, createDataStreamResponse, smoothStream, streamText } from 'ai';
import { myProvider } from '@/lib/ai/models';
import { createDocument } from '@/lib/ai/tools/create-document';
import { mastra } from '@/lib/mastra';

const MESSAGE_SIZE_LIMIT = 1024 * 1024; // 1MB
const CHUNK_SIZE = 16 * 1024; // 16KB

const InputSchema = z.object({
  query: z.string(),
  chatId: z.string().uuid(),
  clarificationResponse: z.string().optional(),
  model: z.string().optional(),
});

interface MessageContent {
  type: 'text';
  text: string;
}

type MessageContentType = string | MessageContent;

function normalizeMessageContent(content: MessageContentType): MessageContent {
  if (typeof content === 'string') {
    return {
      type: 'text',
      text: content
    };
  }
  return content;
}

export const runtime = 'edge'

export async function POST(request: NextRequest): Promise<Response> {
  console.log('[API Deep Research] Received POST request');
  const requestStartTime = Date.now();
  
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      console.error('[API Deep Research] Unauthorized: No valid user found', authError);
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
      console.log('[API Deep Research] Full request payload:', {
        rawJson: JSON.stringify(json, null, 2),
      });
      
      const { query, clarificationResponse, chatId, model } = json;
      console.log('[API Deep Research] Parsed request data:', {
        query,
        clarificationResponse,
        chatId,
        model
      });

      const userId = user.id;

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
          console.error('[API Deep Research] Failed to create user:', createUserError);
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

      try {
        const { data: existingChat, error: getChatError } = await supabase
          .from('Chat')
          .select('*')
          .eq('id', chatId)
          .maybeSingle();

        if (getChatError && getChatError.code !== 'PGRST116') {
          console.error('[API Deep Research] Failed to get existing chat:', getChatError);
          throw new Error(`Failed to get existing chat: ${getChatError.message}`);
        }

        const timestamp = new Date().toISOString();
        const chatTitle = query.substring(0, 100) || 'New Deep Research Chat';

        if (!existingChat) {
          console.log('[API Deep Research] Creating new chat:', { chatId, title: chatTitle, userId });
          const { error: insertError } = await supabase
            .from('Chat')
            .insert([
              {
                id: chatId,
                title: chatTitle,
                userId,
                createdAt: timestamp
              }
            ]);

          if (insertError) {
            console.error('[API Deep Research] Failed to create chat:', insertError);
            throw new Error(`Failed to create chat: ${insertError.message}`);
          }
        } else {
          console.log('[API Deep Research] Updating existing chat:', chatId);
          const { error: updateError } = await supabase
            .from('Chat')
            .update({ updatedAt: timestamp })
            .eq('id', chatId);

          if (updateError) {
            console.error('[API Deep Research] Failed to update chat:', updateError);
            throw new Error(`Failed to update chat: ${updateError.message}`);
          }
        }

        const userMessage = {
          id: randomUUID(),
          chatId,
          role: 'user',
          content: clarificationResponse ? `${query}\n\nClarification: ${clarificationResponse}` : query,
          createdAt: new Date().toISOString()
        };

        const deepResearchPrompt = `あなたは詳細な調査と分析を行うDeep Research Assistantです。
ユーザーの質問に対して、包括的で詳細な回答を提供してください。
情報源を引用し、論理的に構造化された回答を作成してください。
以下の点に注意して回答を作成してください：

1. 質問の背景と文脈を理解し、適切な範囲で回答する
2. 関連する事実や情報を包括的に収集し、整理する
3. 情報の信頼性と正確性を確保する
4. 複数の視点や意見を考慮し、バランスの取れた分析を提供する
5. 明確で論理的な構造で情報を提示する
6. 専門用語がある場合は適切に説明する
7. 結論や推奨事項を明確に示す

回答は常に事実に基づき、客観的であるべきです。不確かな情報には適切に注釈をつけてください。`;

        const selectedModel = model ?? 'chat-model-large';

        console.log('[API Deep Research] Using Mastra agent with normal chat behavior');
        
        // 通常チャットモードと同様のストリーミングレスポンスを返す
        return createDataStreamResponse({
          execute: async (dataStream) => {
            try {
              // createDocumentツールを設定（通常チャットモードと同様）
              const documentTool = createDocument({
                session: { user: { id: user.id } } as any,
                dataStream
              });
              
              // 通常チャットモードと同様のストリーミング実装
              const result = streamText({
                model: myProvider.languageModel(selectedModel),
                system: deepResearchPrompt,
                messages: [
                  {
                    role: 'user' as const,
                    content: [{ type: 'text' as const, text: userMessage.content }],
                  }
                ],
                tools: {
                  createDocument: documentTool
                },
                experimental_transform: smoothStream({ chunking: 'word' }),
                onFinish: async ({ response }) => {
                  if (user?.id) {
                    try {
                      // 通常チャットモードと同様のメッセージ保存処理
                      const responseText = response.messages?.[response.messages.length - 1]?.content || '';
                      
                      // Mastra エージェントを使用して応答を強化
                      const agent = mastra.getAgent('deepResearchAgent');
                      console.log('[API Deep Research] Processing with Mastra agent');
                      const agentResult = await agent.generate(userMessage.content);
                      
                      console.log('[API Deep Research] Mastra agent result:', {
                        hasToolCalls: !!agentResult.toolCalls?.length,
                        resultLength: agentResult.text?.length || 0
                      });
                      
                      // 明確化が必要かどうかをチェック
                      const needsClarification = agentResult.toolCalls?.some((tc: any) => 
                        tc.toolName === 'queryClarifier' || 
                        (tc.type === 'tool-call' && tc.toolName === 'queryClarifier')
                      );
                      
                      // 最終的な応答テキスト（明確化が必要な場合はエージェントの結果を使用）
                      const finalResponseText = needsClarification 
                        ? (agentResult.text || '質問の詳細を教えていただけますか？')
                        : responseText;
                      
                      // アシスタントメッセージを作成
                      const assistantMessage = {
                        id: randomUUID(),
                        chatId,
                        role: 'assistant',
                        content: {
                          type: 'text',
                          text: finalResponseText
                        },
                        createdAt: new Date().toISOString()
                      };
  
                      // ユーザーメッセージとアシスタントメッセージを保存
                      const messagesToSave = [userMessage, assistantMessage];
                      
                      await saveMessages({ 
                        messages: messagesToSave.map(msg => ({
                          id: msg.id,
                          chatId: msg.chatId,
                          role: msg.role,
                          content: typeof msg.content === 'object' ? JSON.stringify(msg.content) : msg.content,
                          createdAt: msg.createdAt
                        }))
                      });
                      
                      console.log('[API Deep Research] Messages saved:', {
                        count: messagesToSave.length,
                        chatId,
                        timestamp: new Date().toISOString()
                      });
                    } catch (error) {
                      console.error('[API Deep Research] Error in onFinish callback:', error);
                    }
                  }
                },
              });
  
              result.mergeIntoDataStream(dataStream);
            } catch (error) {
              console.error('[API Deep Research] Error in execute callback:', error);
              throw error;
            }
          },
          onError: () => {
            return 'メッセージの送信に失敗しました。もう一度お試しください。';
          },
        });
      } catch (error) {
        console.error('[API Deep Research] API error:', {
          error,
          errorType: error instanceof Error ? 'Error' : typeof error,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          context: {
            chatId,
            timestamp: new Date().toISOString()
          }
        });

        const errorResponse = {
          error: 'Failed to process Deep Research request',
          errorType: error instanceof Error ? 'Error' : typeof error,
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error instanceof Error ? error.stack : JSON.stringify(error),
          context: {
            chatId,
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
      console.error('[API Deep Research] API Error details:', {
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
    console.error('[API Deep Research] API Error details:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'An unknown error occurred'
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
