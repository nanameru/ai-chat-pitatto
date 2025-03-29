import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * 情報ギャップ特定ツール - 蓄積された情報から不足している情報を特定する
 * 
 * このツールは、セクションの焦点と蓄積された情報を分析し、不足している情報を特定します。
 */
export const gapIdentifier = createTool({
  id: "Gap Identifier",
  inputSchema: z.object({
    sectionId: z.string().describe("セクションID"),
    sectionName: z.string().describe("セクション名"),
    sectionPurpose: z.string().describe("セクションの目的"),
    sectionFocus: z.array(z.string()).describe("セクションの焦点"),
    accumulatedInformation: z.array(
      z.object({
        source: z.object({
          title: z.string().describe("情報源のタイトル"),
          url: z.string().describe("情報源のURL")
        }).describe("情報源"),
        content: z.string().describe("蓄積された情報の内容"),
        relevance: z.number().describe("関連性スコア"),
        timestamp: z.string().describe("蓄積時のタイムスタンプ")
      })
    ).describe("蓄積された情報"),
    requiredInformationTypes: z.array(z.string()).optional().describe("必要な情報タイプ（オプション）"),
  }),
  description: "蓄積された情報から不足している情報を特定します",
  execute: async ({ context: { sectionId, sectionName, sectionPurpose, sectionFocus, accumulatedInformation, requiredInformationTypes = [] } }) => {
    console.log(`情報ギャップ特定: セクション「${sectionName}」の不足情報を特定`);
    
    // 情報の充足度を評価
    const informationCoverage = evaluateInformationCoverage(
      accumulatedInformation,
      sectionFocus,
      requiredInformationTypes
    );
    
    // 不足情報の特定
    const missingInformation = identifyMissingInformation(
      informationCoverage,
      sectionFocus
    );
    
    // 信頼度スコアの計算
    const confidenceScore = calculateConfidenceScore(informationCoverage);
    
    return {
      sectionId,
      sectionName,
      informationCoverage,
      missingInformation,
      isInformationSufficient: missingInformation.length === 0,
      confidenceScore,
      timestamp: new Date().toISOString()
    };
  },
});

/**
 * 情報の充足度を評価する関数
 */
function evaluateInformationCoverage(
  accumulatedInformation: any[],
  sectionFocus: string[],
  requiredInformationTypes: string[]
): Record<string, number> {
  // 各焦点に対する情報の充足度を評価
  const coverage: Record<string, number> = {};
  
  // セクションの焦点ごとに充足度を評価
  sectionFocus.forEach(focus => {
    // 関連情報の数をカウント
    const relevantInfoCount = accumulatedInformation.filter(info => 
      info.content.toLowerCase().includes(focus.toLowerCase())
    ).length;
    
    // 充足度スコアを計算（0〜1の範囲）
    // 基本的には関連情報が3つ以上あれば十分と判断
    const scoreBase = Math.min(relevantInfoCount / 3, 1);
    
    // 情報の多様性も考慮（異なるURLからの情報があるかどうか）
    const uniqueUrls = new Set(
      accumulatedInformation
        .filter(info => info.content.toLowerCase().includes(focus.toLowerCase()))
        .map(info => info.source.url)
    ).size;
    
    const diversityBonus = Math.min(uniqueUrls / 2, 1) * 0.2;
    
    // 最終スコアを計算（多様性ボーナスを加算）
    coverage[focus] = Math.min(scoreBase + diversityBonus, 1);
  });
  
  // 必要な情報タイプがある場合は、それらの充足度も評価
  if (requiredInformationTypes.length > 0) {
    requiredInformationTypes.forEach(infoType => {
      const relevantInfoCount = accumulatedInformation.filter(info => 
        info.content.toLowerCase().includes(infoType.toLowerCase())
      ).length;
      
      coverage[infoType] = Math.min(relevantInfoCount / 2, 1);
    });
  }
  
  return coverage;
}

/**
 * 不足している情報を特定する関数
 */
function identifyMissingInformation(
  informationCoverage: Record<string, number>,
  sectionFocus: string[]
): string[] {
  const missingInformation: string[] = [];
  
  // 充足度が閾値（0.6）未満の焦点を不足情報として特定
  Object.entries(informationCoverage).forEach(([focus, score]) => {
    if (score < 0.6) {
      missingInformation.push(focus);
    }
  });
  
  // セクションの焦点に含まれていない不足情報を除外
  return missingInformation.filter(info => 
    sectionFocus.includes(info) || !sectionFocus.some(focus => info.includes(focus))
  );
}

/**
 * 情報の信頼度スコアを計算する関数
 */
function calculateConfidenceScore(informationCoverage: Record<string, number>): number {
  // すべての充足度スコアの平均を計算
  const scores = Object.values(informationCoverage);
  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  
  return averageScore;
}
