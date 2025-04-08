import deepResearchAgentV2 from './lib/mastra/agents/deep-research-v2';
import { config } from 'dotenv';
import * as path from 'node:path';
import * as fs from 'node:fs';

// .env.local ファイルから環境変数をロード
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  config({ path: envLocalPath });
  console.log('.env.local ファイルをロードしました');
} else {
  console.log('.env.local ファイルが見つかりません');
  config(); // 通常の .env ファイルをロード
}

// API キーが設定されているか確認
if (!process.env.OPENAI_API_KEY) {
  console.error("エラー: OPENAI_API_KEY 環境変数が設定されていません。");
  process.exit(1);
} else {
  console.log("OPENAI_API_KEY が設定されています");
}

async function main() {
  try {
    console.log("Deep Research Agent V2 を実行中...");
    console.log("クエリ: 生成AIについて教えて");
    
    const response = await deepResearchAgentV2.generate("生成AIについて教えて");
    
    console.log("\n=== 応答オブジェクト ===\n");
    console.log(JSON.stringify(response, null, 2));
    
    console.log("\n=== 結果 ===\n");
    // response.content が undefined の場合は response.text を使用
    const content = response.content || response.text || JSON.stringify(response);
    console.log(content);
  } catch (error) {
    console.error("エラーが発生しました:", error);
  }
}

main();
