#!/usr/bin/env node

/**
 * Deep Research連鎖検索エージェントのテストスクリプト
 * 
 * このスクリプトは、Deep Researchエージェントの動作をテストするためのものです。
 * コマンドライン引数として検索クエリを受け取り、エージェントに渡して結果を表示します。
 * 
 * 使用方法:
 * node test-deep-research.js "あなたの検索クエリ"
 */

// 環境変数の読み込み
require('dotenv').config();

// 必要なモジュールのインポート
const { deepResearchAgent, researchWorkflow } = require('../lib/mastra');

// コマンドライン引数の取得
const query = process.argv[2] || "量子コンピュータの最新の進展について教えてください";

console.log(`\n===== Deep Research連鎖検索エージェントテスト =====`);
console.log(`検索クエリ: "${query}"\n`);

// エージェントの直接呼び出し
async function testAgent() {
  console.log("1. エージェントを直接呼び出しています...\n");
  
  try {
    const startTime = Date.now();
    
    const response = await deepResearchAgent.invoke({
      messages: [
        {
          role: 'user',
          content: query
        }
      ]
    });
    
    const endTime = Date.now();
    const executionTime = (endTime - startTime) / 1000;
    
    console.log(`===== エージェントの応答 =====`);
    console.log(response.text);
    console.log(`\n実行時間: ${executionTime.toFixed(2)}秒`);
  } catch (error) {
    console.error("エージェントの呼び出し中にエラーが発生しました:", error);
  }
}

// ワークフローの呼び出し
async function testWorkflow() {
  console.log("\n2. ワークフローを呼び出しています...\n");
  
  try {
    const startTime = Date.now();
    
    const { runId, start } = researchWorkflow.createRun();
    console.log(`ワークフローの実行ID: ${runId}`);
    
    const runResult = await start({
      triggerData: { query }
    });
    
    const endTime = Date.now();
    const executionTime = (endTime - startTime) / 1000;
    
    console.log(`===== ワークフローの実行結果 =====`);
    console.log(`最終回答:`);
    console.log(runResult.results.resultIntegration.answer);
    
    console.log(`\n参考ソース:`);
    runResult.results.resultIntegration.sources.forEach((source, index) => {
      console.log(`${index + 1}. ${source}`);
    });
    
    console.log(`\n反復回数: ${runResult.results.followUpSearch.iterationCount}`);
    console.log(`実行時間: ${executionTime.toFixed(2)}秒`);
    
    // 詳細な実行結果（デバッグ用）
    if (process.env.DEBUG) {
      console.log("\n===== 詳細な実行結果 =====");
      console.log(JSON.stringify(runResult, null, 2));
    }
  } catch (error) {
    console.error("ワークフローの実行中にエラーが発生しました:", error);
  }
}

// メイン関数
async function main() {
  // エージェントのテスト
  await testAgent();
  
  // ワークフローのテスト
  await testWorkflow();
}

// スクリプトの実行
main().catch(error => {
  console.error("テスト実行中にエラーが発生しました:", error);
  process.exit(1);
});
