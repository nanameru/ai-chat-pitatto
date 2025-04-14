import React, { useState } from 'react';
import { ReasoningStep } from '@/types/reasoning';
import { X, ChevronDown, ChevronUp, ArrowRight, ExternalLink } from 'lucide-react';

type ReasoningSidebarProps = {
  steps: ReasoningStep[];
  isLoading: boolean;
  onClose: () => void;
};

/**
 * 推論過程を表示するサイドバーコンポーネント
 */
export const ReasoningSidebar: React.FC<ReasoningSidebarProps> = ({ steps, isLoading, onClose }) => {
  const [isThoughtsExpanded, setIsThoughtsExpanded] = useState(true);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  // ステップの展開/折りたたみを切り替える
  const toggleStepExpansion = (stepId: string) => {
    setExpandedSteps(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }));
  };

  // ステップのタイプに基づいてアイコンを取得
  const getIconForType = (type: ReasoningStep['type']) => {
    switch (type) {
      case 'clarification':
        return '❓'; // 質問アイコン
      case 'planning':
        return '📝'; // 計画アイコン
      case 'research':
        return '🔍'; // 検索アイコン
      case 'integration':
        return '📊'; // 統合アイコン
      case 'tool_start':
        return '🛠️'; // ツール開始アイコン
      case 'tool_end':
        return '✅'; // ツール完了アイコン
      case 'insight':
        return '💡'; // 洞察アイコン
      case 'analysis':
        return '📊'; // 分析アイコン
      case 'hypothesis':
        return '🔬'; // 仮説アイコン
      case 'gap':
        return '🧩'; // ギャップアイコン
      case 'report':
        return '📑'; // レポートアイコン
      case 'thought_generation':
        return '🧠'; // 思考生成アイコン
      case 'thinking':
      default:
        return '💭'; // 思考アイコン
    }
  };

  // ステップのタイプに基づいて色を取得
  const getColorForType = (type: ReasoningStep['type']) => {
    switch (type) {
      case 'clarification':
        return 'border-purple-300'; // 質問は紫色
      case 'planning':
        return 'border-blue-300'; // 計画は青色
      case 'research':
        return 'border-green-300'; // 検索は緑色
      case 'integration':
        return 'border-orange-300'; // 統合はオレンジ色
      case 'insight':
        return 'border-yellow-300'; // 洞察は黄色
      case 'analysis':
        return 'border-teal-300'; // 分析はティール色
      case 'hypothesis':
        return 'border-indigo-300'; // 仮説はインディゴ色
      case 'gap':
        return 'border-red-300'; // ギャップは赤色
      case 'report':
        return 'border-slate-300'; // レポートはスレート色
      case 'thought_generation':
        return 'border-pink-300'; // 思考生成はピンク色
      case 'thinking':
      default:
        return 'border-gray-300'; // デフォルトはグレー
    }
  };

  // URLがあるかどうかをチェック
  const hasUrls = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return urlRegex.test(content);
  };

  // URLをハイパーリンクに変換
  const formatContentWithLinks = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    if (!urlRegex.test(content)) {
      return <span>{content}</span>;
    }
    
    const parts = content.split(urlRegex);
    const matches = content.match(urlRegex) || [];
    
    return (
      <>
        {parts.map((part, i) => {
          // 奇数インデックスのmatches[i/2]がURLに対応
          if (i % 2 === 0) {
            return <span key={i}>{part}</span>;
          }
          const url = matches[Math.floor(i/2)];
          return (
            <a 
              key={i} 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 hover:underline flex items-center"
            >
              {url.length > 30 ? `${url.substring(0, 30)}...` : url}
              <ExternalLink size={14} className="ml-1 inline" />
            </a>
          );
        })}
      </>
    );
  };

  // 表示するステップをフィルタリング（ツール開始/終了ステップを除外）
  const filteredSteps = steps.filter(step => 
    step.type !== 'tool_start' && step.type !== 'tool_end'
  );

  // 検索結果ステップと分析結果ステップを抽出
  const researchSteps = filteredSteps.filter(step => 
    step.type === 'research'
  );
  
  const analysisSteps = filteredSteps.filter(step => 
    step.type === 'analysis' || step.type === 'insight' || step.type === 'hypothesis'
  );

  return (
    <div className="w-full h-full overflow-hidden flex flex-col bg-white border-l border-gray-200">
      {/* ヘッダー */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="#5F6368"/>
            <path d="M12 17C14.7614 17 17 14.7614 17 12C17 9.23858 14.7614 7 12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17Z" fill="#5F6368"/>
          </svg>
          <h2 className="ml-2 text-lg font-medium text-gray-800">DeepResearch 思考プロセス</h2>
        </div>
        <button 
          onClick={onClose} 
          className="text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="閉じる"
        >
          <X size={20} />
        </button>
      </div>

      {/* コンテンツエリア */}
      <div className="flex-1 overflow-y-auto">
        {/* Thoughts セクション */}
        <div className="border-b border-gray-200">
          <div 
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
            onClick={() => setIsThoughtsExpanded(!isThoughtsExpanded)}
          >
            <h3 className="text-lg font-medium text-gray-800">思考プロセス</h3>
            {isThoughtsExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          
          {isThoughtsExpanded && (
            <div className="p-4 pt-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  <p className="mt-4 text-sm text-gray-600">思考中...</p>
                </div>
              ) : filteredSteps.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>まだ思考プロセスはありません</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredSteps.map((step) => {
                    const isExpanded = expandedSteps[step.id] !== false; // デフォルトで展開
                    const borderColorClass = getColorForType(step.type);
                    const hasLongContent = step.content && step.content.length > 200;
                    
                    return (
                      <div key={step.id} className={`border-l-4 ${borderColorClass} pl-4 py-1`}>
                        <div className="flex items-start gap-3">
                          <div className="text-xl">{getIconForType(step.type)}</div>
                          <div className="flex-1">
                            <div 
                              className="flex justify-between items-center cursor-pointer" 
                              onClick={() => hasLongContent && toggleStepExpansion(step.id)}
                            >
                              <h4 className="font-medium text-gray-900">{step.title}</h4>
                              {hasLongContent && (
                                <button className="text-gray-500 p-1">
                                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                              )}
                            </div>
                            <div className={`mt-2 text-sm text-gray-700 whitespace-pre-wrap ${hasLongContent && !isExpanded ? 'line-clamp-3' : ''}`}>
                              {hasUrls(step.content) 
                                ? formatContentWithLinks(step.content)
                                : step.content}
                            </div>
                            {hasLongContent && !isExpanded && (
                              <button 
                                className="mt-1 text-xs text-blue-600 hover:underline flex items-center"
                                onClick={() => toggleStepExpansion(step.id)}
                              >
                                続きを読む <ArrowRight size={12} className="ml-1" />
                              </button>
                            )}
                            <div className="mt-2 text-xs text-gray-500">
                              {new Date(step.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 検索結果セクション */}
        {researchSteps.length > 0 && (
          <div>
            <div className="flex items-center p-4 border-b border-gray-200">
              <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="#5F6368"/>
              </svg>
              <h3 className="ml-2 text-lg font-medium text-gray-800">検索結果</h3>
            </div>
            <div className="p-4 grid grid-cols-1 gap-4">
              {researchSteps.map((step, index) => {
                // 検索結果のURLを抽出
                const urlMatch = step.content.match(/(https?:\/\/[^\s]+)/g);
                const url = urlMatch ? urlMatch[0] : 'example.com';
                const domain = url.replace(/^https?:\/\//, '').split('/')[0];
                
                return (
                  <div key={`research-${index}`} className="border border-gray-200 rounded-lg p-3 hover:shadow-sm">
                    <div className="text-sm font-medium text-gray-900 truncate">{domain}</div>
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">{step.title}</div>
                    {url !== 'example.com' && (
                      <a 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-2 text-xs text-blue-600 hover:underline flex items-center"
                      >
                        ソースを開く <ExternalLink size={12} className="ml-1" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 分析結果セクション */}
        {analysisSteps.length > 0 && (
          <div>
            <div className="flex items-center p-4 border-b border-gray-200">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM9 17H7V10H9V17ZM13 17H11V7H13V17ZM17 17H15V13H17V17Z" fill="#5F6368"/>
              </svg>
              <h3 className="ml-2 text-lg font-medium text-gray-800">分析と洞察</h3>
            </div>
            <div className="p-4 space-y-4">
              {analysisSteps.map((step, index) => (
                <div key={`analysis-${index}`} className="border border-gray-200 rounded-lg p-3 hover:shadow-sm">
                  <div className="flex items-center">
                    <span className="text-xl mr-2">{getIconForType(step.type)}</span>
                    <div className="text-sm font-medium text-gray-900">{step.title}</div>
                  </div>
                  <div className="text-xs text-gray-700 mt-2 whitespace-pre-wrap line-clamp-3">
                    {step.content}
                  </div>
                  <button 
                    className="mt-2 text-xs text-blue-600 hover:underline flex items-center"
                    onClick={() => toggleStepExpansion(step.id)}
                  >
                    詳細を見る <ArrowRight size={12} className="ml-1" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReasoningSidebar;
