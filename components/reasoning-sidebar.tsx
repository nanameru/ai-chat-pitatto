import React from 'react';
import type { ReasoningStep } from '@/types/reasoning';

type ReasoningSidebarProps = {
  steps: ReasoningStep[];
  isLoading: boolean;
  onClose: () => void;
};

/**
 * 推論過程を表示するサイドバーコンポーネント
 */
export const ReasoningSidebar: React.FC<ReasoningSidebarProps> = ({ steps, isLoading, onClose }) => {
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
      case 'thinking':
      default:
        return '💭'; // 思考アイコン
    }
  };

  // ステップのタイプに基づいて背景色を取得
  const getBackgroundColorForType = (type: ReasoningStep['type']) => {
    switch (type) {
      case 'clarification':
        return 'bg-blue-50';
      case 'planning':
        return 'bg-green-50';
      case 'research':
        return 'bg-yellow-50';
      case 'integration':
        return 'bg-purple-50';
      case 'tool_start':
      case 'tool_end':
        return 'bg-gray-50';
      case 'thinking':
      default:
        return 'bg-white';
    }
  };

  // ステップの内容を表示するかどうかを判断
  const shouldDisplayContent = (type: ReasoningStep['type']) => {
    // ツール開始/終了ステップは内容を表示しない
    return type !== 'tool_start' && type !== 'tool_end';
  };

  // 表示するステップをフィルタリング（ツール開始/終了ステップを除外）
  const filteredSteps = steps.filter(step => 
    step.type !== 'tool_start' && step.type !== 'tool_end'
  );

  return (
    <div className="w-full h-full overflow-y-auto border-l border-gray-200 bg-white">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">生成AIの思考プロセス</h2>
        <p className="text-sm text-gray-600">AIが調査を進める過程を確認できます</p>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
            <p className="mt-4 text-sm text-gray-600">思考中...</p>
          </div>
        ) : filteredSteps.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>まだ思考プロセスはありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSteps.map((step) => (
              <div 
                key={step.id}
                className={`p-3 rounded-lg border border-gray-200 ${getBackgroundColorForType(step.type)}`}
              >
                <div className="flex items-start">
                  <div className="mr-2 text-xl">{getIconForType(step.type)}</div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{step.title}</h3>
                    {shouldDisplayContent(step.type) && (
                      <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                        {step.content}
                      </div>
                    )}
                    <div className="mt-2 text-xs text-gray-500">
                      {new Date(step.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReasoningSidebar;
