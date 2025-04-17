import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// デバッグ用の設定
const DEBUG_MODE = true;
const VERBOSE_LOGGING = true;

/**
 * デバッグ用のログ出力
 */
function debugLog(...args: any[]) {
  if (DEBUG_MODE) {
    console.log('[Coze Tool]', ...args);
  }
}

/**
 * 詳細なデバッグログ
 */
function verboseLog(...args: any[]) {
  if (DEBUG_MODE && VERBOSE_LOGGING) {
    console.log('[Coze Tool Detail]', ...args);
  }
}

// Coze API用の定数
const WORKFLOW_ID = '7493492287205638152';
const API_URL = 'https://api.coze.com/v1/workflow/run';
const MAX_RETRIES = 2;
const RETRY_DELAY = 3000; // 3秒

// レート制限のための定数
const RATE_LIMIT = {
  MAX_REQUESTS_PER_MINUTE: 30,
  QUOTA_RESET_INTERVAL: 60 * 1000, // 1分
};

// リクエストの追跡
let requestCount = 0;
let lastResetTime = Date.now();

// 待機用の関数
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * レート制限をチェックする関数
 */
function checkRateLimit(): boolean {
  const now = Date.now();
  if (now - lastResetTime >= RATE_LIMIT.QUOTA_RESET_INTERVAL) {
    requestCount = 0;
    lastResetTime = now;
  }
  
  if (requestCount >= RATE_LIMIT.MAX_REQUESTS_PER_MINUTE) {
    return false;
  }
  
  requestCount++;
  return true;
}

/**
 * レスポンスの内容をパースする
 */
function parseStreamContent(response: string): string {
  debugLog('レスポンス内容をパース中...');
  verboseLog('元のレスポンス:', response.substring(0, 200) + '...');
  
  try {
    // レスポンスが空の場合
    if (!response || response.trim() === '') {
      debugLog('空のレスポンスを受信しました');
      return '';
    }

    // JSONとしてパース
    const data = JSON.parse(response);
    
    // Coze APIからのレスポンス形式を確認
    if (data.code === 0 && data.data) {
      try {
        // data.dataフィールドをパース（これが実際のワークフロー出力）
        const workflowData = JSON.parse(data.data);
        debugLog('ワークフローデータを正常にパースしました');
        verboseLog('ワークフロー出力構造:', Object.keys(workflowData));
        
        // freeBusyデータ（Twitter/X投稿）を抽出
        if (workflowData.output && Array.isArray(workflowData.output)) {
          // output配列からfreeBusyデータを探す
          const twitterData = [];
          
          for (const item of workflowData.output) {
            if (item.freeBusy && item.freeBusy.post && Array.isArray(item.freeBusy.post)) {
              debugLog(`${item.freeBusy.post.length}件のTwitter/X投稿を見つけました`);
              
              // 各投稿からテキスト、ユーザー情報、日付などを抽出
              for (const post of item.freeBusy.post) {
                if (post && post.full_text) {
                  const postData = {
                    text: post.full_text,
                    date: post.created_at,
                    username: post.user?.screen_name || '',
                    name: post.user?.name || '',
                    followers: post.user?.followers_count || 0
                  };
                  twitterData.push(postData);
                }
              }
            }
          }
          
          if (twitterData.length > 0) {
            debugLog(`${twitterData.length}件の投稿データを抽出しました`);
            // 最終的なフォーマットされた結果を返す
            return JSON.stringify({
              source: "Twitter/X",
              posts: twitterData,
              timestamp: new Date().toISOString()
            });
          }
        }
        
        // データが見つからない場合は元のデータをそのまま返す
        debugLog('特定のデータ形式が見つからないため、生のワークフローデータを返します');
        return JSON.stringify(workflowData);
      } catch (innerError) {
        debugLog('ワークフローデータのパースに失敗しました:', innerError);
        // データパースに失敗した場合は元のdataフィールドをそのまま返す
        return data.data;
      }
    }
    
    // 標準的なレスポンス形式
    let content = '';
    
    // 様々な形式のレスポンスに対応
    if (data.response) {
      content = data.response;
      debugLog('response フィールドからコンテンツを抽出しました');
    } else if (data.content) {
      content = data.content;
      debugLog('content フィールドからコンテンツを抽出しました');
    } else if (data.result) {
      content = data.result;
      debugLog('result フィールドからコンテンツを抽出しました');
    } else if (data.output) {
      content = typeof data.output === 'string' ? data.output : JSON.stringify(data.output);
      debugLog('output フィールドからコンテンツを抽出しました');
    } else if (data.message && data.message.content) {
      content = data.message.content;
      debugLog('message.content フィールドからコンテンツを抽出しました');
    } else if (data.data) {
      // data フィールドに直接データがある場合
      content = typeof data.data === 'string' ? data.data : JSON.stringify(data.data);
      debugLog('data フィールドからコンテンツを抽出しました');
    } else {
      debugLog('既知のフィールドが見つかりません、完全なレスポンスを返します');
      content = JSON.stringify(data);
    }
    
    debugLog(`パース完了。コンテンツ長: ${content.length}`);
    return content;
    
  } catch (error) {
    debugLog('レスポンス内容のパース中にエラーが発生しました:', error);
    verboseLog('パースに失敗したレスポンス:', response);
    // JSONとして解析できない場合は、テキストをそのまま返す
    return response;
  }
}

/**
 * Cozeツール - Coze WorkflowのAPIを呼び出して結果を返す
 */
export const cozeTool = createTool({
  id: "Coze Workflow",
  inputSchema: z.object({
    prompt: z.string().describe("Cozeに送信するプロンプト"),
    options: z.record(z.any()).optional().describe("追加のオプションパラメータ"),
  }),
  description: "CozeのWorkflowを実行して回答を生成します",
  execute: async ({ context: { prompt, options = {} } }) => {
    debugLog(`CozeAPI実行: ${prompt.substring(0, 100)}...`);
    
    // レート制限のチェック
    if (!checkRateLimit()) {
      debugLog('レート制限に達しました。待機します...');
      await sleep(RATE_LIMIT.QUOTA_RESET_INTERVAL);
      if (!checkRateLimit()) {
        throw new Error('レート制限に達しました。しばらく経ってから再試行してください。');
      }
    }
    
    let retries = 0;
    
    while (retries < MAX_RETRIES) {
      try {
        debugLog(`API呼び出し試行 ${retries + 1}/${MAX_RETRIES + 1}...`);
        
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_COZE_API_KEY}`,
          },
          body: JSON.stringify({
            parameters: {
              input: "AI"  // 静的に固定値「AI」を使用
            },
            workflow_id: WORKFLOW_ID,
          }),
        });
        
        if (!response.ok) {
          const errorStatus = `${response.status} ${response.statusText}`;
          debugLog(`API応答エラー: ${errorStatus}`);
          
          // エラーレスポンスの内容を確認
          let errorBody = null;
          try {
            errorBody = await response.json();
          } catch (e) {
            errorBody = await response.text();
          }
          
          debugLog('エラーの詳細:', errorBody);
          
          // クォータ超過エラーの場合、リトライ
          if (
            response.status === 429 || 
            errorBody?.error_code === 4009 || 
            (errorBody?.error_message && errorBody.error_message.includes('QUOTA_BYTES quota exceeded'))
          ) {
            debugLog(`クォータ制限エラーが発生しました。${RETRY_DELAY/1000}秒待機します...`);
            await sleep(RETRY_DELAY);
            retries++;
            continue;
          }
          
          throw new Error(`Coze API エラー: ${errorStatus}`);
        }
        
        const responseText = await response.text();
        debugLog(`API応答を受信しました（${responseText.length}バイト）`);
        
        const result = parseStreamContent(responseText);
        
        if (!result) {
          throw new Error('応答の解析に失敗しました。空のレスポンスまたは無効なフォーマット');
        }
        
        // 成功した応答を返す
        return {
          content: result || '',
          rawResponse: result,
          metadata: {
            timestamp: new Date().toISOString(),
            workflowId: WORKFLOW_ID,
          }
        };
        
      } catch (error) {
        debugLog(`エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
        
        if (retries >= MAX_RETRIES) {
          debugLog('最大リトライ回数に達しました。エラーを返します。');
          throw error;
        }
        
        debugLog(`${RETRY_DELAY/1000}秒後にリトライします...`);
        await sleep(RETRY_DELAY);
        retries++;
      }
    }
    
    // リトライが全て失敗した場合
    throw new Error(`Coze APIの呼び出しに${MAX_RETRIES + 1}回の試行後も失敗しました。`);
  },
}); 