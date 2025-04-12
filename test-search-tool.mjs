// Brave Search APIを利用した検索ツールテスト
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { searchTool } from './lib/mastra/tools/search-tool.ts';

// 現在のファイルのディレクトリパスを取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// .env.localを読み込む
dotenv.config({ path: resolve(__dirname, '.env.local') });

async function testSearchTool() {
  console.log('検索ツールのテストを開始します...');
  
  // 環境変数の確認
  const apiKey = process.env.BRAVE_API_KEY;
  console.log(`BRAVE_API_KEY設定状況: ${apiKey ? '設定済み' : '未設定'}`);
  
  try {
    // テスト検索クエリ
    const testQuery = '生成AI 定義';
    console.log(`テスト検索クエリ: "${testQuery}"`);
    
    // 検索実行
    console.log('検索を実行中...');
    const results = await searchTool.execute({ context: { query: testQuery } });
    
    // 結果表示
    console.log('\n検索結果:');
    console.log(`クエリ: ${results.query}`);
    console.log(`結果件数: ${results.results.length}`);
    console.log(`タイムスタンプ: ${results.timestamp}`);
    
    // 最初の3件の結果を表示
    console.log('\n最初の3件の結果:');
    results.results.slice(0, 3).forEach((result, index) => {
      console.log(`\n[結果 ${index + 1}]`);
      console.log(`タイトル: ${result.title}`);
      console.log(`スニペット: ${result.snippet.substring(0, 100)}...`);
      console.log(`URL: ${result.url}`);
    });
    
    console.log('\nテスト完了!');
  } catch (error) {
    console.error('検索テスト中にエラーが発生しました:', error);
  }
}

// テスト実行
testSearchTool(); 