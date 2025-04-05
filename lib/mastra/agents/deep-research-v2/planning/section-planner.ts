import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * セクションプランナーツール - アウトラインからセクション構造を作成する
 * 
 * このツールは、アウトラインを基にして詳細なセクション構造を作成します。
 * 各セクションの目的、焦点、優先度を定義します。
 */
export const sectionPlanner = createTool({
  id: "Section Planner",
  inputSchema: z.object({
    topic: z.string().describe("研究または文書の主題"),
    outline: z.string().describe("文書のアウトライン"),
  }),
  description: "アウトラインを基にして詳細なセクション構造を作成します",
  execute: async ({ context: { topic, outline } }) => {
    console.log(`セクション計画: トピック「${topic}」のセクション構造を作成`);
    
    // アウトラインを解析してセクション構造を作成
    const sections = parseOutlineToSections(outline);
    
    return {
      topic,
      sections,
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * アウトラインを解析してセクション構造を作成する関数
 */
function parseOutlineToSections(outline: string): any[] {
  // アウトラインのテキストを行に分割
  const lines = outline.split('\n').filter(line => line.trim() !== '');
  
  const sections: any[] = [];
  let currentSection: any = null;
  let currentSubsections: any[] = [];
  
  // 各行を処理
  for (const line of lines) {
    // 見出しレベルを判定
    if (line.startsWith('# ')) {
      // タイトル行は無視
      continue;
    } else if (line.startsWith('## ')) {
      // 新しいセクションの開始
      if (currentSection) {
        // 前のセクションを保存
        sections.push({
          ...currentSection,
          subsections: currentSubsections
        });
      }
      
      // セクション番号と名前を抽出
      const sectionMatch = line.match(/## (\d+)\. (.+)/);
      if (sectionMatch) {
        const [, sectionNumber, sectionName] = sectionMatch;
        currentSection = {
          id: `section-${sectionNumber}`,
          number: Number.parseInt(sectionNumber),
          name: sectionName.trim(),
          purpose: generateSectionPurpose(sectionName),
          focus: generateSectionFocus(sectionName),
          priority: calculatePriority(Number.parseInt(sectionNumber))
        };
        currentSubsections = [];
      }
    } else if (line.startsWith('- ')) {
      // サブセクション（箇条書き）
      const subsectionName = line.substring(2).trim();
      currentSubsections.push({
        name: subsectionName,
        focus: generateSubsectionFocus(subsectionName)
      });
    }
  }
  
  // 最後のセクションを追加
  if (currentSection) {
    sections.push({
      ...currentSection,
      subsections: currentSubsections
    });
  }
  
  return sections;
}

/**
 * セクション名からセクションの目的を生成する関数
 */
function generateSectionPurpose(sectionName: string): string {
  // セクション名に基づいて目的を生成
  const purposeMap: Record<string, string> = {
    '導入': '読者にトピックの背景、重要性、主要な課題を紹介し、文書全体の方向性を示す',
    '定義と基本概念': '主要な用語を定義し、トピックの基本的な概念と歴史的背景を説明する',
    '現状分析': '最新の動向、事例、市場への影響を分析し、現在の状況を明らかにする',
    '技術的詳細': 'トピックの技術的側面、実装方法、性能について詳細に説明する',
    '課題と制限': '現在の課題、技術的制限、倫理的考慮事項を特定し分析する',
    '将来の展望': '今後の発展方向、潜在的な応用分野、研究機会について考察する',
    '結論': '主要な発見をまとめ、重要な洞察を提供し、最終的な考察を示す'
  };
  
  // セクション名に完全一致する場合はマップから取得
  if (sectionName in purposeMap) {
    return purposeMap[sectionName];
  }
  
  // 部分一致する場合
  for (const [key, purpose] of Object.entries(purposeMap)) {
    if (sectionName.includes(key)) {
      return purpose;
    }
  }
  
  // デフォルトの目的
  return `${sectionName}に関する重要な情報と洞察を提供する`;
}

/**
 * セクション名からセクションの焦点を生成する関数
 */
function generateSectionFocus(sectionName: string): string[] {
  // セクション名に基づいて焦点を生成
  const focusMap: Record<string, string[]> = {
    '導入': ['背景情報', '重要性', '主要な課題', '目的'],
    '定義と基本概念': ['用語定義', '歴史的背景', '基本フレームワーク'],
    '現状分析': ['最新動向', '事例研究', '市場影響', '経済効果'],
    '技術的詳細': ['基盤技術', '実装方法', '性能評価', '効率性'],
    '課題と制限': ['技術的課題', '制限要因', '倫理的問題', '解決策'],
    '将来の展望': ['将来予測', '発展方向', '応用可能性', '研究機会'],
    '結論': ['主要発見', '重要洞察', '最終考察', '今後の方向性']
  };
  
  // セクション名に完全一致する場合はマップから取得
  if (sectionName in focusMap) {
    return focusMap[sectionName];
  }
  
  // 部分一致する場合
  for (const [key, focus] of Object.entries(focusMap)) {
    if (sectionName.includes(key)) {
      return focus;
    }
  }
  
  // デフォルトの焦点
  return [`${sectionName}の基本概念`, `${sectionName}の重要性`, `${sectionName}の応用`];
}

/**
 * サブセクション名からサブセクションの焦点を生成する関数
 */
function generateSubsectionFocus(subsectionName: string): string {
  // サブセクション名に基づいて焦点を生成
  return `${subsectionName}に関する詳細な情報と具体例`;
}

/**
 * セクション番号から優先度を計算する関数
 */
function calculatePriority(sectionNumber: number): number {
  // セクション番号に基づいて優先度を計算（1-10のスケール）
  // 導入と結論は優先度が高い
  if (sectionNumber === 1 || sectionNumber === 7) {
    return 10;
  }
  
  // 定義と基本概念も優先度が高い
  if (sectionNumber === 2) {
    return 9;
  }
  
  // その他のセクションは中程度の優先度
  return 7;
}
