require('dotenv').config({ path: '.env.local' });
require('ts-node/register');
const { searchTweets } = require('../lib/mastra/tools/x-tool.ts');

// 使用方法: node scripts/test-x-api.cjs [query] [max_results]
(async () => {
  const [,, rawQuery = '生成AI', rawMax = '5'] = process.argv;
  const query = rawQuery;
  const max_results = parseInt(rawMax, 10);
  console.log(`X API searchTweets 実行: query='${query}', max_results=${max_results}`);

  try {
    const result = await searchTweets(query, max_results);
    console.log('取得結果:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('X API呼び出しエラー:', error);
    process.exit(1);
  }
})(); 