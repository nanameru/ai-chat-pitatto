/**
 * Coze API単体テストスクリプト
 * 
 * 使用方法:
 * npx ts-node scripts/test-coze-api.ts
 * 
 * 必要な環境変数:
 * NEXT_PUBLIC_COZE_API_KEY
 */

import * as fs from 'fs';
import * as dotenv from 'dotenv';

// .env.localファイルを読み込み
dotenv.config({ path: '.env.local' });

// APIキーの確認
const API_KEY = process.env.NEXT_PUBLIC_COZE_API_KEY;
if (!API_KEY) {
  console.error('環境変数 NEXT_PUBLIC_COZE_API_KEY が設定されていません。');
  process.exit(1);
}

// Coze API用の定数
const WORKFLOW_ID = '7493492287205638152';
const API_URL = 'https://api.coze.com/v1/workflow/run';

// ログファイルの準備
const logFileName = `coze-api-test-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

/**
 * Coze APIを呼び出す関数
 */
async function callCozeAPI() {
  console.log('Coze APIに接続中...');
  console.log(`ワークフローID: ${WORKFLOW_ID}`);
  
  try {
    const startTime = Date.now();
    
    // API呼び出し
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        parameters: {
          input: "AI"  // 静的に固定値「AI」を使用
        },
        workflow_id: WORKFLOW_ID,
      }),
    });
    
    const endTime = Date.now();
    console.log(`API呼び出し時間: ${(endTime - startTime) / 1000}秒`);
    
    // レスポンスのステータスを確認
    if (!response.ok) {
      const errorStatus = `${response.status} ${response.statusText}`;
      console.error(`API応答エラー: ${errorStatus}`);
      
      // エラーレスポンスの内容を確認
      let errorBody;
      try {
        errorBody = await response.json();
      } catch (e) {
        errorBody = await response.text();
      }
      
      console.error('エラーの詳細:', errorBody);
      return;
    }
    
    // レスポンスをパース
    const responseText = await response.text();
    console.log(`応答を受信しました (${responseText.length}バイト)`);
    
    // JSONデータを解析
    try {
      const data = JSON.parse(responseText);
      
      // 応答コードの確認
      if (data.code === 0) {
        console.log('APIコール成功 (code: 0)');
        
        // 応答データの処理
        let parsedWorkflowData = null;
        
        if (data.data) {
          try {
            // data.dataフィールドをパース
            parsedWorkflowData = JSON.parse(data.data);
            console.log('ワークフローデータを解析しました');
            
            // ログファイルに結果を保存
            fs.writeFileSync(
              `./logs/${logFileName}`, 
              JSON.stringify({ 
                raw: data, 
                parsed: parsedWorkflowData 
              }, null, 2)
            );
            
            // Twitter/X投稿データを確認
            if (parsedWorkflowData.output) {
              let twitterPosts = [];
              
              // 投稿データを探索
              for (const item of Array.isArray(parsedWorkflowData.output) ? parsedWorkflowData.output : [parsedWorkflowData.output]) {
                if (item.freeBusy && item.freeBusy.post) {
                  console.log(`${item.freeBusy.post.length}件のTwitter/X投稿を見つけました`);
                  
                  // 見つかった投稿の内容サンプルを表示
                  for (let i = 0; i < Math.min(3, item.freeBusy.post.length); i++) {
                    const post = item.freeBusy.post[i];
                    console.log(`\n投稿 #${i+1}:`);
                    console.log(`- 内容: ${post.full_text && post.full_text.substring(0, 100)}...`);
                    console.log(`- ユーザー: ${post.user ? post.user.name : '不明'} (@${post.user ? post.user.screen_name : '不明'})`);
                    console.log(`- 日付: ${post.created_at || '不明'}`);
                    twitterPosts.push(post);
                  }
                } else {
                  console.log('freeBusy.postデータがありません');
                  console.log('返却されたデータ構造:', JSON.stringify(item, null, 2).substring(0, 300) + '...');
                }
              }
              
              // ログディレクトリがなければ作成
              if (!fs.existsSync('./logs')) {
                fs.mkdirSync('./logs');
              }
              
              // 投稿をファイルに保存
              if (twitterPosts.length > 0) {
                fs.writeFileSync(
                  `./logs/twitter-posts-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, 
                  JSON.stringify(twitterPosts, null, 2)
                );
                console.log(`\n${twitterPosts.length}件の投稿をlogsディレクトリに保存しました`);
              }
            } else {
              console.log('outputデータがありません');
              console.log('返却されたデータ構造:', Object.keys(parsedWorkflowData));
            }
          } catch (parseError) {
            console.error('ワークフローデータのパースに失敗しました:', parseError);
            console.log('生のレスポンス(data):', data.data);
          }
        } else {
          console.log('data フィールドがありません');
          console.log('レスポンス全体:', data);
        }
      } else {
        console.error(`APIエラー - コード: ${data.code}, メッセージ: ${data.msg}`);
        console.log('レスポンス全体:', data);
      }
    } catch (error) {
      console.error('JSON解析エラー:', error);
      console.log('生のレスポンス:', responseText.substring(0, 1000));
    }
  } catch (error) {
    console.error('APIリクエストエラー:', error);
  }
}

// スクリプト実行
callCozeAPI().catch(error => {
  console.error('スクリプト実行エラー:', error);
}); 