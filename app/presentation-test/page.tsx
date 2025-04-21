'use client';

import React, { useState, useRef } from 'react';

export default function PresentationTestPage() {
  const [query, setQuery] = useState('');
  const [slideCount, setSlideCount] = useState(5);
  const [includeImagePlaceholders, setIncludeImagePlaceholders] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [presentationResult, setPresentationResult] = useState<{
    query: string;
    htmlContent: string;
    slideCount: number;
    slideTitles: string[];
    generatedAt: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // iframeの内容を更新する関数
  const updateIframeContent = (htmlContent: string) => {
    console.log('iframeにHTMLコンテンツを設定開始');
    if (iframeRef.current) {
      console.log('iframeRef.current が存在します');
      const iframeDocument = iframeRef.current.contentDocument;
      if (iframeDocument) {
        console.log('iframeDocument が存在します');
        try {
          iframeDocument.open();
          console.log('iframeDocument.open() 成功');
          iframeDocument.write(htmlContent);
          console.log('iframeDocument.write() 成功');
          iframeDocument.close();
          console.log('iframeDocument.close() 成功');
        } catch (iframeError) {
          console.error('iframe操作エラー:', iframeError);
          setError(`iframeへのコンテンツ設定に失敗しました: ${iframeError instanceof Error ? iframeError.message : String(iframeError)}`);
        }
      } else {
        console.error('iframeDocument が取得できませんでした');
        setError('iframeDocument が取得できませんでした');
      }
    } else {
      console.error('iframeRef.current が存在しません');
      setError('iframeRef.current が存在しません');
    }
    console.log('iframeにHTMLコンテンツを設定完了');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('フォーム送信開始');
    
    if (!query.trim()) {
      setError('クエリを入力してください');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('APIリクエスト送信開始', { query, slideCount, includeImagePlaceholders });
      // ストリーミングモードでプレゼンテーションを生成
      const response = await fetch('/api/presentation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          slideCount,
          includeImagePlaceholders
        }),
      });

      console.log('APIレスポンス受信', { status: response.status, ok: response.ok });
      
      // エラーチェックはステータスコードのみで行う
      if (!response.ok) {
        const statusText = response.statusText || '予期しないエラーが発生しました';
        console.error('APIエラー', { status: response.status, statusText });
        throw new Error(`サーバーエラー (${response.status}): ${statusText}`);
      }

      // レスポンスの種類を確認
      const contentType = response.headers.get('Content-Type') || '';
      console.log('レスポンスのContent-Type:', contentType);
      
      if (contentType.includes('text/html')) {
        console.log('HTMLストリーミングレスポンスとして処理');
        console.log('Content-Type:', contentType);
        // HTMLストリーミングレスポンスの場合
        
        // 空のプレゼンテーション結果を設定（タイトルなどの情報はないが、UIを更新するため）
        setPresentationResult({
          query,
          htmlContent: '',
          slideCount: 0,
          slideTitles: [],
          generatedAt: new Date().toISOString()
        });
        
        // setTimeout を使用して、DOMの更新後にストリーミング処理を開始
        console.log('DOMの更新を待機します...');
        setTimeout(async () => {
          console.log('iframeにストリーミングコンテンツを表示開始');
          if (!iframeRef.current) {
            console.error('iframeRef.current が存在しません (ストリーミングモード)');
            setError('iframeRef.current が存在しません (ストリーミングモード)');
            return;
          }
          
          const reader = response.body?.getReader();
          if (!reader) {
            console.error('reader が取得できませんでした');
            setError('reader が取得できませんでした');
            return;
          }
          
          console.log('reader が取得できました');
          const decoder = new TextDecoder();
          let html = '';
          
          // iframeのdocumentを取得
          const iframeDocument = iframeRef.current.contentDocument;
          if (!iframeDocument) {
            console.error('iframeDocument が取得できませんでした');
            setError('iframeDocument が取得できませんでした');
            return;
          }
          
          console.log('iframeDocument が取得できました');
          try {
            iframeDocument.open();
            console.log('iframeDocument.open() 成功');
              
            // ストリーミングデータを処理
            let chunkCount = 0;
            while (true) {
              console.log(`チャンク読み込み開始 (${chunkCount})`);
              const { done, value } = await reader.read();
              if (done) {
                console.log('ストリーミング完了');
                break;
              }
              
              const chunk = decoder.decode(value, { stream: true });
              html += chunk;
              console.log(`チャンク ${chunkCount} 受信: ${chunk.length}文字`);
              
              // チャンクごとにiframeを更新
              iframeDocument.write(chunk);
              console.log(`チャンク ${chunkCount} をiframeに書き込み完了`);
              chunkCount++;
            }
            
            iframeDocument.close();
            console.log('iframeDocument.close() 成功');
            
            // スライドタイトルを抽出（完了後）
            const titleRegex = /<h2[^>]*>(.*?)<\/h2>/g;
            const titles: string[] = [];
            let match;
            
            while ((match = titleRegex.exec(html)) !== null) {
              titles.push(match[1]);
            }
            
            // プレゼンテーション結果を更新
            setPresentationResult({
              query,
              htmlContent: html,
              slideCount: titles.length,
              slideTitles: titles,
              generatedAt: new Date().toISOString()
            });
            } catch (streamError) {
              console.error('ストリーミング処理エラー:', streamError);
              setError(`ストリーミング処理中にエラーが発生しました: ${streamError instanceof Error ? streamError.message : String(streamError)}`);
            }
          }, 100);
      } else {
        // 通常のJSONレスポンスの場合
        console.log('JSONレスポンスとして処理');
        try {
          const result = await response.json();
          console.log('JSONレスポンスの内容:', result);
          
          // JSONレスポンスの詳細をログに出力
          console.log('JSONレスポンスの詳細:');
          console.log('- query:', result.query);
          console.log('- slideCount:', result.slideCount);
          console.log('- slideTitles:', result.slideTitles);
          console.log('- htmlContent長:', result.htmlContent?.length || 0);
          console.log('- htmlContent先頭100文字:', result.htmlContent?.substring(0, 100));
          console.log('- generatedAt:', result.generatedAt);

          // 先にステートを更新
          setPresentationResult(result);
          
          // setTimeout を使用して、DOMの更新後にiframeの操作を行う
          console.log('DOMの更新を待機します...');
          setTimeout(async () => {
            updateIframeContent(result.htmlContent);
          }, 100);
        } catch (jsonError) {
          console.error('JSONパースエラー:', jsonError);
          setError(`レスポンスのJSONパースに失敗しました: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
        }
        
      }
    } catch (err) {
      console.error('プレゼンテーション生成エラー:', err);
      setError(`プレゼンテーション生成中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      console.log('フォーム送信完了');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">プレゼンテーションツール検証</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            クエリを入力して、AIによるプレゼンテーションを生成します
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 入力フォーム */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <form onSubmit={handleSubmit}>
                <div className="mb-6">
                  <label htmlFor="query" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    クエリ（テーマ・トピック）
                  </label>
                  <textarea
                    id="query"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    rows={4}
                    placeholder="例: AIの未来と社会への影響"
                    required
                  />
                </div>

                <div className="mb-6">
                  <label htmlFor="slideCount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    スライド数: {slideCount}
                  </label>
                  <input
                    id="slideCount"
                    type="range"
                    min="3"
                    max="15"
                    value={slideCount}
                    onChange={(e) => setSlideCount(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>3</span>
                    <span>15</span>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-center">
                    <input
                      id="includeImagePlaceholders"
                      type="checkbox"
                      checked={includeImagePlaceholders}
                      onChange={(e) => setIncludeImagePlaceholders(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="includeImagePlaceholders" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      画像プレースホルダーを含める
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                    isLoading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      生成中...
                    </>
                  ) : (
                    'プレゼンテーションを生成'
                  )}
                </button>
              </form>

              {error && (
                <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">
                  {error}
                </div>
              )}

              {presentationResult && (
                <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-md">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">生成情報</h3>
                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    <p>スライド数: {presentationResult.slideCount}</p>
                    <p>生成日時: {new Date(presentationResult.generatedAt).toLocaleString('ja-JP')}</p>
                  </div>
                  {presentationResult.slideTitles && presentationResult.slideTitles.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">スライドタイトル:</h4>
                      <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc pl-4 space-y-0.5">
                        {presentationResult.slideTitles.map((title: string, index: number) => (
                          <li key={index}>{title}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* プレゼンテーション表示エリア */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow h-[600px] overflow-hidden">
              {!presentationResult ? (
                <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium">プレゼンテーションが表示されます</h3>
                    <p className="mt-1 text-sm">左のフォームからクエリを入力して生成してください</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 text-xs">
                    <p>iframeRef: {iframeRef.current ? 'セットされています' : 'セットされていません'}</p>
                    <p>htmlContent長: {presentationResult.htmlContent.length}文字</p>
                  </div>
                  <iframe
                    ref={iframeRef}
                    className="w-full h-[calc(100%-30px)] border-0"
                    title="Generated Presentation"
                    sandbox="allow-same-origin allow-scripts"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
