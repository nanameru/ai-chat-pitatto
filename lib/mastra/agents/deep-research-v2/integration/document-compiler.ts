import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * ドキュメントコンパイラーツール - 各セクションのコンテンツを統合して最終的なドキュメントを生成する
 * 
 * このツールは、各セクションのコンテンツを統合して、一貫性のある最終的なドキュメントを生成します。
 */
export const documentCompiler = createTool({
  id: "Document Compiler",
  inputSchema: z.object({
    topic: z.string().describe("研究または文書の主題"),
    sections: z.array(z.object({
      sectionId: z.string(),
      sectionName: z.string(),
      content: z.string(),
      sources: z.array(
        z.object({
          title: z.string().describe("情報源のタイトル"),
          url: z.string().describe("情報源のURL")
        })
      ),
      isComplete: z.boolean(),
    })).describe("セクションコンテンツの配列"),
    includeSourcesSection: z.boolean().default(true).describe("情報源セクションを含めるかどうか"),
  }),
  description: "各セクションのコンテンツを統合して、一貫性のある最終的なドキュメントを生成します",
  execute: async ({ context: { topic, sections, includeSourcesSection } }) => {
    console.log(`ドキュメントコンパイル: トピック「${topic}」のドキュメントを生成`);
    console.log(`セクション数: ${sections.length}`);
    
    // セクションの順序を整理
    const orderedSections = orderSections(sections);
    
    // ドキュメントを生成
    const document = compileDocument(topic, orderedSections, includeSourcesSection);
    
    // ドキュメントの統計情報を生成
    const stats = generateDocumentStats(orderedSections);
    
    return {
      topic,
      document,
      stats,
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * セクションの順序を整理する関数
 */
function orderSections(sections: any[]): any[] {
  // セクションIDから番号を抽出してソート
  return [...sections].sort((a, b) => {
    const aMatch = a.sectionId.match(/section-(\d+)/);
    const bMatch = b.sectionId.match(/section-(\d+)/);
    
    if (aMatch && bMatch) {
      return Number.parseInt(aMatch[1]) - Number.parseInt(bMatch[1]);
    }
    
    return 0;
  });
}

/**
 * ドキュメントを生成する関数
 */
function compileDocument(
  topic: string,
  sections: any[],
  includeSourcesSection: boolean
): string {
  // タイトル
  let document = `# ${topic}\n\n`;
  
  // 目次
  document += `## 目次\n\n`;
  sections.forEach((section, index) => {
    document += `${index + 1}. [${section.sectionName}](#${section.sectionId})\n`;
  });
  if (includeSourcesSection) {
    document += `${sections.length + 1}. [情報源](#sources)\n`;
  }
  document += '\n';
  
  // 各セクションの内容
  sections.forEach(section => {
    // セクションIDをアンカーとして追加
    document += `<a id="${section.sectionId}"></a>\n\n`;
    document += section.content;
    document += '\n\n';
  });
  
  // 情報源セクション
  if (includeSourcesSection) {
    document += `<a id="sources"></a>\n\n`;
    document += `## 情報源\n\n`;
    
    // 全セクションの情報源を収集
    const allSources: any[] = [];
    sections.forEach(section => {
      if (section.sources && section.sources.length > 0) {
        section.sources.forEach((source: any) => {
          allSources.push({
            ...source,
            section: section.sectionName
          });
        });
      }
    });
    
    // 重複を排除
    const uniqueSources = removeDuplicateSources(allSources);
    
    // 情報源を表示
    uniqueSources.forEach((source, index) => {
      document += `${index + 1}. [${source.title}](${source.url}) - セクション: ${source.section}\n`;
    });
  }
  
  return document;
}

/**
 * 重複する情報源を排除する関数
 */
function removeDuplicateSources(sources: any[]): any[] {
  const uniqueUrls = new Set<string>();
  const uniqueSources: any[] = [];
  
  sources.forEach(source => {
    if (!uniqueUrls.has(source.url)) {
      uniqueUrls.add(source.url);
      uniqueSources.push(source);
    }
  });
  
  return uniqueSources;
}

/**
 * ドキュメントの統計情報を生成する関数
 */
function generateDocumentStats(sections: any[]): any {
  // 完了したセクションの数
  const completedSections = sections.filter(section => section.isComplete).length;
  
  // 総セクション数
  const totalSections = sections.length;
  
  // 完了率
  const completionRate = (completedSections / totalSections) * 100;
  
  // 情報源の総数
  let totalSources = 0;
  sections.forEach(section => {
    if (section.sources) {
      totalSources += section.sources.length;
    }
  });
  
  // ユニークな情報源の数
  const uniqueUrls = new Set<string>();
  sections.forEach(section => {
    if (section.sources) {
      section.sources.forEach((source: any) => {
        uniqueUrls.add(source.url);
      });
    }
  });
  
  return {
    totalSections,
    completedSections,
    completionRate: `${completionRate.toFixed(2)}%`,
    totalSources,
    uniqueSources: uniqueUrls.size,
  };
}
