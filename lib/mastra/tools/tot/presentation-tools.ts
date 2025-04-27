/**
 * Tree of Thoughts (ToT) プレゼンテーション生成ツール
 * 
 * ユーザーのクエリに基づいてHTMLプレゼンテーションを生成するツールを提供します。
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * プレゼンテーション生成ツール
 * 
 * ユーザーのクエリに基づいて、HTMLプレゼンテーションを生成します。
 */
export const presentationTool = createTool({
  id: "Presentation Generator",
  inputSchema: z.object({
    query: z.string().describe("プレゼンテーションのテーマやトピック"),
    slideCount: z.number().min(3).max(15).default(5).describe("生成するスライドの数"),
    includeImagePlaceholders: z.boolean().default(true).describe("画像プレースホルダーを含めるかどうか"),
    selectedModelId: z.string().optional().describe("ユーザーが選択したモデルID (OpenAI API互換名)"),
  }),
  description: "ユーザーのクエリに基づいてHTMLプレゼンテーションを生成します",
  execute: async ({ context: { query, slideCount, includeImagePlaceholders, selectedModelId } }) => {
    console.log(`[ToT] プレゼンテーション生成: クエリ=${query.substring(0, 50)}..., スライド数=${slideCount}, 画像プレースホルダー=${includeImagePlaceholders}, モデルID=${selectedModelId || 'default (gemini-2.5-flash)'}`);
    console.log('[ToT] プレゼンテーションツール実行開始');
    
    try {
      // API呼び出しを行うか、モックデータを生成するかを決定
      // 環境変数MOCK_PRESENTATION=trueの場合はモックデータを使用
      const useMockData = process.env.MOCK_PRESENTATION === 'true' || !process.env.GEMINI_API_KEY;
      
      if (useMockData) {
        console.log('[ToT] プレゼンテーション生成: モックデータを使用します');
        
        // モックデータを生成
        const mockHtmlContent = generateMockPresentation(query, slideCount, includeImagePlaceholders);
        const slideTitles = extractSlideTitles(mockHtmlContent);
        
        return {
          query,
          htmlContent: mockHtmlContent,
          slideCount: slideTitles.length,
          slideTitles,
          generatedAt: new Date().toISOString()
        };
      } else {
        // Gemini APIキーの取得
        const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error('Gemini API key is not configured');
        }
        
        // プロンプトの作成
        const prompt = `あなたはプロフェッショナルなプレゼンテーション作成の専門家です。与えられたクエリに基づいて、高品質で情報量の多い、視覚的に洗練されたHTMLプレゼンテーションを作成してください。

テーマ: "${query}"

このテーマに関する${slideCount}枚のスライドからなる、プロフェッショナルで情報量の多い、視覚的に洗練されたプレゼンテーションを作成してください。このプレゼンテーションは、専門家が作成したような高品質なものである必要があります。
${includeImagePlaceholders ? '適切な場所に画像プレースホルダーを含めてください。' : '画像プレースホルダーは含めないでください。'}

【プレゼンテーションの内容について】
1. 正確で最新の情報を含める - 事実に基づいた内容を提供し、可能な限り具体的な数字、統計、引用を含めてください
2. 論理的な流れを持たせる - 各スライドが前のスライドから自然に続き、明確なストーリーラインを形成するようにしてください
3. 専門的な用語や概念を適切に説明する - 必要に応じて簡潔な定義や例を提供してください
4. 各ポイントを裏付ける具体例を含める - 理論だけでなく、実際の応用例や事例研究を含めてください

【プレゼンテーションの構造】
以下の構造に厳密に従ってください：
1. タイトルスライド:
   - 魅力的なタイトル
   - サブタイトルまたは簡潔な説明
   - 日付や発表者情報のプレースホルダー

2. アジェンダ/概要スライド:
   - プレゼンテーションの主要なセクションを明確に列挙
   - 各セクションの簡潔な説明

3-${slideCount-2}. 内容スライド: 以下のような多様なスライドタイプを含めてください
   - 問題提起スライド: 解決すべき課題や疑問を提示
   - 背景情報スライド: テーマの歴史的/理論的背景
   - データ分析スライド: 図表やグラフのプレースホルダーと説明
   - 比較分析スライド: 異なる視点や選択肢の比較
   - 事例研究スライド: 具体的な例と学んだ教訓
   - プロセス説明スライド: ステップバイステップの説明
   - 引用/証言スライド: 専門家の意見や重要な引用

${slideCount-1}. 主要な発見/結論スライド:
   - 最も重要な発見や結論を箇条書きで提示
   - 各ポイントの簡潔な説明

${slideCount}. まとめと次のステップスライド:
   - 主要なポイントの要約
   - 推奨される次のステップや行動計画
   - 質疑応答や連絡先情報のプレースホルダー

【視覚的デザインとHTML実装】
以下のHTML構造とスタイルを使用して、視覚的に洗練されたプレゼンテーションを作成してください：

1. 各スライドは以下の基本構造で作成：
\`\`\`html
<div class="slide" style="background: linear-gradient(135deg, #ffffff, #f5f9ff); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
  <h2 style="color: #0055aa; font-size: 2.5rem; text-align: center; margin-bottom: 30px; font-weight: 700; text-shadow: 1px 1px 2px rgba(0,0,0,0.1);">スライドタイトル</h2>
  
  <!-- スライドコンテンツはここに配置 -->
  
  <div class="slide-footer" style="position: absolute; bottom: 10px; right: 20px; font-size: 0.8rem; color: #666;">
    <span class="slide-number">スライド番号</span>
  </div>
</div>
\`\`\`

2. コンテンツ要素の例（これらを適切に組み合わせて使用）：

【箇条書きリスト - 重要ポイント用】
\`\`\`html
<ul style="font-size: 1.5rem; line-height: 1.6; margin-left: 20px;">
  <li style="margin-bottom: 15px; position: relative;">
    <span style="color: #0066cc; font-weight: 600;">📌 重要ポイント:</span>
    詳細な説明と具体例
  </li>
  <li style="margin-bottom: 15px; position: relative;">
    <span style="color: #0066cc; font-weight: 600;">🔑 重要ポイント:</span>
    詳細な説明と具体例
  </li>
</ul>
\`\`\`

【2カラムレイアウト - 比較や対照用】
\`\`\`html
<div style="display: flex; justify-content: space-between; margin-top: 20px; gap: 30px;">
  <div style="width: 48%; background-color: rgba(240,248,255,0.7); padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
    <h3 style="color: #0066cc; font-size: 1.8rem; margin-bottom: 15px; border-bottom: 2px solid #0066cc; padding-bottom: 5px;">左側の見出し</h3>
    <p style="font-size: 1.3rem; line-height: 1.5;">詳細な説明テキスト</p>
    <ul style="font-size: 1.2rem; margin-top: 10px;">
      <li>具体的なポイント</li>
      <li>具体的なポイント</li>
    </ul>
  </div>
  <div style="width: 48%; background-color: rgba(240,248,255,0.7); padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
    <h3 style="color: #0066cc; font-size: 1.8rem; margin-bottom: 15px; border-bottom: 2px solid #0066cc; padding-bottom: 5px;">右側の見出し</h3>
    <p style="font-size: 1.3rem; line-height: 1.5;">詳細な説明テキスト</p>
    <ul style="font-size: 1.2rem; margin-top: 10px;">
      <li>具体的なポイント</li>
      <li>具体的なポイント</li>
    </ul>
  </div>
</div>
\`\`\`

【引用ブロック - 重要な引用や証言用】
\`\`\`html
<blockquote style="background-color: rgba(240,248,255,0.7); padding: 20px; border-left: 5px solid #0066cc; margin: 20px 0; font-style: italic; font-size: 1.4rem; line-height: 1.6;">
  「${query}に関する重要な引用や洞察」
  <footer style="margin-top: 10px; font-size: 1.1rem; text-align: right; font-style: normal;">
    — <cite>専門家の名前や情報源</cite>
  </footer>
</blockquote>
\`\`\`

【プロセス/タイムライン - 順序や時系列の説明用】
\`\`\`html
<div class="timeline" style="margin: 30px 0;">
  <div class="timeline-item" style="display: flex; margin-bottom: 20px;">
    <div class="timeline-marker" style="min-width: 50px; height: 50px; background-color: #0066cc; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.2rem;">1</div>
    <div class="timeline-content" style="margin-left: 20px; padding: 10px; background-color: rgba(240,248,255,0.7); border-radius: 8px; flex-grow: 1;">
      <h3 style="color: #0066cc; margin-bottom: 10px; font-size: 1.5rem;">ステップ1のタイトル</h3>
      <p style="font-size: 1.2rem; line-height: 1.5;">ステップの詳細な説明</p>
    </div>
  </div>
  <div class="timeline-item" style="display: flex; margin-bottom: 20px;">
    <div class="timeline-marker" style="min-width: 50px; height: 50px; background-color: #0066cc; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.2rem;">2</div>
    <div class="timeline-content" style="margin-left: 20px; padding: 10px; background-color: rgba(240,248,255,0.7); border-radius: 8px; flex-grow: 1;">
      <h3 style="color: #0066cc; margin-bottom: 10px; font-size: 1.5rem;">ステップ2のタイトル</h3>
      <p style="font-size: 1.2rem; line-height: 1.5;">ステップの詳細な説明</p>
    </div>
  </div>
</div>
\`\`\`

【画像プレースホルダー - 視覚的要素用】
\`\`\`html
<div class="image-placeholder" style="background: linear-gradient(135deg, #e9ecef, #dde5f0); border: 2px dashed #6c757d; border-radius: 8px; height: 250px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 20px 0; color: #495057; font-size: 1.2rem; position: relative; overflow: hidden;">
  <div style="position: absolute; top: 0; left: 0; width: 100%; height: 30px; background-color: rgba(108, 117, 125, 0.2); display: flex; align-items: center; padding: 0 10px; font-size: 0.9rem;">
    画像プレースホルダー
  </div>
  <div style="margin-top: 20px; text-align: center; padding: 0 20px;">
    <p style="font-weight: 600; margin-bottom: 5px;">「${query}」に関連する画像:</p>
    <p>具体的な画像の説明（何を表しているか、なぜ重要か）</p>
  </div>
</div>
\`\`\`

【データ表示 - 数字や統計用】
\`\`\`html
<div class="data-highlight" style="display: flex; justify-content: space-around; margin: 30px 0;">
  <div class="data-item" style="text-align: center; padding: 20px; background-color: rgba(240,248,255,0.7); border-radius: 8px; width: 30%;">
    <div style="font-size: 1.5rem; color: #0066cc; margin-bottom: 5px;">📈</div>
    <div style="font-size: 2.5rem; font-weight: bold; color: #0066cc; margin-bottom: 10px;">85%</div>
    <div style="font-size: 1.2rem; color: #333;">統計や数字の説明</div>
  </div>
  <div class="data-item" style="text-align: center; padding: 20px; background-color: rgba(240,248,255,0.7); border-radius: 8px; width: 30%;">
    <div style="font-size: 1.5rem; color: #0066cc; margin-bottom: 5px;">🚀</div>
    <div style="font-size: 2.5rem; font-weight: bold; color: #0066cc; margin-bottom: 10px;">2.5x</div>
    <div style="font-size: 1.2rem; color: #333;">統計や数字の説明</div>
  </div>
  <div class="data-item" style="text-align: center; padding: 20px; background-color: rgba(240,248,255,0.7); border-radius: 8px; width: 30%;">
    <div style="font-size: 1.5rem; color: #0066cc; margin-bottom: 5px;">💰</div>
    <div style="font-size: 2.5rem; font-weight: bold; color: #0066cc; margin-bottom: 10px;">$1.2M</div>
    <div style="font-size: 1.2rem; color: #333;">統計や数字の説明</div>
  </div>
</div>
\`\`\`

【絵文字を使ったポイント強調】
\`\`\`html
<div style="background-color: rgba(240,248,255,0.7); padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="color: #0066cc; font-size: 1.8rem; margin-bottom: 15px; display: flex; align-items: center;">
    <span style="margin-right: 10px; font-size: 1.5rem;">💡</span> 重要なポイント
  </h3>
  <p style="font-size: 1.3rem; line-height: 1.5;">重要な情報や洞察の詳細な説明</p>
</div>

<div style="background-color: rgba(255,243,224,0.7); padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="color: #e67700; font-size: 1.8rem; margin-bottom: 15px; display: flex; align-items: center;">
    <span style="margin-right: 10px; font-size: 1.5rem;">⚠️</span> 注意点
  </h3>
  <p style="font-size: 1.3rem; line-height: 1.5;">注意すべき点や潜在的な課題の説明</p>
</div>

<div style="background-color: rgba(232,245,233,0.7); padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="color: #2e7d32; font-size: 1.8rem; margin-bottom: 15px; display: flex; align-items: center;">
    <span style="margin-right: 10px; font-size: 1.5rem;">✅</span> ベストプラクティス
  </h3>
  <p style="font-size: 1.3rem; line-height: 1.5;">推奨される方法や実践例の説明</p>
</div>
\`\`\`

3. 視覚的な一貫性と洗練さ：
- 一貫したカラースキームを使用（主に青系統のプロフェッショナルな色調）
- 適切な余白とスペーシングで読みやすさを確保
- 視覚的階層を明確にするためのフォントサイズと色の変化
- 重要な情報を強調するための視覚的要素（ボックス、境界線、背景色など）
- スライド番号や小さなブランディング要素の一貫した配置
- 適切な絵文字を使用して視覚的な魅力を高める

4. コンテンツの質と深さ：
- 各スライドには具体的で詳細な情報を含める
- 単なる見出しや短いフレーズではなく、完全な文や説明を提供
- 専門的な用語や概念を適切に使用し、必要に応じて簡潔に説明
- データや統計を含める場合は、その出所や重要性も説明

5. 絵文字の効果的な使用：
- 各セクションやポイントの冒頭に関連する絵文字を配置
- 箇条書きリストの各項目の前に適切な絵文字を使用
- 重要な数字やデータの横に関連する絵文字を配置
- タイトルやサブタイトルに関連する絵文字を追加して視覚的な魅力を高める
- 絵文字は過剰に使用せず、プロフェッショナルな印象を維持する
- 以下のような絵文字を適切に使い分ける：
  * 📊 📈 📉 - データや統計
  * 💡 💭 - アイデアやコンセプト
  * ✅ ❌ - 正誤や比較
  * ⚠️ ⚡ - 警告や注意点
  * 🔍 🔎 - 詳細や分析
  * 🎯 🏆 - 目標や成果
  * 📱 💻 🖥️ - テクノロジー関連
  * 🔄 ⏱️ - プロセスやタイミング
  * 📝 📚 - 情報や学習
  * 👥 👤 - 人物や顧客

各スライドにはインラインCSSを使用して、視覚的に魅力的で専門的なデザインを適用してください。レスポンシブデザインで、様々な画面サイズに対応できるようにしてください。`;

        // Gemini APIを呼び出し（リトライ機能付き）
        console.log('[ToT] Gemini API呼び出し開始');
        console.log('[ToT] APIキー確認:', apiKey ? 'APIキーあり' : 'APIキーなし');
        
        // リトライ設定
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 2000; // 2秒
        
        let response;
        let retryCount = 0;
        let lastError;
        
        while (retryCount < MAX_RETRIES) {
          try {
            if (retryCount > 0) {
              console.log(`[ToT] Gemini API 呼び出しリトライ (${retryCount}/${MAX_RETRIES})...`);
              // リトライ前に少し待機
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
            
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${apiKey}`, {
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
            
            console.log('[ToT] Gemini API呼び出し完了', { status: response.status, ok: response.ok });
            
            // 一時的なエラー（502, 503, 504）の場合はリトライ
            if (!response.ok && (response.status === 502 || response.status === 503 || response.status === 504)) {
              const errorData = await response.text();
              console.error(`[ToT] Gemini API 一時的なエラー (${response.status}):`, errorData);
              lastError = new Error(`Gemini API temporary error with status ${response.status}`);
              retryCount++;
              continue;
            }
            
            // その他のエラーの場合は即座に失敗
            if (!response.ok) {
              const errorData = await response.text();
              console.error('[ToT] Gemini API エラー:', errorData);
              throw new Error(`Gemini API request failed with status ${response.status}`);
            }
            
            // 成功した場合はループを抜ける
            break;
            
          } catch (error) {
            console.error(`[ToT] Gemini API 呼び出し例外 (${retryCount}/${MAX_RETRIES}):`, error);
            lastError = error;
            retryCount++;
            
            // 最大リトライ回数に達した場合は例外をスロー
            if (retryCount >= MAX_RETRIES) {
              throw new Error(`Gemini API request failed after ${MAX_RETRIES} retries: ${error.message}`);
            }
          }
        }
        
        // 最大リトライ回数に達した場合
        if (retryCount >= MAX_RETRIES) {
          console.error(`[ToT] Gemini API 最大リトライ回数(${MAX_RETRIES})に達しました`);
          throw lastError || new Error(`Gemini API request failed after ${MAX_RETRIES} retries`);
        }

        const data = await response.json();
        let htmlContent = data.candidates[0].content.parts[0].text || '';
        
        // If the response doesn't contain complete HTML, wrap it
        if (!htmlContent.includes('<!DOCTYPE html>')) {
          htmlContent = wrapWithHtmlTemplate(htmlContent, query);
        }
        
        // Parse the HTML to extract slide information
        const slideInfo = extractSlideTitles(htmlContent);
        
        return {
          query,
          htmlContent,
          slideCount: slideInfo.length,
          slideTitles: slideInfo,
          generatedAt: new Date().toISOString()
        };
      }
    } catch (error: unknown) {
      console.error(`[ToT] プレゼンテーション生成エラー:`, error);
      const errorMessage = `プレゼンテーション生成中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[ToT] ${errorMessage}`);
      throw new Error(errorMessage);
    } finally {
      console.log('[ToT] プレゼンテーションツール実行終了');
    }
  }
});

/**
 * HTMLコンテンツをHTMLテンプレートでラップする関数
 */
function wrapWithHtmlTemplate(content: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - プレゼンテーション</title>
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
    
    .slide h2 {
      font-size: 2.5rem;
      margin-bottom: 30px;
      color: #007bff;
      text-align: center;
    }
    
    .slide ul {
      font-size: 1.5rem;
      margin-bottom: 20px;
      padding-left: 30px;
    }
    
    .slide li {
      margin-bottom: 15px;
      line-height: 1.5;
    }
    
    .image-placeholder {
      background-color: #e9ecef;
      border: 2px dashed #6c757d;
      border-radius: 8px;
      height: 250px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 20px 0;
      color: #6c757d;
      font-size: 1.2rem;
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
      ${content}
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

/**
 * モックプレゼンテーションHTMLを生成する関数
 */
function generateMockPresentation(query: string, slideCount: number = 5, includeImagePlaceholders: boolean = true): string {
  const actualSlideCount = Math.min(Math.max(slideCount || 5, 3), 15);
  
  // スライドの内容を生成
  let slidesHtml = '';
  
  // タイトルスライド
  slidesHtml += `
    <div class="slide">
      <h2>${query}</h2>
      <p class="subtitle">プレゼンテーション</p>
      <p class="author">生成日: ${new Date().toLocaleDateString('ja-JP')}</p>
    </div>
  `;
  
  // 概要スライド
  slidesHtml += `
    <div class="slide">
      <h2>概要</h2>
      <ul>
        <li>このプレゼンテーションでは「${query}」について説明します</li>
        <li>主要なポイントと背景</li>
        <li>現状と課題</li>
        <li>今後の展望</li>
      </ul>
    </div>
  `;
  
  // 内容スライド
  for (let i = 3; i <= actualSlideCount - 1; i++) {
    const slideTitle = `${query}の${['背景', '現状', '特徴', '課題', '事例', '分析', '効果', '方法', '将来性', '展望', '戦略', '実装'][i % 12]}`;
    
    slidesHtml += `
      <div class="slide">
        <h2>${slideTitle}</h2>
        <ul>
          <li>ポイント ${i-2}.1: ${query}に関する重要な情報</li>
          <li>ポイント ${i-2}.2: 詳細な分析と考察</li>
          <li>ポイント ${i-2}.3: 具体的な事例や数値</li>
        </ul>
        ${includeImagePlaceholders ? `
        <div class="image-placeholder">
          ${slideTitle}に関する画像がここに表示されます
        </div>
        ` : ''}
      </div>
    `;
  }
  
  // まとめスライド
  slidesHtml += `
    <div class="slide">
      <h2>まとめ</h2>
      <ul>
        <li>${query}の重要性</li>
        <li>主要なポイントの振り返り</li>
        <li>今後の展望と課題</li>
      </ul>
    </div>
  `;
  
  // 完全なHTMLを生成
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${query} - プレゼンテーション</title>
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
    
    .slide h2 {
      font-size: 2.5rem;
      margin-bottom: 30px;
      color: #007bff;
      text-align: center;
    }
    
    .slide .subtitle {
      font-size: 1.5rem;
      text-align: center;
      margin-top: -20px;
      margin-bottom: 30px;
      color: #6c757d;
    }
    
    .slide .author {
      font-size: 1.2rem;
      text-align: center;
      margin-top: 30px;
      color: #6c757d;
    }
    
    .slide ul {
      font-size: 1.5rem;
      margin-bottom: 20px;
      padding-left: 30px;
    }
    
    .slide li {
      margin-bottom: 15px;
      line-height: 1.5;
    }
    
    .image-placeholder {
      background-color: #e9ecef;
      border: 2px dashed #6c757d;
      border-radius: 8px;
      height: 250px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 20px 0;
      color: #6c757d;
      font-size: 1.2rem;
      text-align: center;
      padding: 20px;
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

/**
 * HTMLからスライドタイトルを抽出する関数
 */
function extractSlideTitles(html: string): string[] {
  const titleRegex = /<h2>(.*?)<\/h2>/g;
  const titles: string[] = [];
  let match;
  
  while ((match = titleRegex.exec(html)) !== null) {
    titles.push(match[1]);
  }
  
  return titles;
}