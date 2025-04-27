import { NextRequest, NextResponse } from 'next/server';
import { presentationTool } from '@/lib/mastra/tools';
import { initErrorReporting } from '@/lib/mastra/utils/errorHandling';

initErrorReporting();

export async function POST(request: NextRequest) {
  console.log('APIエンドポイント呼び出し開始');
  try {
    console.log('リクエストボディの解析開始');
    const body = await request.json();
    const { query, slideCount, includeImagePlaceholders, selectedModelId } = body;
    console.log('リクエストボディの解析完了', { query, slideCount, includeImagePlaceholders, selectedModelId });

    // バリデーション
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'クエリは必須で、文字列である必要があります' },
        { status: 400 }
      );
    }

    console.log('プレゼンテーション生成リクエスト:', { query, slideCount, includeImagePlaceholders });
    console.log('presentationToolを使用してプレゼンテーションを生成します');

    // ストリーミングレスポンスを返すかどうかのフラグ
    const useStreaming = true; // 各スライドごとにpresentationToolを呼び出すためにtrueに設定

    if (useStreaming) {
      // ストリーミングレスポンスを返す
      const encoder = new TextEncoder();
      const customStream = new TransformStream();
      const writer = customStream.writable.getWriter();

      // 非同期処理を開始
      (async () => {
        try {
          // HTMLヘッダーを送信（進捗バーを含む）
          const htmlHeader = `<!DOCTYPE html>
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
  </style>
</head>
<body>
  <div class="presentation-container">
    <div class="progress-container" style="position: fixed; top: 0; left: 0; width: 100%; background-color: #f1f1f1; z-index: 1000;">
      <div id="progress-bar" style="height: 30px; width: 0; background-color: #4CAF50; text-align: center; line-height: 30px; color: white;">0%</div>
    </div>
    
    <div class="generation-status" style="position: fixed; top: 40px; left: 0; width: 100%; padding: 10px; background-color: rgba(255,255,255,0.9); z-index: 999; text-align: center; font-size: 1.2rem; color: #333;">
      プレゼンテーションを生成中...
    </div>
    
    <div class="presentation">
      <div class="slide active">
        <h2 style="color: #0066cc; font-size: 2.5rem; text-align: center; margin-bottom: 30px;">プレゼンテーション生成中...</h2>
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px;">
          <div style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 50px; height: 50px; animation: spin 2s linear infinite; margin-bottom: 20px;"></div>
          <p style="font-size: 1.2rem; color: #666;">各スライドを個別に生成しています。しばらくお待ちください...</p>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </div>`;

          await writer.write(encoder.encode(htmlHeader));

          try {
            // スライドの種類を定義
            // スライドタイプの型定義
            interface SlideType {
              type: string;
              title: string;
              description: string;
              contentType?: string;
            }
            
            const slideTypes: SlideType[] = [
              { type: 'title', title: 'タイトルスライド', description: 'テーマの紹介と概要' },
              { type: 'agenda', title: 'アジェンダ', description: 'プレゼンテーションの内容の概要' }
            ];
            
            // 内容スライドを追加
            for (let i = 3; i <= slideCount - 1; i++) {
              const contentTypes = [
                'problem', 'background', 'data', 'comparison',
                'case-study', 'process', 'quote'
              ];
              slideTypes.push({
                type: 'content',
                title: `内容スライド ${i-2}`,
                description: `${contentTypes[(i-3) % contentTypes.length]} タイプのスライド`,
                contentType: contentTypes[(i-3) % contentTypes.length]
              });
            }
            
            // 結論スライドを追加
            slideTypes.push({ type: 'conclusion', title: '結論', description: '主要な発見や結論' });
            slideTypes.push({ type: 'summary', title: 'まとめ', description: '主要なポイントのまとめと次のステップ' });
            
            // 各スライドを生成
            let allSlidesContent = '';
            
            for (let i = 0; i < Math.min(slideCount, slideTypes.length); i++) {
              const slideType = slideTypes[i];
              console.log(`スライド ${i+1}/${slideCount} (${slideType.type}) を生成中...`);
              
              // 進捗状況を更新
              const progressPercent = Math.round((i / slideCount) * 100);
              await writer.write(encoder.encode(`
                <script>
                  document.getElementById('progress-bar').style.width = '${progressPercent}%';
                  document.getElementById('progress-bar').innerText = '${progressPercent}%';
                  document.querySelector('.generation-status').innerText = 'スライド ${i+1}/${slideCount} (${slideType.title}) を生成中...';
                </script>
              `));
              
              // スライド固有のプロンプトを作成
              let slidePrompt = `テーマ「${query}」に関する「${slideType.title}」スライドを1枚だけ生成してください。`;
              slidePrompt += `このスライドは${slideType.description}を表現するものです。`;
              
              // スライドタイプに応じた追加指示
              switch (slideType.type) {
                case 'title':
                  slidePrompt += `魅力的なタイトルとサブタイトル、簡潔な説明を含めてください。`;
                  break;
                case 'agenda':
                  slidePrompt += `プレゼンテーションの主要なセクションを明確に列挙し、各セクションの簡潔な説明を含めてください。`;
                  break;
                case 'content':
                  slidePrompt += `このスライドは「${slideType.contentType}」タイプのスライドです。`;
                  if (slideType.contentType === 'problem') {
                    slidePrompt += `解決すべき課題や疑問を提示してください。`;
                  } else if (slideType.contentType === 'background') {
                    slidePrompt += `テーマの歴史的/理論的背景を説明してください。`;
                  } else if (slideType.contentType === 'data') {
                    slidePrompt += `データ分析や図表の説明を含めてください。`;
                  } else if (slideType.contentType === 'comparison') {
                    slidePrompt += `異なる視点や選択肢の比較を行ってください。`;
                  } else if (slideType.contentType === 'case-study') {
                    slidePrompt += `具体的な例と学んだ教訓を含めてください。`;
                  } else if (slideType.contentType === 'process') {
                    slidePrompt += `ステップバイステップの説明を含めてください。`;
                  } else if (slideType.contentType === 'quote') {
                    slidePrompt += `専門家の意見や重要な引用を含めてください。`;
                  }
                  break;
                case 'conclusion':
                  slidePrompt += `最も重要な発見や結論を箇条書きで提示し、各ポイントの簡潔な説明を含めてください。`;
                  break;
                case 'summary':
                  slidePrompt += `主要なポイントの要約と推奨される次のステップや行動計画を含めてください。`;
                  break;
              }
              
              // 視覚的な指示を追加
              slidePrompt += `
視覚的に魅力的なスライドを作成し、適切な絵文字を使用してください。
スライドは1枚だけ生成し、<div class="slide">...</div>の形式で返してください。
${includeImagePlaceholders ? '適切な場所に画像プレースホルダーを含めてください。' : '画像プレースホルダーは含めないでください。'}
`;
              
              // presentationToolを使用して個別のスライドを生成
              try {
                // presentationToolを使用して個別のスライドを生成
                console.log(`スライド ${i+1} の生成開始`);
                // @ts-ignore - 型エラーを一時的に無視
                const slideResult = await presentationTool.execute({
                  context: {
                    query: slidePrompt,
                    slideCount: 1,
                    includeImagePlaceholders,
                    selectedModelId
                  }
                }) as {
                  htmlContent: string;
                  slideCount: number;
                  slideTitles: string[];
                };
                console.log(`スライド ${i+1} の生成完了`);
                
                // スライドコンテンツを抽出
                let slideContent = slideResult.htmlContent;
                const slideMatch = slideContent.match(/<div class="slide"[\s\S]*?<\/div>/);
                if (slideMatch) {
                  slideContent = slideMatch[0];
                }
                
                // スライド番号を追加
                slideContent = slideContent.replace(/<\/div>$/, `
                  <div class="slide-footer" style="position: absolute; bottom: 10px; right: 20px; font-size: 0.8rem; color: #666;">
                    <span class="slide-number">${i+1}/${slideCount}</span>
                  </div>
                </div>`);
                
                // 生成されたスライドを追加
                allSlidesContent += slideContent;
                
                // 生成されたスライドを即時表示
                await writer.write(encoder.encode(slideContent));
                
              } catch (slideError) {
                console.error(`スライド ${i+1} の生成中にエラーが発生しました:`, slideError);
                
                // エラーメッセージを表示
                const errorSlide = `
                <div class="slide">
                  <h2 style="color: #ff0000;">スライド ${i+1} の生成中にエラーが発生しました</h2>
                  <div style="background-color: #ffebee; padding: 20px; border-radius: 8px; border-left: 5px solid #f44336;">
                    <h3 style="color: #d32f2f; margin-top: 0;">エラー詳細</h3>
                    <p>${slideError instanceof Error ? slideError.message : String(slideError)}</p>
                  </div>
                  <div style="margin-top: 30px;">
                    <h3 style="color: #0066cc;">リカバリー中...</h3>
                    <p>次のスライドの生成を試みています。しばらくお待ちください。</p>
                  </div>
                </div>`;
                
                allSlidesContent += errorSlide;
                await writer.write(encoder.encode(errorSlide));
                
                // エラー通知を表示
                await writer.write(encoder.encode(`
                  <script>
                    // エラー通知を表示
                    const notification = document.createElement('div');
                    notification.style.position = 'fixed';
                    notification.style.top = '80px';
                    notification.style.right = '20px';
                    notification.style.backgroundColor = '#f44336';
                    notification.style.color = 'white';
                    notification.style.padding = '15px';
                    notification.style.borderRadius = '5px';
                    notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
                    notification.style.zIndex = '1000';
                    notification.innerHTML = 'スライド ${i+1} の生成中にエラーが発生しました。他のスライドの生成を続行します。';
                    document.body.appendChild(notification);
                    
                    // 5秒後に通知を消す
                    setTimeout(() => {
                      notification.style.opacity = '0';
                      notification.style.transition = 'opacity 0.5s';
                      setTimeout(() => notification.remove(), 500);
                    }, 5000);
                  </script>
                `));
              }
            }
            
            // 進捗を100%に設定
            await writer.write(encoder.encode(`
              <script>
                document.getElementById('progress-bar').style.width = '100%';
                document.getElementById('progress-bar').innerText = '100%';
                document.querySelector('.generation-status').innerText = 'プレゼンテーション生成完了！';
                
                // 3秒後に進捗バーと生成ステータスを非表示にする
                setTimeout(() => {
                  document.querySelector('.progress-container').style.display = 'none';
                  document.querySelector('.generation-status').style.display = 'none';
                }, 3000);
              </script>
            `));
          } catch (toolError) {
            console.error('presentationTool実行エラー:', toolError);
            await writer.write(encoder.encode(`
              <div class="slide">
                <h2 style="color: #ff0000;">エラーが発生しました</h2>
                <p>${toolError instanceof Error ? toolError.message : String(toolError)}</p>
              </div>
            `));
          }
          
          // HTMLフッターを送信
          const htmlFooter = `
    </div>
    
    <div class="controls">
      <button class="control-button prev-slide">&lt;</button>
      <button class="control-button next-slide">&gt;</button>
    </div>
  </div>
  
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // 最初のローディングスライドを削除
      const loadingSlide = document.querySelector('.slide.active');
      if (loadingSlide) {
        loadingSlide.remove();
      }
      
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
          
          await writer.write(encoder.encode(htmlFooter));
          await writer.close();
          
          console.log('プレゼンテーション生成成功（ストリーミング）');
          
        } catch (error) {
          console.error('ストリーミング処理エラー:', error);
          
          // エラーメッセージを送信
          const errorHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>エラー - プレゼンテーション生成</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      padding: 20px;
      color: #333;
      background-color: #f9f9f9;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
    }
    .error-container {
      max-width: 800px;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      padding: 30px;
      width: 100%;
    }
    .error-header {
      color: #d32f2f;
      border-bottom: 1px solid #eee;
      padding-bottom: 15px;
      margin-bottom: 20px;
      font-size: 1.8rem;
    }
    .error-message {
      background-color: #ffebee;
      padding: 20px;
      border-radius: 5px;
      border-left: 5px solid #f44336;
      margin-bottom: 20px;
      font-size: 1.1rem;
      line-height: 1.5;
    }
    .error-details {
      background-color: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      font-family: monospace;
      overflow-x: auto;
      margin-bottom: 20px;
    }
    .retry-button {
      background-color: #2196f3;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      font-size: 1.1rem;
      cursor: pointer;
      transition: background-color 0.3s;
    }
    .retry-button:hover {
      background-color: #0b7dda;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <h1 class="error-header">プレゼンテーション生成中にエラーが発生しました</h1>
    
    <div class="error-message">
      <p>プレゼンテーションの生成中に予期しないエラーが発生しました。お手数ですが、再試行するか、別のクエリで試してください。</p>
    </div>
    
    <h2>エラー詳細</h2>
    <div class="error-details">
      <code>${error instanceof Error ? error.message : String(error)}</code>
    </div>
    
    <button class="retry-button" onclick="window.location.href='/presentation-test'">検証ページに戻る</button>
  </div>
</body>
</html>`;
          
          await writer.write(encoder.encode(errorHtml));
          await writer.close();
        }
      })();

      // ストリーミングレスポンスを返す
      return new Response(customStream.readable, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    } else {
      // 通常のJSONレスポンスを返す（ストリーミングなし）
      console.log('非ストリーミングモードでプレゼンテーションを生成します');
      
      try {
        console.log('presentationTool.execute を呼び出します');
        // @ts-ignore - 型エラーを一時的に無視
        const result = await presentationTool.execute({
        context: {
          query,
          slideCount,
          includeImagePlaceholders,
          selectedModelId
        }
      }) as {
        htmlContent: string;
        slideCount: number;
        slideTitles: string[];
        generatedAt: string;
      };

        console.log('presentationTool.execute 呼び出し成功');
        console.log('プレゼンテーション生成成功:', {
          slideCount: result.slideCount,
          slideTitles: result.slideTitles.length,
          htmlContentLength: result.htmlContent.length
        });
        
        console.log('NextResponse.json を返します');
        return NextResponse.json(result);
      } catch (toolError) {
        console.error('presentationTool.execute 呼び出しエラー:', toolError);
        throw toolError; // 上位のエラーハンドラーに再スロー
      }
    }
  } catch (error) {
    console.error('プレゼンテーション生成エラー:', error);
    const errorMessage = `プレゼンテーション生成中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}