// Coze APIのテストスクリプト
// 使用方法: node tests/test-coze.js
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '..', '.env.local');

dotenv.config({ path: envPath });

// ハードコードされたワークフローIDと固定クエリ
const WORKFLOW_ID = '7493492287205638152';
const API_URL = 'https://api.coze.com/v1/workflow/stream_run';
const FIXED_PROMPT = 'AI';

async function testCozeAPI() {
  console.log('Coze APIテスト開始...');
  console.log(`固定プロンプト: "${FIXED_PROMPT}"`);
  console.log(`APIキー: ${process.env.NEXT_PUBLIC_COZE_API_KEY ? '設定済み' : '未設定'}`);
  
  try {
    console.log('APIリクエスト送信中...');
    
    const requestBody = {
      workflow_id: WORKFLOW_ID,
      inputs: {
        prompt: FIXED_PROMPT,
        format: 'json'
      }
    };
    
    console.log('リクエスト内容:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_COZE_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      console.error(`APIエラー: ${response.status} ${response.statusText}`);
      
      // エラー詳細を取得
      try {
        const errorData = await response.json();
        console.error('エラー詳細:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.error('エラーレスポンス:', await response.text());
      }
      
      return;
    }
    
    const responseText = await response.text();
    console.log(`APIレスポンス受信 (${responseText.length} バイト)`);
    
    // レスポンスをパース
    try {
      // data: プレフィックスの処理
      let jsonStr = responseText.trim();
      if (jsonStr.startsWith('data:')) {
        jsonStr = jsonStr.slice(5).trim();
      }
      
      const result = JSON.parse(jsonStr);
      console.log('パース結果:');
      console.log(JSON.stringify(result, null, 2));
      
      // Xの投稿を含むか検証
      if (result.content) {
        console.log('\n=== コンテンツ ===');
        console.log(result.content);
        
        // Twitterへの言及を確認
        const hasTwitterMention = result.content.toLowerCase().includes('twitter') || 
                                  result.content.toLowerCase().includes('tweet') ||
                                  result.content.toLowerCase().includes('x.com');
        
        console.log(`\nTwitter/X の投稿を含む: ${hasTwitterMention ? 'はい' : 'いいえ'}`);
      }
    } catch (e) {
      console.error('レスポンスのパースに失敗:', e);
      console.log('生のレスポンス:', responseText);
    }
    
  } catch (error) {
    console.error('テスト実行エラー:', error);
  }
}

// テスト実行
testCozeAPI();
