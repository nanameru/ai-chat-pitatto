'use client';

import React, { useState, useEffect } from 'react';
import { ReasoningSidebar } from '@/components/tot/reasoning-sidebar';
import { ResultContent } from '@/components/tot/result-content';
import { sampleExplorationData, ThoughtNode } from '@/lib/mastra/sample-data/tot-exploration-data';

export default function ToTExplorerPage() {
  const [selectedNode, setSelectedNode] = useState<ThoughtNode>(sampleExplorationData.bestNode);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  useEffect(() => {
    // ページ読み込み完了時のアニメーション
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    
    // ダークモード検出
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      clearTimeout(timer);
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);
  
  // 生成結果のサンプルテキスト
  const generatedResultText = `
# AIの未来：スパースモデリングとニューロシンボリックAIの統合

## 概要

現在のディープラーニングの限界を超えるために、スパースモデリング技術とニューロシンボリックAIを組み合わせた新しいアプローチが注目されています。この統合アプローチは、少ないデータでの学習効率向上、解釈可能性の向上、論理推論と深層学習の統合、そして計算リソース要件の削減を実現する可能性を秘めています。

## 主要な発見

1. **スパースモデリングの進化**：最新の研究では、ニューラルネットワークの重みの90%以上を削減しても精度を維持できることが示されています。これにより、モデルサイズが大幅に縮小し、エッジデバイスでの実行が可能になります。

2. **ニューロシンボリックAIの台頭**：記号的推論と深層学習を組み合わせることで、少ないデータでも効率的に学習し、論理的一貫性を保ちながら推論できるモデルが開発されています。

3. **実用化への道筋**：大手テック企業や研究機関が、この統合アプローチに基づく次世代AIシステムの開発に投資を増やしています。今後3-5年以内に実用レベルの統合システムが登場すると予測されています。

## 今後の展望

スパースモデリングとニューロシンボリックAIの統合は、AIの次の大きなブレークスルーとなる可能性があります。特に、説明可能性が求められる医療診断や自律システムなど、高い信頼性が必要な分野での応用が期待されています。また、この技術の進展により、現在のGPT-4などの大規模言語モデルの限界を超える、より効率的で解釈可能なAIシステムが実現するでしょう。
  `;
  
  return (
    <div className={`tot-explorer-container h-screen flex flex-col ${isDarkMode ? 'dark' : ''}`}>
      <header className={`
        py-4 px-6 transition-all duration-500 ease-out
        ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
        bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800
      `}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-medium text-gray-900 dark:text-gray-100 tracking-tight">
                Tree of Thoughts Explorer
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                複雑な思考プロセスを視覚化し、探索結果を分析するためのインターフェース
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full">
                ビーム幅: {sampleExplorationData.beamWidth}
              </div>
              <div className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full">
                最大深さ: {sampleExplorationData.maxDepth}
              </div>
              <button 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                onClick={() => setIsDarkMode(!isDarkMode)}
              >
                {isDarkMode ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        {/* メインコンテンツ */}
        <main className={`
          flex-1 overflow-auto transition-all duration-500 ease-out
          ${isLoaded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}
          bg-white dark:bg-gray-900
        `}>
          <div className="max-w-4xl mx-auto">
            <div className="p-2 sm:p-4 md:p-6">
              <div className="mb-6 p-4 border border-gray-100 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">最良の思考</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      スコア: <span className="font-medium">{sampleExplorationData.bestNode.score.toFixed(1)}</span>
                    </p>
                  </div>
                  <div className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg px-3 py-1.5 font-medium">
                    ID: {sampleExplorationData.bestNode.id}
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
                <ResultContent content={generatedResultText} />
              </div>
              
              <div className="mt-6 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-4">
                <div>
                  実行時間: <span className="font-medium">2.5秒</span>
                </div>
                <div>
                  探索ノード数: <span className="font-medium">{sampleExplorationData.exploredNodes.length}</span>
                </div>
              </div>
            </div>
          </div>
        </main>
        
        {/* サイドバー */}
        <aside className={`
          w-96 transition-all duration-500 ease-out
          ${isLoaded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}
        `}>
          <ReasoningSidebar 
            thoughtNodes={sampleExplorationData.exploredNodes}
            selectedPath={sampleExplorationData.bestNodePath}
          />
        </aside>
      </div>
      
      <style jsx global>{`
        /* ダークモード対応 */
        .dark {
          color-scheme: dark;
        }
        
        /* スムーズなスクロール */
        html {
          scroll-behavior: smooth;
        }
        
        /* カスタムスクロールバー */
        ::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }
        
        .dark ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.2);
        }
        
        .dark ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        
        /* フォントレンダリング */
        body {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      `}</style>
    </div>
  );
}