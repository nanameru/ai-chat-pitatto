// ローカル環境でニュース生成APIをテストするスクリプト
// 使い方: npx ts-node scripts/test-news-generator.ts

import fetch from 'node-fetch';

async function testNewsGenerator() {
  // ローカルのAPIエンドポイントURL
  const apiUrl = 'http://localhost:3000/api/cron/update-news';
  
  // 環境変数からシークレットトークンを取得するか、デフォルト値を使用
  const authToken = process.env.CRON_SECRET || 'default-secret-token';
  
  console.log('生成AIニュース生成テストを開始します...');
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ APIリクエスト成功:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error('❌ APIリクエスト失敗:');
      console.error(`ステータス: ${response.status} ${response.statusText}`);
      console.error(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('❌ APIリクエスト実行エラー:', error);
  }
}

// スクリプトを実行
testNewsGenerator().catch(console.error); 