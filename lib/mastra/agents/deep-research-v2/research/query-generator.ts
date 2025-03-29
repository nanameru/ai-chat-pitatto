import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * クエリジェネレーターツール - セクションの焦点に基づいて検索クエリを生成する
 * 
 * このツールは、セクションの焦点と目的に基づいて効果的な検索クエリを生成します。
 */
export const queryGenerator = createTool({
  id: "Query Generator",
  inputSchema: z.object({
    topic: z.string().describe("研究または文書の主題"),
    sectionId: z.string().describe("セクションID"),
    sectionName: z.string().describe("セクション名"),
    sectionPurpose: z.string().describe("セクションの目的"),
    sectionFocus: z.array(z.string()).describe("セクションの焦点"),
    previousResults: z.array(
      z.object({
        query: z.string().describe("検索クエリ"),
        results: z.array(
          z.object({
            title: z.string().describe("検索結果のタイトル"),
            snippet: z.string().describe("検索結果のスニペット"),
            url: z.string().describe("検索結果のURL")
          })
        ).describe("検索結果のリスト")
      })
    ).optional().describe("以前の検索結果（オプション）"),
    missingInformation: z.array(z.string()).optional().describe("不足している情報（オプション）"),
  }),
  description: "セクションの焦点と目的に基づいて効果的な検索クエリを生成します",
  execute: async ({ context: { topic, sectionId, sectionName, sectionPurpose, sectionFocus, previousResults, missingInformation } }) => {
    console.log(`クエリ生成: セクション「${sectionName}」の検索クエリを生成`);
    
    // 初回検索の場合
    if (!previousResults || previousResults.length === 0) {
      const initialQueries = generateInitialQueries(topic, sectionName, sectionFocus);
      
      return {
        sectionId,
        sectionName,
        queries: initialQueries,
        queryRationale: generateQueryRationale(initialQueries, sectionFocus),
        isFollowUp: false,
        timestamp: new Date().toISOString(),
      };
    }
    
    // フォローアップ検索の場合
    const followUpQueries = generateFollowUpQueries(
      topic, 
      sectionName, 
      sectionFocus,
      missingInformation || []
    );
    
    return {
      sectionId,
      sectionName,
      queries: followUpQueries,
      queryRationale: generateQueryRationale(followUpQueries, sectionFocus, missingInformation),
      isFollowUp: true,
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * 初回検索用のクエリを生成する関数
 */
function generateInitialQueries(topic: string, sectionName: string, sectionFocus: string[]): string[] {
  // セクション名と焦点に基づいて初回検索クエリを生成
  const queries: string[] = [];
  
  // 基本クエリ: トピック + セクション名
  queries.push(`${topic} ${sectionName}`);
  
  // 焦点ごとのクエリ
  sectionFocus.forEach(focus => {
    queries.push(`${topic} ${sectionName} ${focus}`);
  });
  
  return queries;
}

/**
 * フォローアップ検索用のクエリを生成する関数
 */
function generateFollowUpQueries(
  topic: string, 
  sectionName: string, 
  sectionFocus: string[],
  missingInformation: string[]
): string[] {
  // 不足情報に基づいてフォローアップクエリを生成
  const queries: string[] = [];
  
  // 不足情報ごとのクエリ
  missingInformation.forEach(info => {
    queries.push(`${topic} ${sectionName} ${info}`);
  });
  
  // 不足情報がない場合は焦点に基づくクエリを生成
  if (queries.length === 0) {
    sectionFocus.forEach(focus => {
      queries.push(`${topic} ${sectionName} ${focus} 詳細 事例`);
    });
  }
  
  return queries;
}

/**
 * クエリの根拠を生成する関数
 */
function generateQueryRationale(
  queries: string[], 
  sectionFocus: string[], 
  missingInformation?: string[]
): string {
  let rationale = '## 検索クエリの根拠\n\n';
  
  // 各クエリの根拠を説明
  queries.forEach((query, index) => {
    rationale += `### クエリ ${index + 1}: "${query}"\n`;
    
    // 不足情報に基づくクエリの場合
    if (missingInformation && missingInformation.length > 0) {
      const relatedMissingInfo = missingInformation.find(info => query.includes(info));
      if (relatedMissingInfo) {
        rationale += `- 不足情報「${relatedMissingInfo}」に焦点を当てています\n`;
        rationale += `- この情報は前回の検索で十分にカバーされていませんでした\n`;
      }
    } 
    // 焦点に基づくクエリの場合
    else {
      const relatedFocus = sectionFocus.find(focus => query.includes(focus));
      if (relatedFocus) {
        rationale += `- セクションの焦点「${relatedFocus}」に関する情報を収集します\n`;
        rationale += `- この側面は文書の質と完全性に重要です\n`;
      } else {
        rationale += `- セクション全体の概要情報を収集します\n`;
        rationale += `- 基本的な情報と主要な概念を把握するために重要です\n`;
      }
    }
    
    rationale += '\n';
  });
  
  return rationale;
}
