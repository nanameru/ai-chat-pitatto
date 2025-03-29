import { mastra } from './lib/mastra';

async function testDeepResearchAgent() {
  try {
    console.log('Deep Research Agentのテストを開始します...');
    
    const query = '量子コンピューティングの最新の進展について教えてください';
    console.log(`クエリ: "${query}"`);
    
    const response = await mastra.getAgent('deepResearchAgent').generate([
      { role: 'user', content: query }
    ], {
      onToolCall: (toolCall) => {
        console.log(`ツール呼び出し: ${toolCall.name}`);
        if (toolCall.name === 'Search Results Analysis') {
          console.log(`分析結果: スコア=${toolCall.result?.completenessScore || 'N/A'}`);
        }
      }
    });
    
    console.log('\n=== 最終回答 ===\n');
    console.log(response.text);
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

testDeepResearchAgent();
