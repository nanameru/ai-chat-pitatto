/**
 * X API単体テストスクリプト
 *
 * 使用方法:
 *   npx ts-node scripts/test-x-api.ts [query] [max_results]
 *   - query: 検索クエリ（省略時は '生成AI'）
 *   - max_results: 最大取得数（省略時は 5）
 *
 * 必要な環境変数:
 *   NEXT_PUBLIC_X_API_KEY
 *   NEXT_PUBLIC_X_API_SECRET
 */

import 'dotenv/config';
import { searchTweets } from '../lib/mastra/tools/x-tool';

// コマンドライン引数: query, max_results
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