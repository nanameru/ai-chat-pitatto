// 環境変数を.envファイルから読み込む（既存の環境変数を上書き）
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
// // ★★★ @mastra 関連はコメントアウトしたまま ★★★
// /*
// // import { ... } from '@/lib/mastra/...';
// // import { getJson } from 'serpapi';
// */
// ★ DB関連の import を戻す
import { createClient } from '@/utils/supabase/server';
import { saveMessages } from '@/lib/db/queries';
import type { Message as DBMessage } from '@/lib/db/schema';
import { randomUUID } from 'crypto'; // ★ crypto.randomUUID を戻す
// import { type CoreMessage, StreamData, createDataStreamResponse, smoothStream, streamText } from 'ai'; // ★ streamText を使用するように変更
import {
  type CoreMessage,
  createDataStreamResponse,
  DataStreamWriter, // ★ 再度インポート
  StreamData,
  // streamText // 不要
} from 'ai';
// // ★★★ @mastra 関連のインポートを再修正 ★★★
// import {
//   Mastra,                // Mastra クラスはこれで合っているはず
//   // 型は一旦 @mastra/core から直接インポートせず、
//   // 使用箇所で Mastra の型定義から推論させるか、必要なら後で特定する
//   // type ActionObservation,
//   // type AgentResponse,
//   // type ActionOptions
// } from '@mastra/core';
// import { deepResearchAgentV2 } from '@/lib/mastra/agents/deep-research-v2';
import { mastra } from '@/lib/mastra'; // ★ lib/mastra/index.ts から mastra インスタンスをインポート

// OpenAI APIキーが設定されているか確認
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('💥 環境変数OPENAI_API_KEYが設定されていません！APIリクエストは失敗します');
} else {
  console.log('✅ OPENAI_API_KEY is set:', OPENAI_API_KEY.substring(0, 10) + '...');
}

// // 以下の不要なインポートを削除
// // import { SupabaseClient } from '@supabase/supabase-js';
// import { type Message as VercelChatMessage } from 'ai'; // ★ VercelChatMessage は streamText で内部的に使われるため残す
// // import { StreamingTextResponse } from 'ai/dist/edge'; // ★ streamText の結果を toAIStreamResponse で返すため不要

// // import { saveMessages } from '@/utils/supabase/chat-actions'; // ★ 重複のためコメントアウト

// // ★ 型定義のコメントアウト解除 ★★★ -> 不要な型定義は削除
// type ResearchPlan = { /* ... */ }; // -> 不要
// // ... 他の型定義 ...
// const InputSchema = z.object({ // ★ 入力スキーマはリクエストボディの形式に合わせて変更
//   query: z.string(),
//   chatId: z.string().uuid(),
//   clarificationResponse: z.string().optional(),
// });
// // ★★★ ここまで解除 ★★★ -> 変更
const RequestBodySchema = z.object({
  messages: z.array(z.any()), // Vercel AI SDK の CoreMessage 型に合わせる
  chatId: z.string().uuid(),
  model: z.string().optional(), // モデル指定を受け付けるようにする
  // clarificationResponse は messages に含める想定
});

// export const runtime = 'edge'; // ★ Edge Runtime指定を削除

// Agent の generate メソッドの戻り値の型 (より具体的に)
type AgentResult = {
  text?: string; // 最終的なテキスト応答
  steps?: Array<{ // ステップ情報
    stepType?: string;
    toolCalls?: Array<{ // ツール呼び出し情報
      name?: string;
      input?: any;
      result?: any; // ツールの実行結果
    }>;
    text?: string; // ステップごとのテキスト (最終応答と同じ場合あり)
  }>;
  error?: any; // エラー情報
  reasoningSteps?: Array<{
    id: string;
    timestamp: string;
    type: string;
    title: string;
    content: string;
    metadata?: any;
  }>; // ToT思考ステップ情報
  // 他にもプロパティがある可能性
};

// 思考ステップタイプをツール名からマッピングする関数
function getTypeFromToolName(toolName: string): string {
  const toolTypeMap: Record<string, string> = {
    'thoughtGenerator': 'thought_generation',
    'thoughtEvaluator': 'thinking',
    'pathSelector': 'thinking',
    'researchPlanGenerator': 'planning',
    'queryOptimizer': 'planning',
    'searchTool': 'research',
    'informationEvaluator': 'analysis',
    'hypothesisGenerator': 'hypothesis',
    'gapAnalyzer': 'gap',
    'insightGenerator': 'insight',
    'storyBuilder': 'integration',
    'conclusionFormer': 'analysis',
    'reportGenerator': 'report',
    'reportOptimizer': 'report'
  };
  return toolTypeMap[toolName] || 'thinking';
}

// ツール名から適切なタイトルを生成する関数
function getTitleFromToolName(toolName: string): string {
  const toolTitleMap: Record<string, string> = {
    'thoughtGenerator': '思考生成',
    'thoughtEvaluator': '思考評価',
    'pathSelector': '思考パス選択',
    'researchPlanGenerator': 'リサーチ計画生成',
    'queryOptimizer': 'クエリ最適化',
    'searchTool': '情報検索',
    'informationEvaluator': '情報評価',
    'hypothesisGenerator': '仮説生成',
    'gapAnalyzer': '情報ギャップ分析',
    'insightGenerator': '洞察生成',
    'storyBuilder': 'ストーリー構築',
    'conclusionFormer': '結論形成',
    'reportGenerator': 'レポート生成',
    'reportOptimizer': 'レポート最適化'
  };
  return toolTitleMap[toolName] || toolName;
}

// 思考ステップをツール結果から作成する関数
function createReasoningStep(toolName: string, toolResult: any) {
  // 結果からコンテンツを抽出
  let content = '';
  try {
    if (typeof toolResult === 'object') {
      // ツールごとに異なる結果構造から適切なコンテンツを抽出
      if (toolName === 'thoughtGenerator' && toolResult.thoughts) {
        content = toolResult.thoughts.map((t: any) => t.content || '').join('\n\n');
      } else if (toolName === 'thoughtEvaluator' && toolResult.evaluatedThoughts) {
        content = toolResult.evaluatedThoughts.map((t: any, i: number) => 
          `思考${i+1}: ${t.content || '(内容なし)'}\n` +
          `評価: ${t.score ? Math.round(t.score * 10) / 10 : '?'}/10点\n` +
          `理由: ${t.reasoning ? t.reasoning.split('\n')[0] : '理由なし'}`
        ).join('\n\n');
      } else if (toolName === 'pathSelector' && toolResult.selectedPath) {
        content = `選択パス: ${toolResult.selectedPath.id || ''}\n理由: ${toolResult.reason || ''}`;
      } else if (toolName === 'researchPlanGenerator' && toolResult.researchPlan) {
        content = JSON.stringify(toolResult.researchPlan, null, 2);
      } else if (toolName === 'queryOptimizer' && toolResult.optimizedQueries) {
        content = toolResult.optimizedQueries.map((q: any) => 
          `クエリ: ${q.query}\n目的: ${q.purpose}`).join('\n\n');
      } else if (toolName === 'searchTool' && toolResult.results) {
        content = toolResult.results.map((r: any) => 
          `${r.title || 'タイトルなし'}\n${r.url || ''}\n${r.snippet || ''}`).join('\n\n');
      } else if (toolName === 'informationEvaluator' && toolResult.evaluatedSources) {
        content = `評価ソース数: ${toolResult.evaluatedSources.length || 0}\n` +
                 `高信頼性: ${toolResult.informationEvaluation?.highReliabilitySources?.length || 0}件\n` +
                 `中信頼性: ${toolResult.informationEvaluation?.mediumReliabilitySources?.length || 0}件\n` +
                 `低信頼性: ${toolResult.informationEvaluation?.lowReliabilitySources?.length || 0}件`;
      } else if (toolName === 'hypothesisGenerator' && toolResult.hypotheses) {
        content = toolResult.hypotheses.map((h: any, i: number) => 
          `仮説${i+1}: ${h.statement} (信頼度: ${Math.round((h.confidenceScore || 0) * 100)}%)`
        ).join('\n\n');
      } else if (toolName === 'gapAnalyzer' && toolResult.informationAnalysis) {
        content = `検出されたギャップ: ${toolResult.informationAnalysis?.informationGaps?.length || 0}件\n` +
                 (toolResult.informationAnalysis?.informationGaps || []).map((g: any) => 
                   `${g.importance === 'high' ? '🔴' : '🟠'} ${g.area}`
                 ).join('\n\n');
      } else if (toolName === 'insightGenerator' && toolResult.insights) {
        content = toolResult.insights.map((ins: any, i: number) => 
          `洞察${i+1}: ${ins.insight} (重要度: ${ins.importance || '中'})`
        ).join('\n\n');
      } else if (toolName === 'reportGenerator' && toolResult.finalReport) {
        content = (toolResult.finalReport || 'レポート内容なし').substring(0, 500) + 
                 ((toolResult.finalReport?.length || 0) > 500 ? '...' : '');
      } else {
        // 標準的なJSON文字列化
        content = JSON.stringify(toolResult, null, 2);
      }
    } else if (typeof toolResult === 'string') {
      content = toolResult;
    } else {
      content = String(toolResult || '');
    }
  } catch (error) {
    console.error(`[ToT] 結果処理エラー (${toolName}):`, error);
    content = `結果の処理中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`;
  }

  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    type: getTypeFromToolName(toolName || ''),
    title: getTitleFromToolName(toolName || ''),
    content: content,
    metadata: {
      phase: 'research',
      currentStep: 1, 
      totalSteps: 5,
      toolName: toolName || ''
    }
  };
}

export async function POST(req: NextRequest) {
  console.log('[API Deep Research] Received POST request (Node.js Runtime).'); // ログ変更
  try {
    // ★★★ createClient と getUser の呼び出しを戻す ★★★
    // デバッグログ: 環境変数の確認 (念のため残す)
    console.log('[API Deep Research DEBUG] Checking env vars before createClient:');
    console.log(`  NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
    console.log(`  NEXT_PUBLIC_SUPABASE_ANON_KEY exists: ${!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`);
    console.log(`  SUPABASE_SERVICE_ROLE_KEY exists: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`); 

    // Supabaseクライアントとユーザー情報を取得
    console.log('[API Deep Research] Calling createClient()...');
    const supabase = await createClient();
    console.log('[API Deep Research] createClient() successful.');
    
    console.log('[API Deep Research] Calling supabase.auth.getUser()...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('[API Deep Research] supabase.auth.getUser() finished.');

    if (authError || !user?.id) {
      // ★ Node.js Runtime なので NextResponse.json を使ってもOK ★
      // return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = user.id; // userId は取得しておく
    // ★★★ ここまで戻す ★★★

    // ★★★ テスト用DB読み取り処理のコメントアウトを解除 ★★★ -> 削除 (本番コードには不要)
    // ...

    // ★★★ テスト用DB読み取り処理のコメントアウトを解除 ★★★
    let testChatData: any;
    try {
      console.log(`[API Deep Research DEBUG] Attempting simple DB read for chatId: ${userId}`);
      const { data, error: testChatReadError } = await supabase
        .from('Chat') 
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      testChatData = data; // 成功データを保持

      if (testChatReadError) {
        console.error('[API Deep Research ERROR] Simple DB read failed:', testChatReadError);
        throw testChatReadError; // エラーとして処理を止める
            } else {
        console.log('[API Deep Research DEBUG] Simple DB read successful. Chat data:', testChatData);
      }
    } catch (testError) {
        console.error('[API Deep Research ERROR] Exception during simple DB read test:', testError);
        return NextResponse.json({ error: 'データベース接続テスト中にエラーが発生しました' }, { status: 500 });
    }
    // ★★★ ここまで戻す ★★★

    // ★ req.json() と入力チェックは実行 -> Vercel AI SDK の形式に合わせる
    // const { query, clarificationResponse, chatId } = await req.json();
    let requestBody: any;
    let parseResult: z.SafeParseReturnType<any, any>;
    try {
      requestBody = await req.json();
      // ★ デバッグログ追加: 生のリクエストボディを出力 ★
      console.log('[API Deep Research DEBUG] Received raw request body:', JSON.stringify(requestBody, null, 2));
      parseResult = RequestBodySchema.safeParse(requestBody);
    } catch (error) {
      console.error('[API Deep Research] Error parsing request JSON:', error);
      return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
    }

    if (!parseResult.success) {
      // ★ NextResponse.json を使用 ★
      // return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
      console.error('[API Deep Research] Invalid request body:', parseResult.error.flatten()); // ★ エラー詳細ログ追加
      return NextResponse.json({ error: 'Invalid request body', details: parseResult.error.flatten() }, { status: 400 });
    }

    const { messages, chatId, model } = parseResult.data;
    const coreMessages = messages as CoreMessage[];
    console.log('[API Deep Research] Parsed request body:', { messagesCount: coreMessages.length, chatId, model });

    // ★ ユーザーメッセージを特定して保存用に保持 ★
    const userMessageContent = coreMessages.find(m => m.role === 'user')?.content;
    const userMessageToSaveInitially: Omit<DBMessage, 'userId'> | null =
      userMessageContent !== undefined ? {
        id: randomUUID(),
        chatId: chatId,
        role: 'user',
        content: typeof userMessageContent === 'string' ? userMessageContent : JSON.stringify(userMessageContent),
        createdAt: new Date(),
      } : null;
    // ★ ここまで追加 ★

    // ... (入力チェックコード) ... -> スキーマ検証でカバー

    // ★★★ Chat レコード存在確認 & 必要なら作成 (maybeSingle を使用) ★★★
    try {
      console.log(`[API Deep Research] Checking if chat exists using maybeSingle: ${chatId}`);
      // maybeSingle() を使ってチャットを取得 (見つからなくてもエラーにならない)
      const { data: existingChat, error: getChatError } = await supabase
        .from('Chat')
        .select('id') // 必要なカラムのみ取得 (idだけで十分)
        .eq('id', chatId)
        // .eq('userId', userId) // 必要であればユーザーIDでの絞り込みも追加
        .maybeSingle();

      // getChatError が発生し、かつそれが「見つからない」以外のエラーの場合
      if (getChatError && getChatError.code !== 'PGRST116') {
        console.error(`[API Deep Research] Error checking for chat ${chatId}:`, getChatError);
        throw getChatError; // エラーを再スローして上位のcatchで処理
      }

      // existingChat が null (または undefined) ならチャットが存在しない
      if (!existingChat) {
        console.log(`[API Deep Research] Chat ${chatId} not found. Creating new chat...`);
        const firstUserMessageContent = coreMessages.find(m => m.role === 'user')?.content;
        const chatTitle = typeof firstUserMessageContent === 'string'
          ? firstUserMessageContent.substring(0, 100)
          : 'Deep Research Chat';

        // supabase.from('Chat').insert() を直接使用してチャットを作成
        const { error: insertError } = await supabase
          .from('Chat')
          .insert({
            id: chatId,
            userId,
            title: chatTitle,
            createdAt: new Date().toISOString(), // createdAt を設定
            updatedAt: new Date().toISOString(), // updatedAt も設定 (任意)
            // 他に必要なフィールドがあればここに追加 (例: visibility)
          });

        if (insertError) {
          console.error(`[API Deep Research] Failed to create chat ${chatId}:`, insertError);
          throw insertError; // エラーを再スロー
        }
        console.log(`[API Deep Research] Created new chat: ${chatId}`);
      } else {
        console.log(`[API Deep Research] Chat ${chatId} found.`);
        // 必要であれば既存チャットの更新処理などをここに追加
        // 例: updated_at を更新
        // const { error: updateError } = await supabase
        //   .from('Chat')
        //   .update({ updatedAt: new Date().toISOString() })
        //   .eq('id', chatId);
        // if (updateError) {
        //   console.warn(`[API Deep Research] Failed to update chat ${chatId}:`, updateError);
        // }
      }
    } catch (dbError) {
      // ここで getChatError や insertError をキャッチ
      console.error('[API Deep Research] Error during chat check/creation process:', dbError);
      return NextResponse.json({ error: 'Failed to ensure chat session exists' }, { status: 500 });
    }
    // ★★★ ここまで修正 ★★★

    // 以降の処理 (Chatが存在する場合のみ実行される)

    // ユーザーメッセージをDBに保存する準備 -> onCompletion に移動
    // const userMessageObject: Omit<DBMessage, 'userId'> = { ... };
    // console.log('[API Deep Research DEBUG] User message object prepared:', userMessageObject);
    // try {
    //     await saveMessages({ messages: [userMessageObject] });
    //     console.log('[API Deep Research DEBUG] User message supposedly saved successfully.');
    // } catch (error) { ... }

    // ★ Deep Research 関連処理 ★★★ -> streamText に置き換え
    // console.log('[API] Deep Research Agent実行開始:', { query, chatId, userId });
    // // ★ new Mastra({}) の行を削除 ★
    // const options: any = { ... };
    // try {
    //     // ★ エージェントを取得 (インポートした mastra インスタンスから)
    //     const agent = mastra.getAgent('deepResearchAgent');
    //     // ★ generate の引数を修正 ★
    //     const messagesForAgent: CoreMessage[] = [ ... ];
    //     // Deep Researchエージェントの実行
    //     const agentResult = await agent.generate(messagesForAgent, options);
    //     console.log('[API] Deep Research Agent実行完了:', agentResult);
    //     // ★ 修正: agentResult の内容に基づいて明確化が必要か判断
    //     const needsClarification = ...;
    //     const clarificationMessage = ...;
    //     // ★ StreamData を初期化
    //     const data = new StreamData();
    //     // ★ 修正: ストリーミングレスポンスを正しく返す
    //     if (needsClarification) { ... } else { ... }
    // } catch (error) {
    //   console.error('[API Deep Research] Error executing agent:', error);
    //   return new Response(JSON.stringify({ error: 'Failed to execute deep research agent' }), { status: 500 });
    // }

    // ★ Vercel AI SDK のストリーミングレスポンスに変更 ★
    const streamData = new StreamData();

    // ★ streamText を使用して応答を生成 ★
    const result = createDataStreamResponse({
      execute: async (dataStreamWriter: DataStreamWriter) => {
        let fullCompletionText = '';
        let agentError: Error | null = null;
        let needsClarification = false; // 明確化が必要かのフラグ
        const agentRunStartTime = Date.now();
        
        // 収集された思考ステップを保存する配列
        const collectedReasoningSteps: Array<any> = [];

        try {
          console.log('[API Deep Research] Getting ToT Research agent...');
          const agent = mastra.getAgent('totResearchAgent');
          if (!agent) {
            throw new Error('ToT Research Agent not found.');
          }

          console.log('[API Deep Research] Generating response with agent...');
          console.log('[API Deep Research DEBUG] Calling agent.generate with messages:', coreMessages);
          
          // オリジナルのツール関数を保持するオブジェクト
          const originalToolFunctions: Record<string, Function> = {};
          
          // エージェントのツールをラップして思考ステップをストリーミングできるようにする
          if (agent.tools) {
            Object.entries(agent.tools).forEach(([toolName, tool]) => {
              if (tool && typeof tool.execute === 'function') {
                // オリジナルの実行関数を保存
                originalToolFunctions[toolName] = tool.execute;
                
                // 実行関数をオーバーライド
                tool.execute = async (context: any) => {
                  console.log(`[ToT] ${getTitleFromToolName(toolName)} 実行開始`);
                  
                  try {
                    // オリジナルの関数を呼び出し
                    const result = await originalToolFunctions[toolName](context);
                    
                    // 思考ステップを作成
                    const reasoningStep = createReasoningStep(toolName, result);
                    
                    // 思考ステップを収集
                    collectedReasoningSteps.push(reasoningStep);
                    
                    // 各ステップを確実にストリーミングする
                    try {
                      // まず安全にデータをJSONに変換できるか確認（デバッグ）
                      const testJson = JSON.stringify({ type: 'tot_reasoning', reasoningStep });
                      console.log(`[ToT] ステップJSON作成成功 (${testJson.length} バイト)`);
                      
                      // 思考ステップをアノテーションとして送信
                      dataStreamWriter.writeMessageAnnotation({
                        type: 'tot_reasoning',
                        reasoningStep
                      });

                      // さらにデータとしても送信（冗長だが確実に受信させるため）
                      dataStreamWriter.writeMessageAnnotation({
                        type: 'reasoning_step',
                        step: reasoningStep
                      });

                      // 成功を記録
                      console.log(`[ToT] 思考ステップをストリーミング完了: ${toolName}`);
                    } catch (streamError) {
                      console.error(`[ToT] 思考ステップのストリーミングエラー (${toolName}):`, streamError);
                    }
                    
                    console.log(`[ToT] ${getTitleFromToolName(toolName)} 完了`);
                    return result;
                  } catch (toolError) {
                    console.error(`[ToT] ツール実行エラー (${toolName}):`, toolError);
                    
                    // エラーが発生した場合でもステップとして記録
                    try {
                      const errorReasoningStep = {
                        id: randomUUID(),
                        timestamp: new Date().toISOString(),
                        type: getTypeFromToolName(toolName || ''),
                        title: `エラー: ${getTitleFromToolName(toolName || '')}`,
                        content: `ツール実行中にエラーが発生しました: ${toolError instanceof Error ? toolError.message : String(toolError)}`,
                        metadata: {
                          error: true,
                          toolName: toolName || ''
                        }
                      };
                      
                      collectedReasoningSteps.push(errorReasoningStep);
                      
                      // エラーステップもストリーミング
                      dataStreamWriter.writeMessageAnnotation({
                        type: 'tot_reasoning',
                        reasoningStep: errorReasoningStep
                      });
                      
                      console.log(`[ToT] エラーステップをストリーミング: ${toolName}`);
                    } catch (annotationError) {
                      console.error(`[ToT] エラーステップのストリーミングに失敗:`, annotationError);
                    }
                    
                    throw toolError;
                  }
                };
              }
            });
          }
          
          // エージェント実行
          const agentResult = await agent.generate(
            coreMessages
          ) as AgentResult;
          
          // ツールの実行関数を元に戻す
          if (agent.tools) {
            Object.entries(agent.tools).forEach(([toolName, tool]) => {
              if (tool && originalToolFunctions[toolName]) {
                // 型互換性エラーを解決するために型アサーションを追加
                tool.execute = originalToolFunctions[toolName] as any;
              }
            });
          }

          const agentRunEndTime = Date.now();
          console.log(`[API Deep Research] Agent finished in ${agentRunEndTime - agentRunStartTime}ms.`);
          console.log('[API Deep Research DEBUG] Agent Result structure keys:', Object.keys(agentResult));
          console.log('[API Deep Research DEBUG] Agent Result has reasoningSteps:', !!agentResult.reasoningSteps);
          console.log('[API Deep Research DEBUG] Agent Result has steps:', !!agentResult.steps);
          if (agentResult.steps) {
            console.log('[API Deep Research DEBUG] Steps count:', agentResult.steps.length);
            if (agentResult.steps.length > 0) {
              console.log('[API Deep Research DEBUG] First step sample:', JSON.stringify(agentResult.steps[0], null, 2));
            }
          }

          // 収集された思考ステップがあれば、agentResultに設定
          if (collectedReasoningSteps.length > 0 && !agentResult.reasoningSteps) {
            console.log('[API Deep Research DEBUG] Setting collected reasoning steps:', collectedReasoningSteps.length);
            agentResult.reasoningSteps = collectedReasoningSteps;
          }

          // 明確化が必要かチェック
          console.log('[API Deep Research DEBUG] Checking for clarification...');
          if (agentResult.steps && Array.isArray(agentResult.steps)) {
            const clarificationStep = agentResult.steps.find(step =>
              step.toolCalls?.some(tc => tc.name === 'queryClarifier')
            );
            if (clarificationStep && clarificationStep.toolCalls) {
              const clarifierResult = clarificationStep.toolCalls.find(tc => tc.name === 'queryClarifier')?.result;
              if (clarifierResult?.needsClarification === true) {
                needsClarification = true;
                console.log('[API Deep Research DEBUG] Clarification needed.');
              }
            }
          } else {
            console.log('[API Deep Research DEBUG] No steps found or invalid format for clarification check.');
          }

          // 最終的なテキストを取得
          fullCompletionText = agentResult.text || '';
          console.log('[API Deep Research DEBUG] Final text:', fullCompletionText ? fullCompletionText.substring(0, 100) + '...' : '(empty)');

          // ステップ情報などを data としてストリームに追加
          if (agentResult.steps) {
            dataStreamWriter.writeMessageAnnotation({ type: 'agent_steps', steps: agentResult.steps });
            console.log('[API Deep Research DEBUG] Appended steps to stream data.');
          }

          // ToTの推論ステップがあれば追加
          if (agentResult.reasoningSteps) {
            console.log('[API Deep Research DEBUG] Found ToT reasoning steps:', agentResult.reasoningSteps.length);
            dataStreamWriter.writeMessageAnnotation({ 
              type: 'reasoning_steps', 
              reasoningSteps: agentResult.reasoningSteps 
            });
            console.log('[API Deep Research DEBUG] Appended ToT reasoning steps to stream data.');
            
            // 最初のステップの内容を確認
            if (agentResult.reasoningSteps.length > 0) {
              console.log('[API Deep Research DEBUG] First reasoning step sample:', 
                JSON.stringify(agentResult.reasoningSteps[0], null, 2));
            }
          }

          // テキストをストリームに書き込む
          if (fullCompletionText && !needsClarification) {
            // プレーンな write を試す (SDK の仕様による)
            // Vercel SDK の text stream は '0:"<json_escaped_string>"\n' の形式
            dataStreamWriter.write(`0:"${JSON.stringify(fullCompletionText).slice(1, -1)}"\n`);
            console.log('[API Deep Research DEBUG] Wrote final text to stream via write.');
          } else if (needsClarification) {
            console.log('[API Deep Research DEBUG] Clarification needed, skipping final text write.');
          } else {
             console.log('[API Deep Research DEBUG] No final text to write.');
          }

          // ToTの思考ステップが存在する場合、最終的なまとめとして再度送信
          const finalReasoningSteps = agentResult.reasoningSteps || collectedReasoningSteps;
          if (finalReasoningSteps && finalReasoningSteps.length > 0) {
            try {
              // reasoningStepsをアノテーションとしてだけでなく、データとしても送信
              dataStreamWriter.writeMessageAnnotation({
                type: 'reasoning_data',
                reasoningSteps: finalReasoningSteps
              });
              console.log('[API Deep Research DEBUG] Appended reasoning_data to stream');
              
              // reasoningStepsをストリームに書き込み（最終的なメタデータとして）
              dataStreamWriter.writeMessageAnnotation({
                type: 'tot_reasoning_complete',
                reasoningSteps: finalReasoningSteps
              });
              console.log('[API Deep Research DEBUG] Wrote final reasoning steps annotation:', finalReasoningSteps.length, 'steps');
            } catch (annotationError) {
              console.error('[API Deep Research] Error writing final reasoning steps annotation:', annotationError);
            }
          } else {
            console.log('[API Deep Research DEBUG] No final reasoning steps found to write');
          }

          // 明確化が必要な場合はアノテーションを追加
          if (needsClarification) {
            // streamData.append({ type: 'clarification' });
            dataStreamWriter.writeMessageAnnotation({ type: 'clarification' });
            console.log('[API Deep Research DEBUG] Wrote clarification annotation.');
          }

        } catch (error) {
          console.error('[API Deep Research] Error during agent execution:', error);
          agentError = error instanceof Error ? error : new Error(String(error));
          try {
            // エラー情報もストリームに書き込む
            // streamData.append({ type: 'error', message: agentError.message });
            dataStreamWriter.writeData({ type: 'error', message: agentError.message });
            console.log('[API Deep Research DEBUG] Wrote execution error to stream data.');
          } catch (writeErrorError) {
            console.error('[API Deep Research] Failed to write execution error to stream data:', writeErrorError);
          }
        } finally {
          // DB保存
          const userMessageToSave = userMessageToSaveInitially;

          const assistantMessageToSave: Omit<DBMessage, 'userId'> | null = !agentError && fullCompletionText ? {
            id: randomUUID(),
            chatId: chatId,
            role: 'assistant',
            content: fullCompletionText,
            createdAt: new Date(),
          } : null;

          const messagesToSave: Omit<DBMessage, 'userId'>[] = [];
          if (userMessageToSave) {
            messagesToSave.push(userMessageToSave);
          }
          if (assistantMessageToSave) {
            messagesToSave.push(assistantMessageToSave);
          }

          if (messagesToSave.length > 0) {
            try {
              console.log(`[API Deep Research] Saving ${messagesToSave.length} messages to DB...`);
              await saveMessages({ messages: messagesToSave.map(m => ({ ...m, userId })) });
              console.log('[API Deep Research] Successfully saved messages to DB.');
            } catch (dbSaveError) {
              console.error('[API Deep Research] Failed to save messages to DB:', dbSaveError);
            }
          }
          
          // ストリームデータオブジェクトを閉じる
          streamData.close();
          console.log('[API Deep Research DEBUG] Closed stream data object.');

          // ★ HTTPレスポンスストリームを閉じる処理は一旦コメントアウト (SDK依存)
          // try {
          //   dataStreamWriter.close();
          //   console.log('[API Deep Research DEBUG] Closed HTTP response stream (DataStreamWriter).');
          // } catch (closeError) {
          //   console.warn('[API Deep Research DEBUG] Failed to explicitly close DataStreamWriter:', closeError);
          // }
        }
      },
      onError: (error: unknown) => {
        console.error('[API Deep Research] Error in createDataStreamResponse:', error);
        return 'An error occurred while processing your request.';
      },
    });

    return result;

  } catch (error) {
    // ★ エラー応答も NextResponse.json を使用 ★
    console.error('[API Deep Research] An unexpected error occurred in POST handler:', error);
    // return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}

// nanoid のインポートはDB保存時に必要だったのでコメントアウトセクション内にある想定だが、
// もしトップレベルにあったらDB保存処理をコメントアウトした際に不要になる可能性
// import { nanoid } from 'nanoid'; 
