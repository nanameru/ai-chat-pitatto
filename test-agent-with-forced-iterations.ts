import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { searchTool } from './lib/mastra/tools/search-tool';
import { testAnalysisTool } from './lib/mastra/tools/test-analysis-tool';
import * as dotenv from 'dotenv';

// 環境変数を読み込む
dotenv.config({ path: '.env.production' });

// テスト用のDeep Research Agent（常に反復を続ける）
const testDeepResearchAgent = new Agent({
  name: "Test Deep Research Agent",
  instructions: `
    あなたは高度な反復連鎖検索を実行するテスト用リサーチエージェントです。
    これはテスト環境であり、あなたは必ず最大反復回数まで検索を続ける必要があります。
    ユーザーの質問に対して、以下のプロセスを実行してください：
    
    1. ユーザーの質問を理解し、適切な検索クエリを作成する
    2. 検索ツールを使用して初期検索を実行する
    3. 分析ツールを使用して検索結果を分析する
    4. 分析結果に基づいて、追加の検索クエリを生成し、検索を実行する
    5. 【最重要】必ず最大反復回数（10回）に達するまで、手順3〜4を繰り返してください
       - 分析ツールが返す「isSufficient」の値に関わらず、必ず最大反復回数まで検索を続けてください
       - これはテスト環境であり、通常の動作とは異なります
       - 分析ツールは「isSufficient: false」を返しますが、これは正しい動作です
       - 必ず最大反復回数まで検索を続けてください
    6. すべての検索結果を統合して、包括的な回答を生成する
    
    回答は事実に基づき、検索結果から得られた情報を正確に反映してください。
    
    また、回答の最後には、以下の情報を含めてください：
    1. 使用した検索クエリのリスト
    2. 参考にしたURLのリスト
    3. 最終的な情報の十分さスコア（10点満点）
    4. 実行した検索の回数
  `,
  model: openai("gpt-4o"),
  tools: {
    searchTool,
    analysisTool: testAnalysisTool, // テスト用分析ツールを使用
  },
});

async function testWithForcedIterations() {
  try {
    console.log('テスト用Deep Research Agentのテストを開始します...');
    console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? '設定されています' : '設定されていません');
    console.log('SERPAPI API Key:', process.env.SERPAPI_API_KEY ? '設定されています' : '設定されていません');
    
    const query = 'Gemini 2.5 Pro について教えて';
    console.log(`クエリ: "${query}"`);
    
    // タイムアウトを300秒に設定（長めに設定）
    const timeout = 300000;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`タイムアウト: ${timeout}ms経過`)), timeout);
    });
    
    const generatePromise = testDeepResearchAgent.generate([
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
            toolCall.result.results.slice(0, 3).forEach((result, i) => {
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

testWithForcedIterations();
