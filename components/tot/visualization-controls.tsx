'use client';

import React from 'react';

export interface VisualizationSettings {
  depthFilter: number | null;
  scoreThreshold: number;
  showOnlySelectedPath: boolean;
  zoomLevel: number;
}

interface VisualizationControlsProps {
  settings: VisualizationSettings;
  onSettingsChange: (settings: VisualizationSettings) => void;
}

export const VisualizationControls: React.FC<VisualizationControlsProps> = ({
  settings,
  onSettingsChange
}) => {
  // 設定変更ハンドラ
  const handleSettingChange = (key: keyof VisualizationSettings, value: any) => {
    onSettingsChange({
      ...settings,
      [key]: value
    });
  };
  
  return (
    <div className="visualization-controls bg-white rounded-lg shadow p-3 mb-4">
      <h3 className="text-sm font-medium mb-3">表示設定</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 深さフィルター */}
        <div className="control-group">
          <label className="block text-xs text-gray-500 mb-1">深さフィルター</label>
          <div className="flex items-center">
            <select
              value={settings.depthFilter === null ? 'all' : settings.depthFilter}
              onChange={(e) => handleSettingChange('depthFilter', e.target.value === 'all' ? null : Number(e.target.value))}
              className="text-sm border border-gray-300 rounded px-2 py-1 w-full"
            >
              <option value="all">すべて表示</option>
              <option value="0">深さ 0 まで</option>
              <option value="1">深さ 1 まで</option>
              <option value="2">深さ 2 まで</option>
              <option value="3">深さ 3 まで</option>
              <option value="4">深さ 4 まで</option>
              <option value="5">深さ 5 まで</option>
            </select>
          </div>
        </div>
        
        {/* スコア閾値 */}
        <div className="control-group">
          <label className="block text-xs text-gray-500 mb-1">
            スコア閾値: {settings.scoreThreshold.toFixed(1)}
          </label>
          <div className="flex items-center">
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={settings.scoreThreshold}
              onChange={(e) => handleSettingChange('scoreThreshold', Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
        
        {/* 選択パスのみ表示 */}
        <div className="control-group">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showOnlySelectedPath}
              onChange={(e) => handleSettingChange('showOnlySelectedPath', e.target.checked)}
              className="rounded"
            />
            <span className="text-xs text-gray-500">選択パスのみ表示</span>
          </label>
        </div>
        
        {/* ズームレベル */}
        <div className="control-group">
          <label className="block text-xs text-gray-500 mb-1">
            ズームレベル: {settings.zoomLevel.toFixed(1)}x
          </label>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleSettingChange('zoomLevel', Math.max(0.5, settings.zoomLevel - 0.1))}
              className="text-xs bg-gray-100 hover:bg-gray-200 rounded px-2 py-1"
              disabled={settings.zoomLevel <= 0.5}
            >
              -
            </button>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.zoomLevel}
              onChange={(e) => handleSettingChange('zoomLevel', Number(e.target.value))}
              className="flex-1"
            />
            <button
              onClick={() => handleSettingChange('zoomLevel', Math.min(2, settings.zoomLevel + 0.1))}
              className="text-xs bg-gray-100 hover:bg-gray-200 rounded px-2 py-1"
              disabled={settings.zoomLevel >= 2}
            >
              +
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex justify-end mt-3">
        <button
          onClick={() => onSettingsChange({
            depthFilter: null,
            scoreThreshold: 0,
            showOnlySelectedPath: false,
            zoomLevel: 1
          })}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-1 px-3 rounded"
        >
          リセット
        </button>
      </div>
    </div>
  );
};