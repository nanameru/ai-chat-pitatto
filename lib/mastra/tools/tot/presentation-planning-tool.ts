/**
 * プレゼンテーションプランニングツール
 * 
 * ユーザーのクエリに基づいてプレゼンテーションの構成を計画します。
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * プレゼンテーションプランナーツール
 */
export const presentationPlannerTool = createTool({
  id: "Presentation Planner",
  inputSchema: z.object({
    query: z.string().describe("プレゼンテーションのテーマやトピック"),
    slideCount: z.number().min(3).max(15).default(5).describe("生成するスライドの数"),
    selectedModelId: z.string().optional().describe("ユーザーが選択したモデルID (OpenAI API互換名)"),
  }),
  description: "ユーザーのクエリに基づいてプレゼンテーションの構成を計画します",
  execute: async ({ context: { query, slideCount, selectedModelId } }) => {
    console.log(`[ToT] プレゼンテーション計画: クエリ=${query.substring(0, 50)}..., スライド数=${slideCount}, モデルID=${selectedModelId || 'default'}`);
    
    try {
      // API呼び出しを行うか、モックデータを生成するかを決定
      const useMockData = process.env.MOCK_PRESENTATION === 'true' || !process.env.GEMINI_API_KEY;
      
      if (useMockData) {
        console.log('[ToT] プレゼンテーション計画: モックデータを使用します');
        // モックのプラン生成
        return generateMockPlan(query, slideCount);
      } else {
        // Gemini APIキーの取得
        const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error('Gemini API key is not configured');
        }
        
        // プロンプトの作成
        const prompt = `あなたはプロフェッショナルなプレゼンテーション作成の専門家です。与えられたクエリに基づいて、高品質なプレゼンテーション計画を作成してください。

テーマ: "${query}"

このテーマに関する${slideCount}枚のスライドからなるプレゼンテーションの計画を作成してください。
各スライドのタイトル、主要なポイント、そして全体的なストーリーラインを含めてください。

【プレゼンテーションの構造】
以下の構造に従ってください：
1. タイトルスライド: テーマと簡潔な説明
2. アジェンダ/概要スライド: 主要なセクションの説明
3-${slideCount-2}. 内容スライド: テーマに関する重要なポイント
${slideCount-1}. 主要な発見/結論スライド: 重要なポイントのまとめ
${slideCount}. まとめと次のステップスライド: 全体のまとめと今後の展望

レスポンスは以下のJSON形式で返してください：

{
  "title": "プレゼンテーションのメインタイトル",
  "subtitle": "サブタイトル（あれば）",
  "slidePlans": [
    {
      "index": 1,
      "type": "title",
      "title": "タイトルスライドのタイトル",
      "keyPoints": ["キーポイント1", "キーポイント2"]
    },
    {
      "index": 2,
      "type": "agenda",
      "title": "アジェンダスライドのタイトル",
      "keyPoints": ["トピック1", "トピック2", "トピック3"]
    },
    // 内容スライド（3から${slideCount-2}まで）
    {
      "index": ${slideCount-1},
      "type": "conclusion",
      "title": "結論スライドのタイトル",
      "keyPoints": ["主な結論1", "主な結論2"]
    },
    {
      "index": ${slideCount},
      "type": "summary",
      "title": "まとめスライドのタイトル",
      "keyPoints": ["まとめポイント1", "次のステップ"]
    }
  ],
  "storyLine": "プレゼンテーション全体のストーリーラインの説明"
}`;

        console.log('[ToT] Gemini API呼び出し開始');
        
        // API呼び出し
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }]
          })
        });
        
        if (!response.ok) {
          const errorData = await response.text();
          console.error('[ToT] Gemini API エラー:', errorData);
          throw new Error(`Gemini API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        const resultText = data.candidates[0].content.parts[0].text || '';
        
        // JSONを抽出
        let jsonMatch = resultText.match(/```json\n([\s\S]*?)\n```/) || 
                        resultText.match(/```\n([\s\S]*?)\n```/) || 
                        resultText.match(/{[\s\S]*}/);
                        
        let planJson;
        if (jsonMatch) {
          try {
            planJson = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          } catch (e) {
            console.error('[ToT] JSON解析エラー:', e);
            // 正規表現で { から } までの範囲を取得して再試行
            const jsonRegex = /{[\s\S]*?}/g;
            const matches = resultText.match(jsonRegex);
            if (matches && matches.length > 0) {
              try {
                planJson = JSON.parse(matches[0]);
              } catch (e2) {
                console.error('[ToT] 2回目のJSON解析エラー:', e2);
                throw new Error('Failed to parse presentation plan from AI response');
              }
            }
          }
        } else {
          throw new Error('Could not extract JSON from AI response');
        }
        
        return {
          query,
          title: planJson.title,
          subtitle: planJson.subtitle,
          slideCount,
          slidePlans: planJson.slidePlans,
          storyLine: planJson.storyLine,
          generatedAt: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error(`[ToT] プレゼンテーション計画エラー:`, error);
      throw new Error(`プレゼンテーション計画中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});

/**
 * モックプランを生成する関数
 */
function generateMockPlan(query: string, slideCount: number = 5) {
  const actualSlideCount = Math.min(Math.max(slideCount || 5, 3), 15);
  
  const slidePlans = [];
  
  // タイトルスライド
  slidePlans.push({
    index: 1,
    type: "title",
    title: query,
    keyPoints: ["プレゼンテーションの概要", "著者情報"]
  });
  
  // アジェンダスライド
  slidePlans.push({
    index: 2,
    type: "agenda",
    title: "アジェンダ",
    keyPoints: ["背景", "現状分析", "主要ポイント", "結論と次のステップ"]
  });
  
  // 内容スライド
  for (let i = 3; i <= actualSlideCount - 2; i++) {
    const slideType = ["background", "analysis", "details", "examples", "insights"][i % 5];
    const slideTitle = `${query}の${['背景', '現状', '特徴', '課題', '事例', '分析', '効果', '方法', '将来性'][i % 9]}`;
    
    slidePlans.push({
      index: i,
      type: slideType,
      title: slideTitle,
      keyPoints: [
        `${slideTitle}に関するポイント1`,
        `${slideTitle}に関するポイント2`,
        `${slideTitle}に関するポイント3`
      ]
    });
  }
  
  // 結論スライド
  slidePlans.push({
    index: actualSlideCount - 1,
    type: "conclusion",
    title: "結論",
    keyPoints: [
      `${query}に関する主要な発見1`,
      `${query}に関する主要な発見2`,
      `${query}に関する主要な発見3`
    ]
  });
  
  // まとめスライド
  slidePlans.push({
    index: actualSlideCount,
    type: "summary",
    title: "まとめと次のステップ",
    keyPoints: [
      `${query}に関するまとめ`,
      "今後の展望",
      "推奨される次のステップ"
    ]
  });
  
  return {
    query,
    title: query,
    subtitle: "詳細分析と将来展望",
    slideCount: actualSlideCount,
    slidePlans,
    storyLine: `このプレゼンテーションでは、${query}の背景から始まり、現状分析を行い、主要な特徴や課題について詳しく説明します。その後、具体的な事例や効果を示し、最終的に結論と今後の展望を提示します。`,
    generatedAt: new Date().toISOString()
  };
} 