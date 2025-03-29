import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * 検索反復管理ツール - 検索の反復を管理し、追加検索の必要性を判断する
 * 
 * このツールは、現在の反復回数、最大反復回数、不足情報、信頼度スコアに基づいて、
 * 追加検索を続けるべきかどうかを判断します。
 */
export const searchIterationManager = createTool({
  id: "Search Iteration Manager",
  inputSchema: z.object({
    sectionId: z.string().describe("セクションID"),
    sectionName: z.string().describe("セクション名"),
    currentIteration: z.number().describe("現在の反復回数"),
    maxIterations: z.number().default(3).describe("最大反復回数"),
    missingInformation: z.array(z.string()).describe("不足している情報"),
    confidenceScore: z.number().describe("情報の信頼度スコア（0〜1）")
  }),
  description: "検索の反復を管理し、追加検索の必要性を判断します",
  execute: async ({ context: { sectionId, sectionName, currentIteration, maxIterations, missingInformation, confidenceScore } }) => {
    console.log(`検索反復管理: セクション「${sectionName}」の追加検索判断（反復${currentIteration}/${maxIterations}）`);
    
    // 追加検索を続けるべきかどうかを判断
    const shouldContinue = determineIfShouldContinue(
      currentIteration,
      maxIterations,
      missingInformation,
      confidenceScore
    );
    
    // 判断理由を生成
    const reason = generateReason(
      shouldContinue,
      currentIteration,
      maxIterations,
      missingInformation,
      confidenceScore
    );
    
    return {
      sectionId,
      sectionName,
      currentIteration,
      maxIterations,
      shouldContinueSearch: shouldContinue,
      reason,
      timestamp: new Date().toISOString()
    };
  },
});

/**
 * 追加検索を続けるべきかどうかを判断する関数
 */
function determineIfShouldContinue(
  currentIteration: number,
  maxIterations: number,
  missingInformation: string[],
  confidenceScore: number
): boolean {
  // 最大反復回数に達した場合は終了
  if (currentIteration >= maxIterations) {
    return false;
  }
  
  // 不足情報がない場合は終了
  if (missingInformation.length === 0) {
    return false;
  }
  
  // 信頼度スコアが十分に高い場合は終了
  if (confidenceScore >= 0.8) {
    return false;
  }
  
  // 上記の条件に該当しない場合は追加検索を続行
  return true;
}

/**
 * 判断理由を生成する関数
 */
function generateReason(
  shouldContinue: boolean,
  currentIteration: number,
  maxIterations: number,
  missingInformation: string[],
  confidenceScore: number
): string {
  if (!shouldContinue) {
    if (currentIteration >= maxIterations) {
      return `最大反復回数（${maxIterations}回）に達したため、追加検索を終了します。`;
    }
    
    if (missingInformation.length === 0) {
      return "不足している情報がないため、追加検索は不要です。";
    }
    
    if (confidenceScore >= 0.8) {
      return `信頼度スコア（${confidenceScore.toFixed(2)}）が十分に高いため、追加検索は不要です。`;
    }
    
    return "十分な情報が収集されたため、追加検索を終了します。";
  } else {
    return `不足情報（${missingInformation.join(', ')}）があり、信頼度スコア（${confidenceScore.toFixed(2)}）が十分でないため、追加検索を続行します。`;
  }
}
