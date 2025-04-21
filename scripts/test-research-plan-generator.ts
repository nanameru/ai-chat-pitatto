#!/usr/bin/env ts-node
/* eslint-disable import/extensions */
import dotenv from 'dotenv';
// 環境変数を.env.localから読み込み、既存の環境変数を上書き
dotenv.config({ path: '.env.local', override: true });
import { researchPlanGenerator } from "../lib/mastra/tools/tot/planning-tools";

/**
 * researchPlanGenerator ツール単体テストスクリプト
 * 
 * 使用方法:
 * npx tsx scripts/test-research-plan-generator.ts <query>
 * 
 * 例:
 * npx tsx scripts/test-research-plan-generator.ts "AIの未来について調査したい"
 */
async function main() {
  // コマンドライン引数からクエリを取得
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("使用法: npx tsx scripts/test-research-plan-generator.ts <query>");
    console.error("例: npx tsx scripts/test-research-plan-generator.ts \"AIの未来について調査したい\"");
    process.exit(1);
  }

  const query = args[0];
  console.log(`[ToT Research] 詳細計画作成テスト: クエリ="${query}"`);

  try {
    // 選択された思考を模擬データとして用意
    // 実際のシステムでは、thoughtGenerator → thoughtEvaluator → pathSelector の流れで
    // 選択された思考が生成されます
    const selectedThought = {
      id: "sample-thought-id",
      content: "AIの未来に関する包括的な調査を行い、技術的進展、社会的影響、倫理的課題を分析します。",
      score: 0.95
    };

    if (!researchPlanGenerator || !researchPlanGenerator.execute) {
      throw new Error("researchPlanGenerator or its execute method is not defined");
    }
    
    console.log("[ToT Research] 詳細計画作成を実行中...");
    
    // researchPlanGenerator ツールを実行
    // @ts-ignore - ライブラリの型定義の変更に対応
    const result = await researchPlanGenerator.execute({
      context: {
        query,
        selectedThought,
        maxSubtopics: 5,  // サブトピックの最大数
        maxQueries: 3     // 検索クエリの最大数
      },
      // @ts-ignore - Container interfaceの完全実装を回避
      container: {
        registry: {},
        get: () => null as any,
        set: () => {},
        has: () => false
      }
    });
    
    // 結果を整形して出力
    console.log("[ToT Research] 詳細計画作成完了");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error during research plan generation:", error);
    process.exit(1);
  }
}

main();