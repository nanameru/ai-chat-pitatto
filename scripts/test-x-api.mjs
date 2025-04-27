#!/usr/bin/env node
// scripts/test-x-api.mjs
// X API 単体テスト (ESM)
// 実行: npx ts-node-esm scripts/test-x-api.mjs [query] [max_results]

import 'dotenv/config';
import { searchTweets } from '../lib/mastra/tools/x-tool.ts';

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