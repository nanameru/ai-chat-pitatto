import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * セクションコンテンツジェネレーターツール - 収集情報からセクション内容を生成する
 * 
 * このツールは、収集された情報を基にして、セクションの内容を生成します。
 */
export const sectionContentGenerator = createTool({
  id: "Section Content Generator",
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
  }),
  description: "収集された情報を基にして、セクションの内容を生成します",
  execute: async ({ context: { sectionId, sectionName, sectionPurpose, sectionFocus, accumulatedInformation } }) => {
    console.log(`セクション内容生成: セクション「${sectionName}」の内容を生成`);
    console.log(`蓄積情報数: ${accumulatedInformation.length}`);
    
    // 情報がない場合
    if (!accumulatedInformation || accumulatedInformation.length === 0) {
      return {
        sectionId,
        sectionName,
        content: generatePlaceholderContent(sectionName, sectionPurpose, sectionFocus),
        sources: [],
        isComplete: false,
        timestamp: new Date().toISOString(),
      };
    }
    
    // 蓄積された情報からセクション内容を生成
    const content = generateSectionContent(
      sectionName,
      sectionPurpose,
      sectionFocus,
      accumulatedInformation
    );
    
    // 使用した情報源を抽出
    const sources = extractSources(accumulatedInformation);
    
    return {
      sectionId,
      sectionName,
      content,
      sources,
      isComplete: true,
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * プレースホルダーコンテンツを生成する関数
 */
function generatePlaceholderContent(
  sectionName: string,
  sectionPurpose: string,
  sectionFocus: string[]
): string {
  return `## ${sectionName}

*注: このセクションは情報収集中です。以下は暫定的な内容です。*

### 目的
${sectionPurpose}

### 焦点
${sectionFocus.map(focus => `- ${focus}`).join('\n')}

### 暫定的な内容
このセクションでは、${sectionName}に関する情報を提供する予定です。主な焦点は、${sectionFocus.join('、')}です。
現在、情報収集中のため、詳細なコンテンツはまだ利用できません。
`;
}

/**
 * セクション内容を生成する関数
 */
function generateSectionContent(
  sectionName: string,
  sectionPurpose: string,
  sectionFocus: string[],
  accumulatedInformation: any[]
): string {
  // セクション名に基づいてコンテンツ構造を決定
  let content = `## ${sectionName}\n\n`;
  
  // 導入部分
  content += `${generateIntroduction(sectionName, sectionPurpose)}\n\n`;
  
  // 焦点ごとのサブセクション
  sectionFocus.forEach(focus => {
    content += `### ${focus}\n\n`;
    content += `${generateSubsectionContent(focus, accumulatedInformation)}\n\n`;
  });
  
  // まとめ
  content += `### まとめ\n\n`;
  content += `${generateSummary(sectionName, sectionFocus, accumulatedInformation)}\n\n`;
  
  return content;
}

/**
 * 導入部分を生成する関数
 */
function generateIntroduction(sectionName: string, sectionPurpose: string): string {
  return `${sectionPurpose} このセクションでは、${sectionName}に関する重要な側面を探ります。`;
}

/**
 * サブセクションの内容を生成する関数
 */
function generateSubsectionContent(focus: string, accumulatedInformation: any[]): string {
  // 焦点に関連する情報をフィルタリング
  const relevantInfo = accumulatedInformation.filter(info => 
    info.title.toLowerCase().includes(focus.toLowerCase()) || 
    info.content.toLowerCase().includes(focus.toLowerCase())
  );
  
  // 関連情報がない場合
  if (relevantInfo.length === 0) {
    return `${focus}に関する情報はまだ収集中です。`;
  }
  
  // 関連情報から内容を生成
  let content = '';
  
  // 最も関連性の高い情報を使用
  relevantInfo.sort((a, b) => b.relevance - a.relevance);
  
  // 上位3つの情報を使用
  const topInfo = relevantInfo.slice(0, Math.min(3, relevantInfo.length));
  
  topInfo.forEach(info => {
    content += `${info.content} `;
  });
  
  return content;
}

/**
 * まとめを生成する関数
 */
function generateSummary(sectionName: string, sectionFocus: string[], accumulatedInformation: any[]): string {
  // 情報の総数
  const infoCount = accumulatedInformation.length;
  
  // 関連性の高い情報の数
  const highRelevanceCount = accumulatedInformation.filter(info => info.relevance >= 8).length;
  
  return `このセクションでは、${sectionName}について、${sectionFocus.join('、')}の観点から探りました。
合計${infoCount}の情報源から情報を収集し、そのうち${highRelevanceCount}が高い関連性を持っていました。
これらの情報は、${sectionName}の理解を深め、その重要性と影響を把握するのに役立ちます。`;
}

/**
 * 情報源を抽出する関数
 */
function extractSources(accumulatedInformation: any[]): any[] {
  // 使用した情報源を抽出
  return accumulatedInformation.map(info => ({
    title: info.title,
    url: info.source,
    relevance: info.relevance
  }));
}
