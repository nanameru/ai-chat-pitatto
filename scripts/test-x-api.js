/**
 * X API単体テストスクリプト (JavaScript版)
 *
 * 使用方法:
 *   node scripts/test-x-api.js [query] [max_results]
 *
 * 環境変数:
 *   NEXT_PUBLIC_X_API_KEY
 *   NEXT_PUBLIC_X_API_SECRET
 */

require('dotenv').config();
const { searchTweets } = require('../lib/mastra/tools/x-tool');

(async () => {
  const [, , rawQuery, rawMax] = process.argv;
  const query = rawQuery || '生成AI';
  const max_results = Number(rawMax) || 5;

  console.log(`X API searchTweets 実行: query='${query}', max_results=${max_results}`);
  try {
    const result = await searchTweets(query, max_results);
    console.log('取得結果:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('X API呼び出しエラー:', error);
    process.exit(1);
  }
})(); 