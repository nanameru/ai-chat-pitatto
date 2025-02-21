import type { ChatRequestOptions, CreateMessage, Message } from 'ai';
import { generateXSearchSubqueries, type SubqueryGenerationResult } from './feedback';
import { nanoid } from 'nanoid';
import { myProvider } from '@/lib/ai/models';
import { streamText, createDataStreamResponse, smoothStream } from 'ai';
import type { Response } from '@/lib/types';

export interface XSearchState {
  stage: 'subquery_generation' | 'search_execution';
  subqueries?: SubqueryGenerationResult;
  previousQueries?: string[];
}

export interface XSearchOptions extends ChatRequestOptions {
  isXSearch: boolean;
  xSearchState?: XSearchState;
  userId?: string;
  id?: string;
}

export interface XSearchResponse {
  role: 'assistant';
  content: string;
  id: string;
  createdAt?: Date;
  xSearchState?: XSearchState;
}

const X_SEARCH_SYSTEM_PROMPT = `
あなたは「GPT-4レベルのAI」であり、「PitattoAI」のX検索アシスタントです。
ユーザーの入力から、X(Twitter)検索に適したサブクエリを生成する必要があるかどうかを判断し、適切な応答を返してください。

【判断基準】
1. ユーザーの入力が「X検索に適している」場合：
   - 具体的な情報収集が必要な質問
   - 最新のトレンドや動向に関する質問
   - 特定のトピックに関する実際の意見や反応を知りたい質問
   → サブクエリ生成を提案する

2. ユーザーの入力が「X検索に適していない」場合：
   - 一般的な質問や相談
   - 技術的な説明を求める質問
   - 個人的なアドバイスを求める質問
   → 通常の回答を生成する

【応答形式】
- X検索が適している場合：
  "X検索を実行することで、より具体的な情報が得られそうです。サブクエリを生成してX検索を実行しますか？"

- X検索が適していない場合：
  通常の回答を生成する
`;

export async function handleXSearch(
  message: Message | CreateMessage,
  options: XSearchOptions,
): Promise<Response> {
  try {
    console.log('handleXSearch called with:', { message, options });
    const { xSearchState } = options;

    if (!xSearchState) {
      throw new Error('X search state is required');
    }

    // サブクエリ生成ステージの場合
    if (xSearchState.stage === 'subquery_generation') {
      // myProviderを使用して、X検索が適切かどうかを判断
      const completion = await myProvider.languageModel('chat-model-small').doGenerate({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: [
          {
            role: 'system',
            content: X_SEARCH_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [{ type: 'text', text: message.content }],
          }
        ]
      });

      const responseText = completion.text || '';
      const id = nanoid();
      const timestamp = new Date();
      
      // レスポンスにX検索の提案が含まれているかチェック
      if (responseText.includes('サブクエリを生成してX検索を実行しますか？')) {
        // X検索を提案する場合
        const response: XSearchResponse = {
          role: 'assistant',
          content: responseText,
          id,
          createdAt: timestamp,
          xSearchState: {
            stage: 'search_execution',
          },
        };

        // ストリーミングレスポンスを作成
        return createDataStreamResponse({
          execute: async (writer) => {
            try {
              const { fullStream } = await streamText({
                model: myProvider.languageModel('chat-model-small'),
                messages: [
                  {
                    role: 'assistant',
                    content: JSON.stringify(response),
                  },
                ],
                experimental_transform: smoothStream({ chunking: 'word' }),
              });

              for await (const delta of fullStream) {
                if (delta.type === 'text-delta') {
                  await writer.writeData({
                    type: 'text-delta',
                    content: delta.textDelta
                  });
                }
              }
            } catch (error) {
              console.error('Error in stream processing:', error);
              throw error;
            }
          },
          onError: (error) => {
            console.error('Streaming error:', error);
            return 'ストリーミング中にエラーが発生しました。';
          },
        });

      } else {
        // 通常の回答を返す場合
        const response: XSearchResponse = {
          role: 'assistant',
          content: responseText,
          id,
          createdAt: timestamp,
        };

        // ストリーミングレスポンスを作成
        return createDataStreamResponse({
          execute: async (writer) => {
            try {
              const { fullStream } = await streamText({
                model: myProvider.languageModel('chat-model-small'),
                messages: [
                  {
                    role: 'assistant',
                    content: JSON.stringify(response),
                  },
                ],
                experimental_transform: smoothStream({ chunking: 'word' }),
              });

              for await (const delta of fullStream) {
                if (delta.type === 'text-delta') {
                  await writer.writeData({
                    type: 'text-delta',
                    content: delta.textDelta
                  });
                }
              }
            } catch (error) {
              console.error('Error in stream processing:', error);
              throw error;
            }
          },
          onError: (error) => {
            console.error('Streaming error:', error);
            return 'ストリーミング中にエラーが発生しました。';
          },
        });
      }
    }

    // 検索実行ステージの場合
    if (xSearchState.stage === 'search_execution') {
      console.log('Generating subqueries for:', message.content);
      const result = await generateXSearchSubqueries(message.content, options);
      console.log('Generated subqueries:', result);

      if (!result || !result.queries || result.queries.length === 0) {
        throw new Error('No subqueries were generated');
      }

      const subqueriesText = result.queries.map((q, i) => `${i + 1}. ${q.query}`).join('\n');
      const id = nanoid();
      const timestamp = new Date();
      
      const response: XSearchResponse = {
        role: 'assistant',
        content: `以下のサブクエリを生成しました。これらを使用してX検索を実行しますか？\n\n${subqueriesText}\n\n「はい」または「実行してください」と入力すると、これらのクエリで検索を開始します。`,
        id,
        createdAt: timestamp,
        xSearchState: {
          stage: 'search_execution',
          subqueries: result,
        },
      };

      // ストリーミングレスポンスを作成
      return createDataStreamResponse({
        execute: async (writer) => {
          try {
            const { fullStream } = await streamText({
              model: myProvider.languageModel('chat-model-small'),
              messages: [
                {
                  role: 'assistant',
                  content: JSON.stringify(response),
                },
              ],
              experimental_transform: smoothStream({ chunking: 'word' }),
            });

            for await (const delta of fullStream) {
              if (delta.type === 'text-delta') {
                await writer.writeData({
                  type: 'text-delta',
                  content: delta.textDelta
                });
              }
            }
          } catch (error) {
            console.error('Error in stream processing:', error);
            throw error;
          }
        },
        onError: (error) => {
          console.error('Streaming error:', error);
          return 'ストリーミング中にエラーが発生しました。';
        },
      });
    }

    throw new Error('Invalid X search stage');
  } catch (error) {
    console.error('Error in handleXSearch:', error);
    const errorResponse: XSearchResponse = {
      role: 'assistant',
      content: 'サブクエリの生成中にエラーが発生しました。もう一度試してみてください。',
      id: nanoid(),
      createdAt: new Date(),
      xSearchState: options.xSearchState || { stage: 'subquery_generation' },
    };

    // エラーの場合もストリーミングレスポンスを作成
    return createDataStreamResponse({
      execute: async (writer) => {
        try {
          const { fullStream } = await streamText({
            model: myProvider.languageModel('chat-model-small'),
            messages: [
              {
                role: 'assistant',
                content: JSON.stringify(errorResponse),
              },
            ],
            experimental_transform: smoothStream({ chunking: 'word' }),
          });

          for await (const delta of fullStream) {
            if (delta.type === 'text-delta') {
              await writer.writeData({
                type: 'text-delta',
                content: delta.textDelta
              });
            }
          }
        } catch (error) {
          console.error('Error in stream processing:', error);
          throw error;
        }
      },
      onError: (error) => {
        console.error('Streaming error:', error);
        return 'ストリーミング中にエラーが発生しました。';
      },
    });
  }
}
