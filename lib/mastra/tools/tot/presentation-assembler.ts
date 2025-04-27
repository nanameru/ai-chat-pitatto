/**
 * プレゼンテーション組み立てツール
 * 
 * 個別のスライドを1つのHTMLプレゼンテーションに組み立てます。
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * プレゼンテーション組み立てツール
 */
export const presentationAssemblerTool = createTool({
  id: "Presentation Assembler",
  inputSchema: z.object({
    query: z.string().describe("プレゼンテーションのテーマやトピック"),
    title: z.string().describe("プレゼンテーションのタイトル"),
    subtitle: z.string().optional().describe("プレゼンテーションのサブタイトル"),
    slides: z.array(z.object({
      slideIndex: z.number(),
      slideType: z.string(),
      slideTitle: z.string(),
      htmlContent: z.string()
    })).describe("組み立てるスライドの配列"),
  }),
  description: "個別のスライドを1つのHTMLプレゼンテーションに組み立てます",
  execute: async ({ context: { query, title, subtitle, slides } }) => {
    console.log(`[ToT] プレゼンテーション組み立て: クエリ=${query.substring(0, 50)}..., スライド数=${slides.length}`);
    
    try {
      // スライドをインデックス順に並べ替え
      const sortedSlides = [...slides].sort((a, b) => a.slideIndex - b.slideIndex);
      
      // スライドのHTMLコンテンツを連結
      const slidesHtml = sortedSlides.map(slide => slide.htmlContent).join('\n');
      
      // 完全なHTMLプレゼンテーションを生成
      const htmlContent = wrapWithPresentationTemplate(slidesHtml, title, subtitle);
      
      // スライドタイトルを抽出
      const slideTitles = sortedSlides.map(slide => slide.slideTitle);
      
      return {
        query,
        title,
        subtitle,
        htmlContent,
        slideCount: slides.length,
        slideTitles,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`[ToT] プレゼンテーション組み立てエラー:`, error);
      throw new Error(`プレゼンテーション組み立て中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});

/**
 * HTMLコンテンツをプレゼンテーションテンプレートでラップする関数
 */
function wrapWithPresentationTemplate(slidesHtml: string, title: string, subtitle?: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}${subtitle ? ` - ${subtitle}` : ''}</title>
  <style>
    /* プレゼンテーション全体のスタイル */
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
      color: #333;
    }
    
    .presentation-container {
      max-width: 100%;
      margin: 0 auto;
      padding: 20px;
    }
    
    /* ナビゲーションコントロール */
    .controls {
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: flex;
      gap: 10px;
      z-index: 100;
    }
    
    .control-button {
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }
    
    .control-button:hover {
      background-color: #0056b3;
    }
    
    /* スライドのスタイル */
    .presentation {
      width: 100%;
      height: 100vh;
      overflow: hidden;
      position: relative;
    }
    
    .slide {
      width: 100%;
      height: 100vh;
      padding: 40px;
      box-sizing: border-box;
      display: none;
      flex-direction: column;
      justify-content: center;
      background-color: white;
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      border-radius: 8px;
      overflow-y: auto;
    }
    
    .slide.active {
      display: flex;
    }
    
    /* レスポンシブデザイン */
    @media (max-width: 768px) {
      .slide h2 {
        font-size: 1.8rem;
      }
      
      .slide ul {
        font-size: 1.2rem;
      }
      
      .image-placeholder {
        height: 180px;
      }
    }
    
    @media (max-width: 480px) {
      .slide {
        padding: 20px;
      }
      
      .slide h2 {
        font-size: 1.5rem;
        margin-bottom: 20px;
      }
      
      .slide ul {
        font-size: 1rem;
        padding-left: 20px;
      }
      
      .slide li {
        margin-bottom: 10px;
      }
      
      .image-placeholder {
        height: 150px;
        font-size: 1rem;
      }
      
      .control-button {
        width: 40px;
        height: 40px;
        font-size: 16px;
      }
    }
  </style>
</head>
<body>
  <div class="presentation-container">
    <div class="presentation">
      ${slidesHtml}
    </div>
    
    <div class="controls">
      <button class="control-button prev-slide">&lt;</button>
      <button class="control-button next-slide">&gt;</button>
    </div>
  </div>
  
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const slides = document.querySelectorAll('.slide');
      let currentSlide = 0;
      
      // 最初のスライドをアクティブにする
      if (slides.length > 0) {
        slides[0].classList.add('active');
      }
      
      // 前のスライドに移動
      document.querySelector('.prev-slide').addEventListener('click', function() {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide - 1 + slides.length) % slides.length;
        slides[currentSlide].classList.add('active');
      });
      
      // 次のスライドに移動
      document.querySelector('.next-slide').addEventListener('click', function() {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
      });
      
      // キーボードナビゲーション
      document.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowLeft') {
          document.querySelector('.prev-slide').click();
        } else if (e.key === 'ArrowRight') {
          document.querySelector('.next-slide').click();
        }
      });
    });
  </script>
</body>
</html>`;
} 