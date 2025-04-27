'use client';

import React, { useState } from 'react';

interface ExplorationControlsProps {
  onRestartFromNode: (node: any) => void;
  onUpdateParameters: (params: any) => void;
}

export const ExplorationControls: React.FC<ExplorationControlsProps> = ({
  onRestartFromNode,
  onUpdateParameters
}) => {
  const [parameters, setParameters] = useState({
    beamWidth: 3,
    maxDepth: 3,
    branchingFactor: 5
  });
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // パラメータ変更ハンドラ
  const handleParameterChange = (key: string, value: number) => {
    setParameters({
      ...parameters,
      [key]: value
    });
  };
  
  // パラメータ更新ハンドラ
  const handleUpdateParameters = () => {
    onUpdateParameters(parameters);
  };
  
  return (
    <div className="exploration-controls">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium">探索パラメータ</h3>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-1 px-2 rounded transition-colors"
        >
          {showAdvanced ? '詳細設定を隠す' : '詳細設定を表示'}
        </button>
      </div>
      
      {showAdvanced && (
        <div className="bg-gray-50 rounded-lg p-3 mb-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
            {/* ビーム幅 */}
            <div className="control-group">
              <label className="block text-xs text-gray-500 mb-1">
                ビーム幅: {parameters.beamWidth}
              </label>
              <div className="flex items-center">
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={parameters.beamWidth}
                  onChange={(e) => handleParameterChange('beamWidth', Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
            
            {/* 最大深さ */}
            <div className="control-group">
              <label className="block text-xs text-gray-500 mb-1">
                最大深さ: {parameters.maxDepth}
              </label>
              <div className="flex items-center">
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={parameters.maxDepth}
                  onChange={(e) => handleParameterChange('maxDepth', Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
            
            {/* 分岐係数 */}
            <div className="control-group">
              <label className="block text-xs text-gray-500 mb-1">
                分岐係数: {parameters.branchingFactor}
              </label>
              <div className="flex items-center">
                <input
                  type="range"
                  min="2"
                  max="10"
                  step="1"
                  value={parameters.branchingFactor}
                  onChange={(e) => handleParameterChange('branchingFactor', Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>
          
          <div className="text-xs text-gray-500 mb-3">
            <p>
              <strong>ビーム幅</strong>: 各深さで保持するノード数。大きいほど探索範囲が広がりますが、計算コストも増加します。
            </p>
            <p className="mt-1">
              <strong>最大深さ</strong>: 探索する最大の深さ。深いほど詳細な思考が可能ですが、計算コストが指数関数的に増加します。
            </p>
            <p className="mt-1">
              <strong>分岐係数</strong>: 各ノードから生成する子ノードの数。多いほど多様な思考が生成されますが、評価コストが増加します。
            </p>
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={handleUpdateParameters}
              className="text-xs bg-blue-500 hover:bg-blue-600 text-white font-medium py-1 px-3 rounded transition-colors"
            >
              パラメータを更新して再探索
            </button>
          </div>
        </div>
      )}
      
      <div className="flex space-x-2">
        <button
          onClick={() => onRestartFromNode(null)}
          className="text-xs bg-green-500 hover:bg-green-600 text-white font-medium py-1 px-3 rounded transition-colors flex-1"
        >
          新しい探索を開始
        </button>
        
        <button
          onClick={() => alert('この機能は実際の実装では、選択されたノードから探索を再開します。')}
          className="text-xs bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-1 px-3 rounded transition-colors flex-1"
        >
          選択ノードから再開
        </button>
      </div>
      
      <div className="mt-3 text-xs text-gray-500 text-center">
        注: このデモでは実際の探索は行われません。実際の実装では、パラメータに基づいて再探索が実行されます。
      </div>
    </div>
  );
};