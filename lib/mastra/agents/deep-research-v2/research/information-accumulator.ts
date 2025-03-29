import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * 情報蓄積ツール - 検索結果を蓄積し、整理する
 * 
 * このツールは、検索結果を蓄積し、セクションごとに整理します。
 * また、情報の重複を排除し、関連性に基づいて情報を整理します。
 */
export const informationAccumulator = createTool({
  id: "Information Accumulator",
  inputSchema: z.object({
    sectionId: z.string().describe("セクションID"),
    sectionName: z.string().describe("セクション名"),
    searchResults: z.array(z.object({
      title: z.string(),
      snippet: z.string(),
      url: z.string(),
    })).describe("検索結果"),
    existingInformation: z.array(
      z.object({
        source: z.object({
          title: z.string().describe("情報源のタイトル"),
          url: z.string().describe("情報源のURL")
        }).describe("情報源"),
        content: z.string().describe("蓄積された情報の内容"),
        relevance: z.number().describe("関連性スコア"),
        timestamp: z.string().describe("蓄積時のタイムスタンプ")
      })
    ).optional().describe("既存の蓄積情報（オプション）"),
  }),
  description: "検索結果を蓄積し、セクションごとに整理します",
  execute: async ({ context: { sectionId, sectionName, searchResults, existingInformation = [] } }) => {
    console.log(`情報蓄積: セクション「${sectionName}」の情報を蓄積`);
    console.log(`検索結果数: ${searchResults.length}`);
    
    // 既存の情報がある場合は、それを基に新しい情報を蓄積
    // ない場合は新しく情報を作成
    const accumulatedInformation = accumulateInformation(
      sectionId,
      sectionName,
      searchResults,
      existingInformation
    );
    
    return {
      sectionId,
      sectionName,
      accumulatedInformation,
      informationStats: generateInformationStats(accumulatedInformation),
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * 情報を蓄積する関数
 */
function accumulateInformation(
  sectionId: string,
  sectionName: string,
  searchResults: any[],
  existingInformation: any[]
): any[] {
  // 既存の情報がない場合は、検索結果から新しい情報を作成
  if (existingInformation.length === 0) {
    return searchResults.map((result, index) => ({
      id: `${sectionId}-info-${index + 1}`,
      sectionId,
      sectionName,
      title: result.title,
      content: result.snippet,
      source: result.url,
      relevance: calculateRelevance(result, sectionName),
      timestamp: new Date().toISOString(),
    }));
  }
  
  // 既存の情報がある場合は、重複を排除して新しい情報を追加
  const newInformation: any[] = [...existingInformation];
  const existingUrls = new Set(existingInformation.map(info => info.source));
  
  searchResults.forEach((result, index) => {
    // 重複するURLがない場合のみ追加
    if (!existingUrls.has(result.url)) {
      newInformation.push({
        id: `${sectionId}-info-${existingInformation.length + index + 1}`,
        sectionId,
        sectionName,
        title: result.title,
        content: result.snippet,
        source: result.url,
        relevance: calculateRelevance(result, sectionName),
        timestamp: new Date().toISOString(),
      });
      existingUrls.add(result.url);
    }
  });
  
  // 関連性でソート
  return newInformation.sort((a, b) => b.relevance - a.relevance);
}

/**
 * 検索結果の関連性を計算する関数
 */
function calculateRelevance(result: any, sectionName: string): number {
  // タイトルとスニペットにセクション名が含まれているかを確認
  const titleContainsSection = result.title.toLowerCase().includes(sectionName.toLowerCase());
  const snippetContainsSection = result.snippet.toLowerCase().includes(sectionName.toLowerCase());
  
  // 関連性スコアを計算（0-10のスケール）
  let relevanceScore = 5; // デフォルトの関連性
  
  if (titleContainsSection) {
    relevanceScore += 3; // タイトルにセクション名が含まれている場合
  }
  
  if (snippetContainsSection) {
    relevanceScore += 2; // スニペットにセクション名が含まれている場合
  }
  
  // スニペットの長さに基づいて調整
  const snippetLength = result.snippet.length;
  if (snippetLength > 300) {
    relevanceScore += 1; // 長いスニペットは詳細情報を含む可能性が高い
  } else if (snippetLength < 100) {
    relevanceScore -= 1; // 短いスニペットは情報が少ない可能性がある
  }
  
  // 最終スコアを0-10の範囲に制限
  return Math.max(0, Math.min(10, relevanceScore));
}

/**
 * 蓄積された情報の統計を生成する関数
 */
function generateInformationStats(accumulatedInformation: any[]): any {
  // 情報の数
  const count = accumulatedInformation.length;
  
  // 平均関連性
  const totalRelevance = accumulatedInformation.reduce((sum, info) => sum + info.relevance, 0);
  const averageRelevance = count > 0 ? totalRelevance / count : 0;
  
  // 関連性の高い情報（関連性8以上）の数
  const highRelevanceCount = accumulatedInformation.filter(info => info.relevance >= 8).length;
  
  // 情報源の数
  const uniqueSources = new Set(accumulatedInformation.map(info => info.source)).size;
  
  return {
    totalCount: count,
    averageRelevance: averageRelevance.toFixed(2),
    highRelevanceCount,
    uniqueSourcesCount: uniqueSources,
  };
}
