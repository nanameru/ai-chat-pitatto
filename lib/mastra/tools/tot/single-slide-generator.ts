/**
 * 単一スライド生成ツール
 * 
 * プレゼンテーションの単一スライドをHTML形式で生成します。
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * 単一スライド生成ツール
 */
export const singleSlideGeneratorTool = createTool({
  id: "Single Slide Generator",
  inputSchema: z.object({
    query: z.string().describe("プレゼンテーションのテーマやトピック"),
    slideIndex: z.number().min(1).describe("生成するスライドのインデックス"),
    slideType: z.string().describe("スライドのタイプ (title, agenda, content, conclusion, summary)"),
    slideTitle: z.string().describe("スライドのタイトル"),
    keyPoints: z.array(z.string()).describe("スライドの主要ポイント"),
    includeImagePlaceholders: z.boolean().default(true).describe("画像プレースホルダーを含めるかどうか"),
    storyLine: z.string().optional().describe("プレゼンテーション全体のストーリーライン"),
    selectedModelId: z.string().optional().describe("ユーザーが選択したモデルID"),
  }),
  description: "プレゼンテーションの単一スライドをHTML形式で生成します",
  execute: async ({ context }) => {
    const { query, slideIndex, slideType, slideTitle, keyPoints, includeImagePlaceholders, storyLine, selectedModelId } = context;
    
    console.log(`[ToT] 単一スライド生成: スライド=${slideIndex}, タイプ=${slideType}, タイトル=${slideTitle}`);
    
    try {
      // API呼び出しを行うか、モックデータを生成するかを決定
      const useMockData = process.env.MOCK_PRESENTATION === 'true' || !process.env.GEMINI_API_KEY;
      
      if (useMockData) {
        console.log('[ToT] 単一スライド生成: モックデータを使用します');
        return generateMockSlide(query, slideIndex, slideType, slideTitle, keyPoints, includeImagePlaceholders);
      } else {
        // Gemini APIキーの取得
        const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error('Gemini API key is not configured');
        }
        
        // プロンプトの作成
        const prompt = createSlidePrompt(query, slideIndex, slideType, slideTitle, keyPoints, includeImagePlaceholders, storyLine);
        
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
        let htmlContent = data.candidates[0].content.parts[0].text || '';
        
        // HTMLの抽出（コードブロック内にある場合）
        let htmlMatch = htmlContent.match(/```html\n([\s\S]*?)\n```/) ||
                        htmlContent.match(/```\n([\s\S]*?)\n```/) ||
                        htmlContent.match(/<div class="slide"[\s\S]*?<\/div>/);
        
        if (htmlMatch) {
          htmlContent = htmlMatch[1] || htmlMatch[0];
        }
        
        // 単一スライドのHTMLを返す
        return {
          query,
          slideIndex,
          slideType,
          slideTitle,
          htmlContent,
          generatedAt: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error(`[ToT] 単一スライド生成エラー:`, error);
      throw new Error(`単一スライド生成中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});

/**
 * スライド生成用のプロンプトを作成する関数
 */
function createSlidePrompt(
  query: string,
  slideIndex: number,
  slideType: string,
  slideTitle: string,
  keyPoints: string[],
  includeImagePlaceholders: boolean,
  storyLine?: string,
) {
  return `あなたはプロフェッショナルなプレゼンテーション作成の専門家です。与えられた情報に基づいて、高品質で視覚的に洗練されたプレゼンテーションの単一スライドをHTML形式で作成してください。

プレゼンテーションテーマ: "${query}"
スライド番号: ${slideIndex}
スライドタイプ: ${slideType}
スライドタイトル: "${slideTitle}"
主要ポイント: ${JSON.stringify(keyPoints)}
${storyLine ? `全体のストーリーライン: "${storyLine}"` : ''}
${includeImagePlaceholders ? '適切な場所に画像プレースホルダーを含めてください。' : '画像プレースホルダーは含めないでください。'}

【スライドタイプ別の特徴】
- title（タイトル）: メインタイトル、サブタイトル、著者情報などを含む最初のスライド
- agenda（アジェンダ）: プレゼンテーションの概要、主要トピックのリストを含むスライド
- background（背景）: トピックの背景情報、歴史、コンテキストを提供するスライド
- analysis（分析）: データ、統計、比較分析を含むスライド
- details（詳細）: トピックの詳細な説明や特徴を含むスライド
- examples（事例）: 具体的な例、ケーススタディを含むスライド
- insights（洞察）: トピックに関する深い洞察、考察を含むスライド
- conclusion（結論）: 主要な発見、結論を箇条書きで提示するスライド
- summary（まとめ）: 全体のまとめ、次のステップを含む最終スライド

【HTML要素の例】
以下のHTML構造とスタイルを参考にして、視覚的に洗練された単一スライドを作成してください：

スライドの基本構造:
\`\`\`html
<div class="slide" style="background: linear-gradient(135deg, #ffffff, #f5f9ff); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); padding: 40px; position: relative; height: 100%; display: flex; flex-direction: column; justify-content: center;">
  <h2 style="color: #0055aa; font-size: 2.5rem; text-align: center; margin-bottom: 30px; font-weight: 700; text-shadow: 1px 1px 2px rgba(0,0,0,0.1);">スライドタイトル</h2>
  
  <!-- スライドコンテンツはここに配置 -->
  
  <div class="slide-footer" style="position: absolute; bottom: 10px; right: 20px; font-size: 0.8rem; color: #666;">
    <span class="slide-number">スライド ${slideIndex}</span>
  </div>
</div>
\`\`\`

必要に応じて、以下のような要素を適切に組み合わせて使用してください：
- 箇条書きリスト
- 2カラムレイアウト
- 引用ブロック
- プロセス/タイムライン表示
- 画像プレースホルダー
- データ表示（数字や統計）
- 絵文字を使ったポイント強調

返答は必ず単一スライドのHTMLコードのみとしてください。コメントや説明は不要です。`;
}

/**
 * モックスライドを生成する関数
 */
function generateMockSlide(
  query: string,
  slideIndex: number,
  slideType: string,
  slideTitle: string,
  keyPoints: string[],
  includeImagePlaceholders: boolean
): any {
  let slideContent = '';
  
  // スライドタイプに応じたコンテンツを生成
  switch (slideType) {
    case 'title':
      slideContent = `
        <h2 style="color: #0055aa; font-size: 2.5rem; text-align: center; margin-bottom: 30px; font-weight: 700;">${slideTitle}</h2>
        <p class="subtitle" style="font-size: 1.5rem; text-align: center; margin-top: -20px; margin-bottom: 30px; color: #6c757d;">詳細分析と将来展望</p>
        <p class="author" style="font-size: 1.2rem; text-align: center; margin-top: 30px; color: #6c757d;">生成日: ${new Date().toLocaleDateString('ja-JP')}</p>
      `;
      break;
      
    case 'agenda':
      slideContent = `
        <h2 style="color: #0055aa; font-size: 2.5rem; text-align: center; margin-bottom: 30px; font-weight: 700;">${slideTitle}</h2>
        <ul style="font-size: 1.5rem; line-height: 1.6; margin-left: 20px;">
          ${keyPoints.map(point => `
            <li style="margin-bottom: 15px; position: relative;">
              <span style="color: #0066cc; font-weight: 600;">📌 ${point}</span>
            </li>
          `).join('')}
        </ul>
      `;
      break;
      
    case 'conclusion':
      slideContent = `
        <h2 style="color: #0055aa; font-size: 2.5rem; text-align: center; margin-bottom: 30px; font-weight: 700;">${slideTitle}</h2>
        <div class="data-highlight" style="display: flex; justify-content: space-around; margin: 30px 0;">
          ${keyPoints.map((point, index) => `
            <div class="data-item" style="text-align: center; padding: 20px; background-color: rgba(240,248,255,0.7); border-radius: 8px; width: 30%;">
              <div style="font-size: 1.5rem; color: #0066cc; margin-bottom: 5px;">📊</div>
              <div style="font-size: 1.2rem; color: #333;">${point}</div>
            </div>
          `).join('')}
        </div>
      `;
      break;
      
    case 'summary':
      slideContent = `
        <h2 style="color: #0055aa; font-size: 2.5rem; text-align: center; margin-bottom: 30px; font-weight: 700;">${slideTitle}</h2>
        <div style="background-color: rgba(232,245,233,0.7); padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2e7d32; font-size: 1.8rem; margin-bottom: 15px; display: flex; align-items: center;">
            <span style="margin-right: 10px; font-size: 1.5rem;">✅</span> まとめ
          </h3>
          <p style="font-size: 1.3rem; line-height: 1.5;">${keyPoints[0]}</p>
        </div>
        <div style="background-color: rgba(240,248,255,0.7); padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #0066cc; font-size: 1.8rem; margin-bottom: 15px; display: flex; align-items: center;">
            <span style="margin-right: 10px; font-size: 1.5rem;">🚀</span> 今後の展望
          </h3>
          <p style="font-size: 1.3rem; line-height: 1.5;">${keyPoints[1] || '今後の展望についてはさらなる調査が必要です。'}</p>
        </div>
      `;
      break;
      
    default:
      // 内容系スライド（background, analysis, details, examples, insights）
      slideContent = `
        <h2 style="color: #0055aa; font-size: 2.5rem; text-align: center; margin-bottom: 30px; font-weight: 700;">${slideTitle}</h2>
        <ul style="font-size: 1.5rem; line-height: 1.6; margin-left: 20px;">
          ${keyPoints.map((point, index) => `
            <li style="margin-bottom: 15px; position: relative;">
              <span style="color: #0066cc; font-weight: 600;">🔑 ${point}</span>
            </li>
          `).join('')}
        </ul>
        ${includeImagePlaceholders ? `
        <div class="image-placeholder" style="background: linear-gradient(135deg, #e9ecef, #dde5f0); border: 2px dashed #6c757d; border-radius: 8px; height: 250px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 20px 0; color: #495057; font-size: 1.2rem; position: relative; overflow: hidden;">
          <div style="position: absolute; top: 0; left: 0; width: 100%; height: 30px; background-color: rgba(108, 117, 125, 0.2); display: flex; align-items: center; padding: 0 10px; font-size: 0.9rem;">
            画像プレースホルダー
          </div>
          <div style="margin-top: 20px; text-align: center; padding: 0 20px;">
            <p style="font-weight: 600; margin-bottom: 5px;">「${slideTitle}」に関連する画像:</p>
            <p>具体的な画像の説明（何を表しているか、なぜ重要か）</p>
          </div>
        </div>
        ` : ''}
      `;
  }
  
  const htmlContent = `
    <div class="slide" style="background: linear-gradient(135deg, #ffffff, #f5f9ff); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); padding: 40px; position: relative; height: 100%; display: flex; flex-direction: column; justify-content: center;">
      ${slideContent}
      <div class="slide-footer" style="position: absolute; bottom: 10px; right: 20px; font-size: 0.8rem; color: #666;">
        <span class="slide-number">スライド ${slideIndex}</span>
      </div>
    </div>
  `;
  
  return {
    query,
    slideIndex,
    slideType,
    slideTitle,
    htmlContent,
    generatedAt: new Date().toISOString()
  };
} 