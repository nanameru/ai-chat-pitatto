// Mastra APIエンドポイントのテストスクリプト
// ESMモジュールを使用するための設定
import fetch from 'node-fetch';

async function testMastraAPI() {
  console.log('Mastra APIテスト開始');
  console.log('========================');

  try {
    // テストクエリ
    const testQuery = '2025年の最新AIエージェントについて教えて';
    console.log(`テストクエリ: "${testQuery}"`);
    
    // ローカルAPIエンドポイントを呼び出す
    console.log('APIリクエスト送信中...');
    
    // タイムアウトを180秒に設定したカスタムfetch関数
    const fetchWithTimeout = async (url, options, timeout = 180000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    };
    
    const response = await fetchWithTimeout('http://localhost:3002/api/mastra', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: testQuery,
        mode: 'agent', // agentモードを指定
      }),
    });
    
    const result = await response.json();
    
    // 結果の表示
    console.log('\n結果:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\nテスト完了');
  } catch (error) {
    console.error('エラー発生:', error);
  }
}

// テスト実行
testMastraAPI();
