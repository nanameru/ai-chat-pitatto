import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * ドキュメント品質チェッカーツール - 生成されたドキュメントの品質を評価する
 * 
 * このツールは、生成されたドキュメントの品質を評価し、改善点を提案します。
 */
export const documentQualityChecker = createTool({
  id: "Document Quality Checker",
  inputSchema: z.object({
    topic: z.string().describe("研究または文書の主題"),
    document: z.string().describe("生成されたドキュメント"),
    sections: z.array(z.object({
      sectionId: z.string(),
      sectionName: z.string(),
      isComplete: z.boolean(),
    })).describe("セクション情報の配列"),
  }),
  description: "生成されたドキュメントの品質を評価し、改善点を提案します",
  execute: async ({ context: { topic, document, sections } }) => {
    console.log(`ドキュメント品質チェック: トピック「${topic}」のドキュメントを評価`);
    
    // ドキュメントの長さを確認
    const documentLength = document.length;
    console.log(`ドキュメント長: ${documentLength}文字`);
    
    // 品質評価を実行
    const qualityAssessment = assessDocumentQuality(document, sections);
    
    // 改善提案を生成
    const improvementSuggestions = generateImprovementSuggestions(qualityAssessment, sections);
    
    return {
      topic,
      qualityScore: calculateOverallScore(qualityAssessment),
      qualityAssessment,
      improvementSuggestions,
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * ドキュメントの品質を評価する関数
 */
function assessDocumentQuality(document: string, sections: any[]): any {
  // 各評価基準に基づいてドキュメントを評価
  
  // 完全性: すべてのセクションが完了しているか
  const completeness = {
    score: calculateCompletenessScore(sections),
    details: generateCompletenessDetails(sections)
  };
  
  // 一貫性: ドキュメント全体の一貫性
  const consistency = {
    score: calculateConsistencyScore(document),
    details: generateConsistencyDetails(document)
  };
  
  // 明確性: ドキュメントの明確さと理解しやすさ
  const clarity = {
    score: calculateClarityScore(document),
    details: generateClarityDetails(document)
  };
  
  // 情報の深さ: ドキュメントの情報の深さと詳細さ
  const informationDepth = {
    score: calculateInformationDepthScore(document),
    details: generateInformationDepthDetails(document)
  };
  
  // 構造: ドキュメントの構造と組織化
  const structure = {
    score: calculateStructureScore(document),
    details: generateStructureDetails(document)
  };
  
  return {
    completeness,
    consistency,
    clarity,
    informationDepth,
    structure
  };
}

/**
 * 完全性スコアを計算する関数
 */
function calculateCompletenessScore(sections: any[]): number {
  // 完了したセクションの割合に基づいてスコアを計算
  const completedSections = sections.filter(section => section.isComplete).length;
  const totalSections = sections.length;
  
  return (completedSections / totalSections) * 10;
}

/**
 * 完全性の詳細を生成する関数
 */
function generateCompletenessDetails(sections: any[]): string {
  const completedSections = sections.filter(section => section.isComplete);
  const incompleteSections = sections.filter(section => !section.isComplete);
  
  let details = `完了セクション: ${completedSections.length}/${sections.length}\n`;
  
  if (incompleteSections.length > 0) {
    details += '未完了セクション:\n';
    incompleteSections.forEach(section => {
      details += `- ${section.sectionName}\n`;
    });
  }
  
  return details;
}

/**
 * 一貫性スコアを計算する関数
 */
function calculateConsistencyScore(document: string): number {
  // 実際の実装では、文体や用語の一貫性を分析
  // ここではモックスコアを返す
  return 8.5;
}

/**
 * 一貫性の詳細を生成する関数
 */
function generateConsistencyDetails(document: string): string {
  // 実際の実装では、一貫性の問題を特定
  // ここではモックデータを返す
  return '文体と用語の使用は全体的に一貫しています。いくつかの小さな不一致がありますが、全体的な読みやすさには影響しません。';
}

/**
 * 明確性スコアを計算する関数
 */
function calculateClarityScore(document: string): number {
  // 実際の実装では、文の複雑さや専門用語の使用を分析
  // ここではモックスコアを返す
  return 7.8;
}

/**
 * 明確性の詳細を生成する関数
 */
function generateClarityDetails(document: string): string {
  // 実際の実装では、明確性の問題を特定
  // ここではモックデータを返す
  return 'ドキュメントは全体的に明確ですが、いくつかのセクションでは専門用語の説明が不足しています。読者の理解を助けるために、より多くの定義と例を提供することを検討してください。';
}

/**
 * 情報の深さスコアを計算する関数
 */
function calculateInformationDepthScore(document: string): number {
  // 実際の実装では、情報の詳細さと深さを分析
  // ここではモックスコアを返す
  return 7.2;
}

/**
 * 情報の深さの詳細を生成する関数
 */
function generateInformationDepthDetails(document: string): string {
  // 実際の実装では、情報の深さの問題を特定
  // ここではモックデータを返す
  return 'ドキュメントは基本的な情報を提供していますが、いくつかのセクションではより詳細な分析と具体例が必要です。特に技術的詳細と現状分析のセクションは、より深い情報が必要です。';
}

/**
 * 構造スコアを計算する関数
 */
function calculateStructureScore(document: string): number {
  // 実際の実装では、ドキュメントの構造と組織化を分析
  // ここではモックスコアを返す
  return 8.9;
}

/**
 * 構造の詳細を生成する関数
 */
function generateStructureDetails(document: string): string {
  // 実際の実装では、構造の問題を特定
  // ここではモックデータを返す
  return 'ドキュメントの構造は論理的で整理されています。目次、セクション見出し、サブセクションの使用は効果的です。ただし、いくつかのセクション間の遷移をより滑らかにすることで、全体的な流れを改善できます。';
}

/**
 * 全体的な品質スコアを計算する関数
 */
function calculateOverallScore(qualityAssessment: any): number {
  // 各評価基準のスコアの加重平均を計算
  const weights = {
    completeness: 0.25,
    consistency: 0.15,
    clarity: 0.20,
    informationDepth: 0.25,
    structure: 0.15
  };
  
  const weightedScore = 
    qualityAssessment.completeness.score * weights.completeness +
    qualityAssessment.consistency.score * weights.consistency +
    qualityAssessment.clarity.score * weights.clarity +
    qualityAssessment.informationDepth.score * weights.informationDepth +
    qualityAssessment.structure.score * weights.structure;
  
  return parseFloat(weightedScore.toFixed(1));
}

/**
 * 改善提案を生成する関数
 */
function generateImprovementSuggestions(qualityAssessment: any, sections: any[]): string {
  let suggestions = '## 改善提案\n\n';
  
  // 完全性に関する提案
  if (qualityAssessment.completeness.score < 10) {
    suggestions += '### 完全性の改善\n';
    suggestions += '- 未完了のセクションを完成させる\n';
    
    const incompleteSections = sections.filter(section => !section.isComplete);
    incompleteSections.forEach(section => {
      suggestions += `  - ${section.sectionName}セクションの情報を収集し、内容を生成する\n`;
    });
    
    suggestions += '\n';
  }
  
  // 一貫性に関する提案
  if (qualityAssessment.consistency.score < 9) {
    suggestions += '### 一貫性の改善\n';
    suggestions += '- 用語の使用を統一する\n';
    suggestions += '- 文体と表現を一貫させる\n';
    suggestions += '- セクション間の参照を確認し、矛盾がないようにする\n\n';
  }
  
  // 明確性に関する提案
  if (qualityAssessment.clarity.score < 8) {
    suggestions += '### 明確性の改善\n';
    suggestions += '- 専門用語に定義を追加する\n';
    suggestions += '- 複雑な概念に例を追加する\n';
    suggestions += '- 長い文を短く分割し、読みやすくする\n';
    suggestions += '- 図表や視覚的な要素を追加して理解を助ける\n\n';
  }
  
  // 情報の深さに関する提案
  if (qualityAssessment.informationDepth.score < 8) {
    suggestions += '### 情報の深さの改善\n';
    suggestions += '- より詳細な分析と具体例を追加する\n';
    suggestions += '- 特に技術的詳細と現状分析のセクションを強化する\n';
    suggestions += '- 異なる視点や意見を含める\n';
    suggestions += '- 最新の研究や動向に関する情報を追加する\n\n';
  }
  
  // 構造に関する提案
  if (qualityAssessment.structure.score < 9) {
    suggestions += '### 構造の改善\n';
    suggestions += '- セクション間の遷移をより滑らかにする\n';
    suggestions += '- 関連するトピックをグループ化する\n';
    suggestions += '- 重要なポイントを強調するためにフォーマットを改善する\n';
    suggestions += '- 長いセクションを分割して読みやすくする\n\n';
  }
  
  return suggestions;
}
