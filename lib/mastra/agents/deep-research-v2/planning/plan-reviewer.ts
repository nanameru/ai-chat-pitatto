import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * 計画レビューツール - セクション計画をレビューし、フィードバックに基づいて改善する
 * 
 * このツールは、セクション計画をレビューし、ユーザーのフィードバックに基づいて
 * 計画を改善します。
 */
export const planReviewer = createTool({
  id: "Plan Reviewer",
  inputSchema: z.object({
    topic: z.string().describe("研究または文書の主題"),
    sections: z.array(
      z.object({
        title: z.string().describe("セクションのタイトル"),
        content: z.string().optional().describe("セクションの内容の概要"),
        subsections: z.array(z.object({
          title: z.string().describe("サブセクションのタイトル"),
          content: z.string().optional().describe("サブセクションの内容の概要"),
        })).optional().describe("サブセクションのリスト"),
      })
    ).describe("セクション構造"),
    feedback: z.string().optional().describe("ユーザーからのフィードバック"),
  }),
  description: "セクション計画をレビューし、フィードバックに基づいて改善します",
  execute: async ({ context: { topic, sections, feedback } }) => {
    console.log(`計画レビュー: トピック「${topic}」の計画をレビュー`);
    
    if (feedback) {
      console.log(`ユーザーフィードバック: ${feedback}`);
      // フィードバックに基づいて計画を改善
      const improvedSections = improvePlanBasedOnFeedback(sections, feedback);
      
      return {
        topic,
        sections: improvedSections,
        reviewNotes: generateReviewNotes(improvedSections, feedback),
        wasImproved: true,
        timestamp: new Date().toISOString(),
      };
    }
    
    // フィードバックがない場合は、計画の評価のみを行う
    return {
      topic,
      sections,
      reviewNotes: generateReviewNotes(sections),
      wasImproved: false,
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * フィードバックに基づいて計画を改善する関数
 */
function improvePlanBasedOnFeedback(sections: any[], feedback: string): any[] {
  // 実際の実装では、フィードバックを分析して計画を改善
  // ここではモックデータを返す
  
  // フィードバックのキーワードに基づいて簡単な改善を行う
  const improvedSections = [...sections];
  
  // 「詳細」というキーワードがある場合、各セクションの目的をより詳細に
  if (feedback.includes('詳細')) {
    improvedSections.forEach(section => {
      section.purpose = section.purpose + '。より詳細な分析と具体例を含めます。';
    });
  }
  
  // 「技術」というキーワードがある場合、技術セクションの優先度を上げる
  if (feedback.includes('技術')) {
    improvedSections.forEach(section => {
      if (section.name.includes('技術')) {
        section.priority = Math.min(10, section.priority + 2);
      }
    });
  }
  
  // 「追加」というキーワードがある場合、新しいサブセクションを追加
  if (feedback.includes('追加')) {
    improvedSections.forEach(section => {
      section.subsections.push({
        name: '追加の考察',
        focus: '最新の研究と発展に関する追加の考察'
      });
    });
  }
  
  return improvedSections;
}

/**
 * 計画のレビューノートを生成する関数
 */
function generateReviewNotes(sections: any[], feedback?: string): string {
  // セクション構造を分析してレビューノートを生成
  let notes = '## 計画レビュー\n\n';
  
  // 全体的な評価
  notes += '### 全体的な評価\n';
  notes += `- セクション数: ${sections.length}\n`;
  notes += `- 構造の完全性: ${evaluateCompleteness(sections)}\n`;
  notes += `- 焦点の明確さ: ${evaluateClarity(sections)}\n\n`;
  
  // セクションごとの評価
  notes += '### セクションごとの評価\n';
  sections.forEach(section => {
    notes += `#### ${section.name}\n`;
    notes += `- 優先度: ${section.priority}/10\n`;
    notes += `- サブセクション数: ${section.subsections.length}\n`;
    notes += `- 推奨改善点: ${generateImprovementSuggestions(section)}\n\n`;
  });
  
  // フィードバックがある場合の対応
  if (feedback) {
    notes += '### フィードバックへの対応\n';
    notes += `- ユーザーフィードバック: "${feedback}"\n`;
    notes += `- 対応内容: ${generateFeedbackResponse(feedback)}\n\n`;
  }
  
  // 次のステップ
  notes += '### 次のステップ\n';
  notes += '1. 各セクションの検索クエリを生成\n';
  notes += '2. 検索結果を収集し分析\n';
  notes += '3. セクションごとのコンテンツを作成\n';
  
  return notes;
}

/**
 * セクション構造の完全性を評価する関数
 */
function evaluateCompleteness(sections: any[]): string {
  // セクション数に基づいて完全性を評価
  if (sections.length >= 7) {
    return '非常に高い（すべての重要な側面をカバー）';
  } else if (sections.length >= 5) {
    return '高い（主要な側面をカバー）';
  } else if (sections.length >= 3) {
    return '中程度（基本的な側面をカバー）';
  } else {
    return '低い（より多くのセクションが必要）';
  }
}

/**
 * セクション構造の明確さを評価する関数
 */
function evaluateClarity(sections: any[]): string {
  // 各セクションの目的と焦点の定義に基づいて明確さを評価
  let clarityScore = 0;
  
  sections.forEach(section => {
    // 目的が定義されている
    if (section.purpose && section.purpose.length > 20) {
      clarityScore += 1;
    }
    
    // 焦点が定義されている
    if (section.focus && section.focus.length > 0) {
      clarityScore += 1;
    }
    
    // サブセクションがある
    if (section.subsections && section.subsections.length > 0) {
      clarityScore += 1;
    }
  });
  
  // 平均スコアを計算
  const avgScore = clarityScore / (sections.length * 3);
  
  if (avgScore > 0.8) {
    return '非常に高い（目的と焦点が明確に定義されている）';
  } else if (avgScore > 0.6) {
    return '高い（ほとんどのセクションで目的と焦点が定義されている）';
  } else if (avgScore > 0.4) {
    return '中程度（いくつかのセクションで目的と焦点が不明確）';
  } else {
    return '低い（多くのセクションで目的と焦点の定義が必要）';
  }
}

/**
 * セクションの改善提案を生成する関数
 */
function generateImprovementSuggestions(section: any): string {
  const suggestions = [];
  
  // サブセクションが少ない場合
  if (section.subsections.length < 3) {
    suggestions.push('サブセクションを追加して内容を充実させる');
  }
  
  // 優先度が低い場合
  if (section.priority < 5) {
    suggestions.push('重要性を再評価し、必要に応じて優先度を上げる');
  }
  
  // 目的が短い場合
  if (section.purpose && section.purpose.length < 30) {
    suggestions.push('セクションの目的をより詳細に定義する');
  }
  
  // 提案がない場合
  if (suggestions.length === 0) {
    return '特になし（十分に定義されている）';
  }
  
  return suggestions.join('、');
}

/**
 * フィードバックへの対応を生成する関数
 */
function generateFeedbackResponse(feedback: string): string {
  // フィードバックのキーワードに基づいて対応を生成
  if (feedback.includes('詳細')) {
    return '各セクションの目的をより詳細に定義し、具体例を追加しました';
  }
  
  if (feedback.includes('技術')) {
    return '技術関連セクションの優先度を上げ、より詳細な技術情報を含めるようにしました';
  }
  
  if (feedback.includes('追加')) {
    return '各セクションに「追加の考察」サブセクションを追加し、最新の研究と発展に関する情報を含めるようにしました';
  }
  
  return 'フィードバックに基づいて計画を調整しました';
}
