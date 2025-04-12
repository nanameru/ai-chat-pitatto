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
import { type CoreMessage, createDataStreamResponse, DataStreamWriter, StreamData } from 'ai'; // StreamData, createDataStreamResponse, smoothStream は一旦不要 ★ StreamingTextResponse をインポート
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
// // ★★★ ここまで再修正 ★★★

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
  // 他にもプロパティがある可能性
};

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

        try {
          console.log('[API Deep Research] Getting ToT Research agent...');
          const agent = mastra.getAgent('totResearchAgent');
          if (!agent) {
            throw new Error('ToT Research Agent not found.');
          }

          console.log('[API Deep Research] Generating response with agent...');
          console.log('[API Deep Research DEBUG] Calling agent.generate with messages:', coreMessages);
          const agentResult = await agent.generate(
            coreMessages,
            {} // オプション
          ) as AgentResult;

          const agentRunEndTime = Date.now();
          console.log(`[API Deep Research] Agent finished in ${agentRunEndTime - agentRunStartTime}ms.`);
          console.log('[API Deep Research DEBUG] Agent Result received:', JSON.stringify(agentResult, null, 2));

          // --- agentResult の解析 --- ★
          // 1. 明確化が必要かチェック
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
                // 明確化メッセージ自体は agentResult.text に含まれると仮定
              }
            }
          } else {
            console.log('[API Deep Research DEBUG] No steps found or invalid format for clarification check.');
          }

          // 2. 最終的なテキストを取得
          fullCompletionText = agentResult.text || '';
          console.log('[API Deep Research DEBUG] Final text:', fullCompletionText ? fullCompletionText.substring(0, 100) + '...' : '(empty)');

          // 3. ステップ情報などを data としてストリームに追加 (任意)
          if (agentResult.steps) {
            streamData.append({ type: 'agent_steps', steps: agentResult.steps });
            console.log('[API Deep Research DEBUG] Appended steps to stream data.');
          }
          // --- 解析ここまで --- ★

          // --- ストリームへの書き込み --- ★
          if (fullCompletionText) {
            // テキストを直接ストリームに書き込む (Vercel AI SDK の内部形式に合わせる)
            // `0:` はテキストパートを示すID
            dataStreamWriter.write(`0:"${JSON.stringify(fullCompletionText).slice(1, -1)}"\n`);
            console.log('[API Deep Research DEBUG] Wrote text to stream.');
          }

          // 明確化が必要な場合はアノテーションを追加
          if (needsClarification) {
            dataStreamWriter.writeMessageAnnotation({ type: 'clarification' });
            console.log('[API Deep Research DEBUG] Wrote clarification annotation to stream.');
          }
          // --- 書き込みここまで --- ★

        } catch (error) {
          console.error('[API Deep Research] Error during agent execution:', error);
          agentError = error instanceof Error ? error : new Error(String(error));
          try {
            // エラー情報をストリームに書き込む
            dataStreamWriter.writeData({ type: 'error', message: agentError.message });
            console.log('[API Deep Research DEBUG] Wrote execution error to stream data.');
          } catch (writeErrorError) {
            console.error('[API Deep Research] Failed to write execution error to stream:', writeErrorError);
          }
        } finally {
          // --- DB保存 --- ★
          // ★ 保存するユーザーメッセージを、最初に保持したものに変更 ★
          // const lastUserMessage = coreMessages[coreMessages.length - 1];
          // const userMessageToSave: Omit<DBMessage, 'userId'> | null = lastUserMessage?.role === 'user' ? { ... } : null;
          const userMessageToSave = userMessageToSaveInitially; // ★ 最初に保持したユーザーメッセージを使用

          const assistantMessageToSave: Omit<DBMessage, 'userId'> | null = !agentError && fullCompletionText ? {
            id: randomUUID(),
            chatId: chatId,
            role: 'assistant',
            content: fullCompletionText,
            createdAt: new Date(),
          } : null;

          // ★ userMessageToSave が null でないことを確認してから配列に追加 ★
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
          // ★ ここまで修正 ★
          streamData.close();
          console.log('[API Deep Research DEBUG] Closed stream data.');
        }
      },
      // ★ streamData をレスポンスオブジェクトから削除 ★
      // data: streamData,
      onError: (error: unknown) => {
        console.error('[API Deep Research] Error in createDataStreamResponse:', error);
        // クライアントには汎用的なエラーメッセージを返す
        return 'An error occurred while processing your request.';
      },
    });

    // ★ ストリーミング応答を返す ★
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
