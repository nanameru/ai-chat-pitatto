/**
 * Tree of Thoughts (ToT) レポート生成ツール
 * 
 * 最終レポートの生成と最適化に関するツールを提供します。
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { FinalReport, ReportSection, ReportSource, IntegratedInsights } from "../../types/tot";
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

/**
 * レポート生成ツール
 * 
 * 統合された洞察から構造化レポートを生成します。
 */
export const reportGenerator = createTool({
  id: "Report Generator",
  inputSchema: z.object({
    integratedInsights: z.object({
      keyInsights: z.array(z.object({
        title: z.string(),
        description: z.string(),
        evidenceStrength: z.enum(["strong", "moderate", "weak"]),
        supportingFacts: z.array(z.string())
      })),
      narrativeStructure: z.object({
        approach: z.string(),
        mainSections: z.array(z.string())
      }),
      conclusions: z.array(z.object({
        statement: z.string(),
        confidenceLevel: z.enum(["high", "medium", "low"]),
        supportingEvidence: z.array(z.string()),
        limitations: z.array(z.string())
      }))
    }).describe("統合された洞察"),
    originalQuery: z.string().describe("元のクエリ"),
    evaluatedSources: z.array(z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
      reliability: z.enum(["high", "medium", "low"]).optional(),
      date: z.string().optional()
    })).optional().describe("評価済みの情報ソース（オプション）"),
    formatType: z.enum(["markdown", "html", "text"]).default("markdown").describe("レポートのフォーマット"),
  }),
  description: "統合された洞察から構造化レポートを生成します",
  execute: async ({ context: { integratedInsights, originalQuery, evaluatedSources, formatType } }) => {
    console.log(`[ToT] レポート生成: クエリ=${originalQuery.substring(0, 50)}..., フォーマット=${formatType}`);
    
    try {
      // Create the report generation agent
      const reportAgent = new Agent({
        name: "Report Generator Agent",
        instructions: `あなたはプロフェッショナルなレポート生成の専門家です。与えられた洞察と情報源に基づいて、包括的で構造化されたレポートを作成してください。
        レポートは以下の構造に従ってください：
        1. タイトル：クエリに基づいた明確で具体的なタイトル
        2. 要約：主要な発見と結論を簡潔にまとめた要約
        3. セクション：各セクションは適切な見出しを持ち、関連する洞察を論理的に整理して含む
        4. 情報源：使用した情報源の詳細リスト
        
        レポートの内容は事実に基づき、客観的であり、洞察の信頼性を反映したものにしてください。`,
        model: openai("gpt-4o-mini"),
      });
      
      // Prepare input data
      const insightsText = JSON.stringify(integratedInsights, null, 2);
      const sourcesText = evaluatedSources 
        ? JSON.stringify(evaluatedSources, null, 2) 
        : "情報源は提供されていません。";
      
      // Generate report content
      const prompt = `元のクエリ: "${originalQuery}"
      
統合された洞察:
${insightsText}

評価された情報源:
${sourcesText}

以上の情報を元に、包括的な構造化レポートを作成してください。`;

      const reportResult = await reportAgent.generate(prompt);
      
      // Process the report content
      const title = `${originalQuery}に関する包括的分析`;
      const summary = reportResult.text.substring(0, 300);
      
      // Create sections from the report content
      const sections: ReportSection[] = [];
      
      // Add overview section
      sections.push({
        title: "概要",
        content: summary
      });
      
      // Add main content section
      sections.push({
        title: "詳細分析",
        content: reportResult.text
      });
      
      // Add sources section
      const sources: ReportSource[] = evaluatedSources ? 
        evaluatedSources.map(source => ({
          title: source.title,
          url: source.url,
          accessedDate: source.date || new Date().toISOString().split('T')[0],
          reliability: source.reliability || 'medium'
        })) : [];
      
      // Create the final report
      const finalReport: FinalReport = {
        title,
        summary,
        sections,
        sources,
        generatedAt: new Date().toISOString()
      };
      
      // Format the report
      let reportText = "";
      if (formatType === "markdown") {
        reportText = generateMarkdownReport(finalReport);
      } else if (formatType === "html") {
        reportText = generateHtmlReport(finalReport);
      } else {
        reportText = generateTextReport(finalReport);
      }
      
      return {
        finalReport,
        reportText,
        formatType,
        originalQuery,
        timestamp: new Date().toISOString()
      };
    } catch (error: unknown) {
      console.error(`[ToT] レポート生成エラー:`, error);
      throw new Error(`レポート生成中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});

/**
 * マークダウン形式のレポートを生成する関数
 */
function generateMarkdownReport(report: FinalReport): string {
  let markdown = `# ${report.title}\n\n`;
  
  // 要約
  markdown += `## 概要\n${report.summary}\n\n`;
  
  // セクション
  for (const section of report.sections) {
    markdown += `## ${section.title}\n${section.content}\n\n`;
    
    // サブセクション
    if (section.subsections) {
      for (const subsection of section.subsections) {
        markdown += `### ${subsection.title}\n${subsection.content}\n\n`;
      }
    }
  }
  
  // 生成日時
  markdown += `---\n*このレポートは ${new Date(report.generatedAt).toLocaleString()} に生成されました。*\n`;
  
  return markdown;
}

/**
 * HTML形式のレポートを生成する関数
 */
function generateHtmlReport(report: FinalReport): string {
  let html = `<!DOCTYPE html>
<html>
<head>
  <title>${report.title}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #2c3e50; }
    h2 { color: #3498db; border-bottom: 1px solid #eee; padding-bottom: 5px; }
    h3 { color: #2980b9; }
    .summary { background-color: #f8f9fa; padding: 15px; border-left: 4px solid #3498db; margin-bottom: 20px; }
    .source { background-color: #f8f9fa; padding: 10px; margin-bottom: 10px; border-radius: 5px; }
    .footer { margin-top: 30px; font-size: 0.8em; color: #7f8c8d; text-align: center; }
  </style>
</head>
<body>
  <h1>${report.title}</h1>
  
  <div class="summary">
    <h2>概要</h2>
    <p>${report.summary}</p>
  </div>
`;
  
  // セクション
  for (const section of report.sections) {
    html += `  <h2>${section.title}</h2>
  <div>${section.content}</div>
`;
    
    // サブセクション
    if (section.subsections) {
      for (const subsection of section.subsections) {
        html += `  <h3>${subsection.title}</h3>
  <div>${subsection.content.replace(/\n/g, '<br>')}</div>
`;
      }
    }
  }
  
  // 生成日時
  html += `  <div class="footer">
    <p>このレポートは ${new Date(report.generatedAt).toLocaleString()} に生成されました。</p>
  </div>
</body>
</html>`;
  
  return html;
}

/**
 * プレーンテキスト形式のレポートを生成する関数
 */
function generateTextReport(report: FinalReport): string {
  let text = `${report.title.toUpperCase()}\n${'='.repeat(report.title.length)}\n\n`;
  
  // 要約
  text += `概要:\n${'-'.repeat(5)}\n${report.summary}\n\n`;
  
  // セクション
  for (const section of report.sections) {
    text += `${section.title.toUpperCase()}\n${'-'.repeat(section.title.length)}\n${section.content}\n\n`;
    
    // サブセクション
    if (section.subsections) {
      for (const subsection of section.subsections) {
        text += `${subsection.title}\n${'.'.repeat(subsection.title.length)}\n${subsection.content}\n\n`;
      }
    }
  }
  
  // 生成日時
  text += `\n\nこのレポートは ${new Date(report.generatedAt).toLocaleString()} に生成されました。\n`;
  
  return text;
}

/**
 * レポート最適化ツール
 * 
 * 生成されたレポートを最適化します。
 */
export const reportOptimizer = createTool({
  id: "Report Optimizer",
  inputSchema: z.object({
    reportText: z.string().describe("最適化するレポートテキスト"),
    formatType: z.enum(["markdown", "html", "text"]).default("markdown").describe("レポートのフォーマット"),
    optimizationGoals: z.array(z.enum([
      "readability", "conciseness", "visual_structure", "citation_quality", "all"
    ])).default(["all"]).describe("最適化の目標"),
  }),
  description: "生成されたレポートを最適化します",
  execute: async ({ context: { reportText, formatType, optimizationGoals } }) => {
    console.log(`[ToT] レポート最適化: フォーマット=${formatType}, 目標=${optimizationGoals.join(', ')}`);
    
    try {
      // Create optimization agent
      const optimizationAgent = new Agent({
        name: "Report Optimization Agent",
        instructions: `あなたはプロフェッショナルな文書編集者であり、レポートの最適化専門家です。与えられたレポートを指定された最適化目標に従って改善してください。
        
        以下の最適化目標を考慮してください：
        - readability（読みやすさ）: 専門用語の説明追加、長文の分割、アクティブボイスの使用
        - conciseness（簡潔さ）: 冗長な表現の削除、重複情報の統合、不要な修飾語の削除
        - visual_structure（視覚構造）: 見出しレベルの最適化、箇条書きリストの追加、段落の調整
        - citation_quality（引用品質）: 引用形式の統一、主張へのソース追加、信頼性の高いソースの優先`,
        model: openai("gpt-4o-mini"),
      });
      
      // Generate optimization instructions
      let optimizationInstructions = "レポートを最適化してください。";
      if (optimizationGoals.includes("all")) {
        optimizationInstructions += " すべての側面（読みやすさ、簡潔さ、視覚構造、引用品質）を最適化してください。";
      } else {
        optimizationInstructions += ` 以下の側面を最適化してください: ${optimizationGoals.join(', ')}。`;
      }
      
      // Generate optimized report
      const prompt = `${optimizationInstructions}
      
元のレポート:
${reportText}

最適化後のレポートを提供してください。`;

      const optimizationResult = await optimizationAgent.generate(prompt);
      const optimizedReportText = optimizationResult.text;
      
      // Track optimization changes
      const optimizationChanges: { [key: string]: string[] } = {
        readability: [],
        conciseness: [],
        visual_structure: [],
        citation_quality: []
      };
      
      // Add default changes for each requested optimization goal
      if (optimizationGoals.includes("all") || optimizationGoals.includes("readability")) {
        optimizationChanges.readability = ["専門用語の説明を追加", "長文を短く分割", "アクティブボイスを使用"];
      }
      
      if (optimizationGoals.includes("all") || optimizationGoals.includes("conciseness")) {
        optimizationChanges.conciseness = ["冗長な表現を削除", "重複情報を統合", "不要な修飾語を削除"];
      }
      
      if (optimizationGoals.includes("all") || optimizationGoals.includes("visual_structure")) {
        optimizationChanges.visual_structure = ["見出しレベルを最適化", "箇条書きリストを追加", "段落の長さを調整"];
      }
      
      if (optimizationGoals.includes("all") || optimizationGoals.includes("citation_quality")) {
        optimizationChanges.citation_quality = ["引用形式を統一", "主張にソースを追加", "信頼性の高いソースを優先"];
      }
      
      return {
        originalReportText: reportText,
        optimizedReportText,
        optimizationChanges,
        formatType,
        optimizationGoals,
        timestamp: new Date().toISOString()
      };
    } catch (error: unknown) {
      console.error(`[ToT] レポート最適化エラー:`, error);
      throw new Error(`レポート最適化中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});
