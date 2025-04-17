import React, { useState } from 'react';
import { ReasoningStep } from '@/types/reasoning';
import { X, ChevronDown, ChevronUp, ArrowRight, ExternalLink, Download, FileText, Info } from 'lucide-react';

type ReasoningSidebarProps = {
  steps: ReasoningStep[];
  isLoading: boolean;
  onClose: () => void;
};

// セクションタイプの定義
type SectionType = 'thoughts' | 'research' | 'analysis' | 'summary';

/**
 * 推論過程を表示するサイドバーコンポーネント
 */
export const ReasoningSidebar: React.FC<ReasoningSidebarProps> = ({ steps, isLoading, onClose }) => {
  // 各セクションの展開状態を管理
  const [expandedSections, setExpandedSections] = useState<Record<SectionType, boolean>>({
    thoughts: true,
    research: true,
    analysis: true,
    summary: true
  });
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  // セクションの展開/折りたたみを切り替える
  const toggleSectionExpansion = (section: SectionType) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

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
    <div className="w-2/5 min-w-[450px] max-w-[800px] h-full overflow-hidden flex flex-col bg-white border-l border-gray-200">
      {/* ヘッダー - 洗練されたデザイン */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center">
          <FileText className="text-blue-600" size={24} />
          <h2 className="ml-3 text-lg font-medium text-gray-800">最新AIツール情報調査</h2>
        </div>
        <div className="flex items-center space-x-3">
          <button
            className="flex items-center px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium hover:bg-blue-200 transition-colors"
          >
            <Download size={16} className="mr-1.5" />
            Export to Docs
          </button>
          <button className="text-gray-500 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100">
            <Info size={20} />
          </button>
          <button className="text-gray-500 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100">
            <FileText size={20} />
          </button>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100"
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* メインコンテンツ - レポートスタイル */}
      <div className="flex-1 overflow-y-auto">
        {/* レポートタイトル */}
        <div className="px-8 py-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">AIツールの最新動向と2025年の展望：包括的分析レポート</h1>
        </div>

        {/* エグゼクティブサマリー */}
        <div className="border-b border-gray-200">
          <div
            className="flex items-center justify-between px-8 py-4 cursor-pointer hover:bg-gray-50"
            onClick={() => toggleSectionExpansion('summary')}
          >
            <h3 className="text-xl font-semibold text-gray-800">1. エグゼクティブサマリー</h3>
            {expandedSections.summary ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          
          {expandedSections.summary && (
            <div className="px-8 py-4">
              <p className="text-gray-700 mb-4">
                2025年初頭現在、AIツール市場は急速な進化の只中にあります。特に大規模言語モデル（LLM）
                の性能向上、自律的にタスクを遂行する「AIエージェント」の台頭、そしてテキスト、画像、音
                声などを統合的に扱う「マルチモーダル」機能の普及が顕著です。OpenAI、Google、
                Microsoft、Anthropicといった主要プレイヤー間の競争は激化しており、数週間から数ヶ月単位で
                新たなモデルや機能が発表される状況が常態化しています。
              </p>
              <p className="text-gray-700 mb-4">
                この技術革新の波は日本市場にも及んでおり、多くの企業が業務効率化や生産性向上を目的として
                AIツールの導入を進めています。これに伴い、日本語処理能力の向上や日本市場に特化したツ
                ールの開発も活発化しています。
              </p>
              <p className="text-gray-700">
                本レポートでは、2025年初頭における最新AIツールの動向、主要カテゴリ別のツール分析、技術
                トレンド、産業界の動き、そして日本市場の状況について、広範な調査に基づき詳細に解説します。
                AIツールの進化はとどまることを知らず、その戦略的な選定と組織への統合は、今後の競争優
                位性を左右する重要な要素となりつつあります。この急速な変化に対応するためには、継続的な
                情報収集と柔軟な戦略が不可欠です。
              </p>
            </div>
          )}
        </div>

        {/* イノベーションスポットライト */}
        <div className="border-b border-gray-200">
          <div
            className="flex items-center justify-between px-8 py-4 cursor-pointer hover:bg-gray-50"
            onClick={() => toggleSectionExpansion('research')}
          >
            <h3 className="text-xl font-semibold text-gray-800">2. 最新イノベーションのスポットライト（2025年初頭）</h3>
            {expandedSections.research ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          
          {expandedSections.research && (
            <div className="px-8 py-4">
              <p className="text-gray-700 mb-4">
                2025年の幕開けと共に、AI分野では注目すべきツールやアップデートが相次いで発表されました。
              </p>
              
              {/* 検索結果カード */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {researchSteps.map((step, index) => {
                  // 検索結果のURLを抽出
                  const urlMatch = step.content.match(/(https?:\/\/[^\s]+)/g);
                  const url = urlMatch ? urlMatch[0] : 'example.com';
                  const domain = url.replace(/^https?:\/\//, '').split('/')[0];
                  
                  return (
                    <div key={`research-${index}`} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="text-sm font-medium text-gray-900 mb-1">{domain}</div>
                      <div className="text-base font-semibold text-gray-800 mb-2">{step.title}</div>
                      <div className="text-sm text-gray-600 mb-3 line-clamp-3">{step.content.replace(url, '')}</div>
                      {url !== 'example.com' && (
                        <a 
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline flex items-center"
                        >
                          ソースを開く <ExternalLink size={14} className="ml-1" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 思考プロセス */}
        <div className="border-b border-gray-200">
          <div
            className="flex items-center justify-between px-8 py-4 cursor-pointer hover:bg-gray-50"
            onClick={() => toggleSectionExpansion('thoughts')}
          >
            <h3 className="text-xl font-semibold text-gray-800">3. 思考プロセス</h3>
            {expandedSections.thoughts ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          
          {expandedSections.thoughts && (
            <div className="px-8 py-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-sm text-gray-600">思考中...</p>
          </div>
        ) : filteredSteps.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>まだ思考プロセスはありません</p>
          </div>
        ) : (
                <div className="space-y-8">
                  {filteredSteps.map((step) => {
                    const isExpanded = expandedSteps[step.id] !== false; // デフォルトで展開
                    const borderColorClass = getColorForType(step.type);
                    const hasLongContent = step.content && step.content.length > 200;
                    
                    return (
                      <div key={step.id} className={`border-l-4 ${borderColorClass} pl-6 py-3 bg-gray-50 rounded-r-lg`}>
                        <div className="flex items-start gap-4">
                          <div className="text-2xl mt-1">{getIconForType(step.type)}</div>
                          <div className="flex-1">
                            <div 
                              className="flex justify-between items-center cursor-pointer" 
                              onClick={() => hasLongContent && toggleStepExpansion(step.id)}
                            >
                              <h4 className="font-semibold text-gray-900 text-lg">{step.title}</h4>
                              {hasLongContent && (
                                <button className="text-gray-500 p-1 hover:bg-gray-200 rounded">
                                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </button>
                              )}
                            </div>
                            <div className={`mt-3 text-base text-gray-700 whitespace-pre-wrap ${hasLongContent && !isExpanded ? 'line-clamp-3' : ''}`}>
                              {hasUrls(step.content) 
                                ? formatContentWithLinks(step.content)
                                : step.content}
                            </div>
                            {hasLongContent && !isExpanded && (
                              <button
                                className="mt-2 text-sm text-blue-600 hover:underline flex items-center"
                                onClick={() => toggleStepExpansion(step.id)}
                              >
                                続きを読む <ArrowRight size={14} className="ml-1" />
                              </button>
                            )}
                            <div className="mt-3 text-sm text-gray-500">
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


        {/* 分析と洞察セクション */}
        {analysisSteps.length > 0 && (
          <div className="border-b border-gray-200">
            <div
              className="flex items-center justify-between px-8 py-4 cursor-pointer hover:bg-gray-50"
              onClick={() => toggleSectionExpansion('analysis')}
            >
              <h3 className="text-xl font-semibold text-gray-800">4. 分析と洞察</h3>
              {expandedSections.analysis ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
            
            {expandedSections.analysis && (
              <div className="px-8 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {analysisSteps.map((step, index) => (
                    <div key={`analysis-${index}`} className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow bg-white">
                      <div className="flex items-center mb-3">
                        <span className="text-2xl mr-3">{getIconForType(step.type)}</span>
                        <div className="text-lg font-semibold text-gray-900">{step.title}</div>
                      </div>
                      <div className="text-base text-gray-700 whitespace-pre-wrap line-clamp-4 mb-3">
                        {step.content}
                      </div>
                      <button
                        className="text-sm text-blue-600 hover:underline flex items-center"
                        onClick={() => toggleStepExpansion(step.id)}
                      >
                        詳細を見る <ArrowRight size={14} className="ml-1" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReasoningSidebar;
