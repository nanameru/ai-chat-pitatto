import { mastra } from './lib/mastra';
import * as dotenv from 'dotenv';

// 環境変数を読み込む
dotenv.config({ path: '.env.production' });

async function testDeepResearchAgent() {
  try {
    console.log('Deep Research Agentのテストを開始します...');
    console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? '設定されています' : '設定されていません');
    console.log('SERPAPI API Key:', process.env.SERPAPI_API_KEY ? '設定されています' : '設定されていません');
    
    const query = 'Gemini 2.5 Pro について教えて';
    console.log(`クエリ: "${query}"`);
    
    // タイムアウトを90秒に設定
    const timeout = 90000;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`タイムアウト: ${timeout}ms経過`)), timeout);
    });
    
    const generatePromise = mastra.getAgent('deepResearchAgent').generate([
      { role: 'user', content: query }
    ], {
      onToolCall: (toolCall) => {
        const timestamp = new Date().toISOString();
        console.log(`\n[${timestamp}] ツール呼び出し: ${toolCall.name}`);
        
        if (toolCall.name === 'Web Search') {
          console.log(`検索クエリ: ${toolCall.input?.query || 'N/A'}`);
          if (toolCall.result?.results) {
            console.log(`検索結果数: ${toolCall.result.results.length}`);
            console.log('検索結果タイトル:');
            toolCall.result.results.slice(0, 5).forEach((result, i) => {
              console.log(`  ${i+1}. ${result.title}`);
            });
          }
        }
        
        if (toolCall.name === 'Search Results Analysis') {
          console.log(`分析結果:`);
          console.log(`- 完全性スコア: ${toolCall.result?.completenessScore || 'N/A'}/10`);
          console.log(`- 十分な情報か: ${toolCall.result?.isSufficient ? 'はい' : 'いいえ'}`);
          
          if (toolCall.result?.missingInformation) {
            console.log(`- 不足情報:`);
            toolCall.result.missingInformation.forEach(info => console.log(`  * ${info}`));
          }
          
          if (toolCall.result?.followUpQueries) {
            console.log(`- フォローアップクエリ:`);
            toolCall.result.followUpQueries.forEach(query => console.log(`  * ${query}`));
          }
          
          console.log(`- 反復回数: ${toolCall.input?.iteration || 'N/A'}/${toolCall.input?.maxIterations || 'N/A'}`);
        }
      }
    });
    
    // タイムアウト処理を追加
    const response = await Promise.race([generatePromise, timeoutPromise]);
    
    console.log('\n=== 最終回答 ===\n');
    console.log(response.text);
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

testDeepResearchAgent();
