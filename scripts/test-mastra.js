// Mastraエージェントのテストスクリプト
import { researchAgent } from '../lib/mastra';

async function testMastraAgent() {
  console.log('Mastraエージェントのテスト開始');
  console.log('========================');

  try {
    // テストクエリ
    const testQuery = '人工知能の最新トレンドについて教えてください';
    console.log(`テストクエリ: "${testQuery}"`);
    
    // エージェントの呼び出し
    console.log('エージェント処理中...');
    const response = await researchAgent.invoke({
      messages: [
        {
          role: 'user',
          content: testQuery
        }
      ]
    });
    
    // 結果の表示
    console.log('\n結果:');
    console.log(response);
    console.log('\nテスト完了');
  } catch (error) {
    console.error('エラー発生:', error);
  }
}

// テスト実行
testMastraAgent();
