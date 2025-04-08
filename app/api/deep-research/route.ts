import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
// ★★★ @mastra 関連はコメントアウトしたまま ★★★
/*
// import { ... } from '@/lib/mastra/...';
// import { getJson } from 'serpapi'; 
*/
// ★ DB関連の import を戻す
import { createClient } from '@/utils/supabase/server';
import { saveMessages } from '@/lib/db/queries';
import type { Message as DBMessage } from '@/lib/db/schema';
import { randomUUID } from 'crypto'; // ★ crypto.randomUUID を戻す
import { type CoreMessage, StreamData, createDataStreamResponse, smoothStream, streamText } from 'ai';
import { myProvider } from '@/lib/ai/models';
// ★★★ @mastra 関連のインポートを再修正 ★★★
import {
  Mastra,                // Mastra クラスはこれで合っているはず
  // 型は一旦 @mastra/core から直接インポートせず、
  // 使用箇所で Mastra の型定義から推論させるか、必要なら後で特定する
  // type ActionObservation, 
  // type AgentResponse,     
  // type ActionOptions      
} from '@mastra/core'; 
import { deepResearchAgentV2 } from '@/lib/mastra/agents/deep-research-v2'; 
import { mastra } from '@/lib/mastra'; // ★ lib/mastra/index.ts から mastra インスタンスをインポート
// ★★★ ここまで再修正 ★★★

// 以下の不要なインポートを削除
// import { SupabaseClient } from '@supabase/supabase-js';
import { type Message as VercelChatMessage } from 'ai';
// import { StreamingTextResponse } from 'ai/dist/edge'; // ★ パスを 'ai/dist/edge' に変更

// import { saveMessages } from '@/utils/supabase/chat-actions'; // ★ 重複のためコメントアウト

// ★ 型定義のコメントアウト解除 ★★★
// 必要に応じて AgentResponse などの型をインラインで定義するか、any を使う
type ResearchPlan = { /* ... */ };
// ... 他の型定義 ...
const InputSchema = z.object({
  query: z.string(),
  chatId: z.string().uuid(),
  clarificationResponse: z.string().optional(),
});
// ★★★ ここまで解除 ★★★

export async function POST(req: NextRequest) {
  console.log('[API Deep Research TEST 4] Received POST request.'); 
  try {
    // ★★★ createClient と getUser の呼び出しを戻す ★★★
    // デバッグログ: 環境変数の確認 (念のため残す)
    console.log('[API Deep Research DEBUG] Checking env vars before createClient:');
    console.log(`  NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
    console.log(`  NEXT_PUBLIC_SUPABASE_ANON_KEY exists: ${!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`);
    console.log(`  SUPABASE_SERVICE_ROLE_KEY exists: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`); 

    // Supabaseクライアントとユーザー情報を取得
    console.log('[API Deep Research DEBUG] Calling createClient()...');
    const supabase = await createClient();
    console.log('[API Deep Research DEBUG] createClient() successful.');
    
    console.log('[API Deep Research DEBUG] Calling supabase.auth.getUser()...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('[API Deep Research DEBUG] supabase.auth.getUser() finished.');

    if (authError || !user?.id) {
      console.error('[API Deep Research] Unauthorized:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = user.id; // userId は取得しておく
    // ★★★ ここまで戻す ★★★

    // ★★★ テスト用DB読み取り処理のコメントアウトを解除 ★★★
    let testUserData: any;
    try {
      console.log(`[API Deep Research DEBUG] Attempting simple DB read for userId: ${userId}`);
      const { data, error: testDbReadError } = await supabase
        .from('User') 
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      testUserData = data; // 成功データを保持

      if (testDbReadError) {
        console.error('[API Deep Research ERROR] Simple DB read failed:', testDbReadError);
        throw testDbReadError; // エラーとして処理を止める
            } else {
        console.log('[API Deep Research DEBUG] Simple DB read successful. User data:', testUserData);
      }
    } catch (testError) {
        console.error('[API Deep Research ERROR] Exception during simple DB read test:', testError);
        return NextResponse.json({ error: 'データベース接続テスト中にエラーが発生しました' }, { status: 500 });
    }
    // ★★★ ここまで戻す ★★★

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

    // ★ req.json() と入力チェックは実行
    const { query, clarificationResponse, chatId } = await req.json();
    // ★★★ query の内容をログ出力 ★★★
    console.log('[API Deep Research DEBUG] req.json result:', { query, clarificationResponse, chatId }); 
    // ★★★ ログ追加ここまで ★★★

    // ... (入力チェックコード) ...

    // ★★★ Chat レコード存在確認 & 必要なら作成 ★★★
    console.log(`[API Deep Research DEBUG] Checking/Creating chat: ${chatId}`);
    let chatExists = false;
    try {
      const { data: existingChat, error: checkError } = await supabase
        .from('Chat')
        .select('id')
        .eq('id', chatId)
        .maybeSingle();

      if (checkError) {
        console.error('[API Deep Research ERROR] Failed to check chat existence:', checkError);
        throw new Error('チャット情報の確認中にエラーが発生しました。'); // エラーとして投げる
      }

      if (existingChat) {
        chatExists = true;
        console.log(`[API Deep Research DEBUG] Chat already exists: ${chatId}`);
      } else {
        console.log(`[API Deep Research DEBUG] Chat not found, creating new chat: ${chatId}`);
        // タイトルを最初のメッセージから生成 (簡易版)
        const title = query.substring(0, 100) || 'New Deep Research Chat'; 
        const { error: createError } = await supabase
          .from('Chat')
          .insert({ 
            id: chatId, 
            userId: userId, 
            title: title, 
            createdAt: new Date(),
            // visibility はデフォルト値に任せるか、必要なら指定 
          });

        if (createError) {
          console.error('[API Deep Research ERROR] Failed to create chat:', createError);
          throw new Error('新しいチャットの作成に失敗しました。'); // エラーとして投げる
        }
        chatExists = true; // 作成成功
        console.log(`[API Deep Research DEBUG] Successfully created new chat: ${chatId}`);
      }
    } catch (error) {
      // DB接続エラーなどもここで捕捉
      console.error('[API Deep Research ERROR] Error during chat check/create:', error);
      const errorMessage = error instanceof Error ? error.message : 'チャットの確認/作成中に不明なエラーが発生しました。';
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
    // ★★★ ここまで修正 ★★★

    // 以降の処理 (Chatが存在する場合のみ実行される)

    // ユーザーメッセージをDBに保存する準備
    const userMessageObject: Omit<DBMessage, 'userId'> = {
        id: randomUUID(), 
        chatId: chatId,
        role: 'user',
        content: clarificationResponse ? `${query}\n\nClarification: ${clarificationResponse}` : query,
        createdAt: new Date(),
    };

    console.log('[API Deep Research DEBUG] User message object prepared:', userMessageObject);

    // saveMessages には配列で渡す
    try {
        await saveMessages({ messages: [userMessageObject] });
        console.log('[API Deep Research DEBUG] User message supposedly saved successfully.');
    } catch (error) {
      // エラー発生時のログ出力改善
      const dbError = error as Error;
      console.error('[API Deep Research ERROR] Database operation failed:', {
          message: dbError.message,
          stack: dbError.stack,
          cause: (dbError as any).cause, // PostgreSQLエラーコードなどを含む可能性
      });
      return NextResponse.json({ error: 'データベースへのメッセージ保存に失敗しました。' }, { status: 500 });
    }

    // ★ Deep Research 関連処理 ★★★
    console.log('[API] Deep Research Agent実行開始:', { query, chatId, userId });

    // ★ new Mastra({}) の行を削除 ★
    // const mastra = new Mastra({}); 

    // ActionOptions 型がないため、一旦 any で回避
    const options: any = {
        maxIterations: 5, 
        callbacks: {
            onActionStart: (action: any) => console.log(`[Agent Callback] Action Start: ${action.name}`),
            onActionEnd: (action: any, observation: any) => console.log(`[Agent Callback] Action End: ${action.name}`, observation),
            onToolStart: (tool: any) => console.log(`[Agent Callback] Tool Start: ${tool.name}`),
            onToolEnd: (tool: any, observation: any) => console.log(`[Agent Callback] Tool End: ${tool.name}`, observation),
        },
    };

    try {
        // ★ エージェントを取得 (インポートした mastra インスタンスから)
        const agent = mastra.getAgent('deepResearchAgent'); 
        
        // ★ generate の引数を修正 ★
        // input オブジェクトを CoreMessage 配列に変換 (簡易的な例)
        const messages: CoreMessage[] = [
          { role: 'user', content: query }, // ユーザーのクエリ
          ...(clarificationResponse ? [{ role: 'user' as const, content: clarificationResponse }] : []), // ★ 明確化回答を追加
        ];
        
        // Deep Researchエージェントの実行
        // AgentResponse 型がないため、一旦 any で回避
        const agentResult = await agent.generate(
          messages, // ← メッセージ配列を第一引数に
          options   // ← options オブジェクトを直接第二引数に
        );
        
        console.log('[API] Deep Research Agent実行完了:', agentResult);
        
        // ★ 修正: agentResult の内容に基づいて明確化が必要か判断
        const needsClarification = agentResult.toolCalls?.some((tc) => 
          tc.toolName === 'queryClarifier' || // toolNameを使用
          (tc.type === 'tool-call' && tc.toolName === 'queryClarifier') // 別の形式の可能性
        );
        const clarificationMessage = needsClarification ? agentResult.text : null; // toolCallsがある場合、textに明確化質問が入ると仮定

        // ★ StreamData を初期化
        const data = new StreamData();

        // ★ 修正: ストリーミングレスポンスを正しく返す
        if (needsClarification) {
          // 明確化が必要な場合
          console.log('[API] 明確化が必要です:', clarificationMessage);
          const assistantMessage = {
            chatId,
            role: 'assistant',
            content: typeof clarificationMessage === 'string' ? clarificationMessage : undefined,
            createdAt: Date.now(),
          };

          try {
            await saveMessages({ messages: [assistantMessage] });
            console.log('[API] 明確化メッセージを保存しました');
          } catch (error) {
            console.error('[API] 明確化メッセージの保存に失敗しました:', error);
          }

          // Vercel AI SDKのストリーミングを使用
          return createDataStreamResponse({
            execute: (dataStream) => {
              const result = streamText({
                model: myProvider.languageModel('gpt-4-turbo'),
                messages: [{ role: 'assistant', content: clarificationMessage || '' }],
                experimental_transform: smoothStream({ chunking: 'word' }),
              });
              result.mergeIntoDataStream(dataStream);
            },
            onError: () => {
              return '明確化メッセージの送信に失敗しました。もう一度お試しください。';
            },
          });
        } else {
          // 最終結果の場合
          console.log('[API] 最終結果を返します');
          const content = agentResult.text || '';
          
          // アシスタントメッセージを保存
          const assistantMessage = {
            chatId,
            role: 'assistant',
            content,
            createdAt: Date.now(),
          };

          try {
            await saveMessages({ messages: [assistantMessage] });
            console.log('[API] アシスタントメッセージを保存しました');
          } catch (error) {
            console.error('[API] アシスタントメッセージの保存に失敗しました:', error);
          }

          // Vercel AI SDKのストリーミングを使用
          return createDataStreamResponse({
            execute: (dataStream) => {
              const result = streamText({
                model: myProvider.languageModel('gpt-4-turbo'),
                messages: [{ role: 'assistant', content: content }],
                experimental_transform: smoothStream({ chunking: 'word' }),
              });
              result.mergeIntoDataStream(dataStream);
            },
            onError: () => {
              return 'メッセージの送信に失敗しました。もう一度お試しください。';
            },
          });
        }

    } catch (agentError: unknown) {
        console.error('[API] Error running Deep Research Agent:', agentError);
        // getAgent が失敗した場合もここで捕捉される
        const errorMessage = agentError instanceof Error ? agentError.message : String(agentError);
        return NextResponse.json({ error: 'Error during Deep Research execution', details: errorMessage }, { status: 500 });
    }
    // ★★★ ここまで ★★★

  } catch (error) {
    console.error('[API Deep Research TEST 4] Unexpected error:', error);
    return NextResponse.json(
          { error: 'Test 4 failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// nanoid のインポートはDB保存時に必要だったのでコメントアウトセクション内にある想定だが、
// もしトップレベルにあったらDB保存処理をコメントアウトした際に不要になる可能性
// import { nanoid } from 'nanoid'; 
