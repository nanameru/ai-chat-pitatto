#!/usr/bin/env ts-node
/* eslint-disable import/extensions */
import dotenv from 'dotenv';
// 環境変数を.env.localから読み込み、既存の環境変数を上書き
dotenv.config({ path: '.env.local', override: true });
import { executeEnhancedPlanningPhase } from "../lib/mastra/agents/tot-research";
import { totConfig } from "../lib/mastra/config/totConfig";

/**
 * 強化された計画フェーズのテストスクリプト
 * 
 * 使用方法:
 * npx tsx scripts/test-enhanced-planning.ts <query> [maxDepth] [beamWidth]
 * 
 * 例:
 * npx tsx scripts/test-enhanced-planning.ts "AIの未来について調査したい" 3 3
 */
async function main() {
  // コマンドライン引数からクエリを取得
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("使用法: npx tsx scripts/test-enhanced-planning.ts <query> [maxDepth] [beamWidth]");
    console.error("例: npx tsx scripts/test-enhanced-planning.ts \"AIの未来について調査したい\" 3 3");
    process.exit(1);
  }

  const query = args[0];
  
  // オプションでBeamSearch設定を上書き
  if (args.length >= 2) {
    const maxDepth = parseInt(args[1], 10);
    if (!isNaN(maxDepth) && maxDepth > 0) {
      totConfig.maxDepth = maxDepth;
      console.log(`[Config] maxDepthを${maxDepth}に設定しました`);
    }
  }
  
  if (args.length >= 3) {
    const beamWidth = parseInt(args[2], 10);
    if (!isNaN(beamWidth) && beamWidth > 0) {
      totConfig.beamWidth = beamWidth;
      console.log(`[Config] beamWidthを${beamWidth}に設定しました`);
    }
  }
  
  console.log(`[ToT Research+] 強化計画フェーズテスト: クエリ="${query}"`);
  console.log(`[ToT Research+] 設定: maxDepth=${totConfig.maxDepth}, beamWidth=${totConfig.beamWidth}, branchingFactor=${totConfig.branchingFactor}`);

  try {
    console.time('ExecutionTime');
    
    // 強化計画フェーズを実行
    const result = await executeEnhancedPlanningPhase(query);
    
    console.timeEnd('ExecutionTime');
    
    // 結果の概要を出力
    console.log("\n[ToT Research+] 結果概要:");
    
    if (result.metadata?.beamSearchStats) {
      const stats = result.metadata.beamSearchStats;
      console.log(`探索ノード数: ${stats.nodesExplored}`);
      console.log(`最大到達深さ: ${stats.maxDepthReached}`);
      console.log(`最高スコア: ${stats.bestScore.toFixed(2)}`);
    }
    
    if (result.metadata?.researchPlan) {
      console.log("\n[ToT Research+] 研究計画:");
      console.log(`アプローチ: ${result.metadata.researchPlan.approach}`);
      
      console.log("\nサブトピック:");
      result.metadata.researchPlan.subtopics.forEach((topic: string, i: number) => {
        console.log(`${i+1}. ${topic}`);
      });
      
      console.log("\n検索クエリ:");
      result.metadata.researchPlan.queries.forEach((q: any, i: number) => {
        console.log(`${i+1}. ${q.query} (${q.purpose})`);
      });
    }
    
    if (result.reasoningSteps) {
      console.log(`\n[ToT Research+] 推論ステップ: ${result.reasoningSteps.length}件`);
      // 推論ステップのタイトルのみ表示
      result.reasoningSteps.forEach((step, i) => {
        console.log(`${i+1}. ${step.title}`);
      });
    }
    
    // エラーがあれば表示
    if (result.error) {
      console.error("\n[ToT Research+] エラー:", result.error);
    }
    
    // 詳細結果をファイルに保存（オプション）
    /*
    const fs = require('fs');
    fs.writeFileSync(
      `tot-result-${new Date().toISOString().replace(/:/g, '-')}.json`,
      JSON.stringify(result, null, 2)
    );
    */
  } catch (error) {
    console.error("Error during enhanced planning phase:", error);
    process.exit(1);
  }
}

main(); 