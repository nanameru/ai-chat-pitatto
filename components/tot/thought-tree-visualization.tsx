'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ThoughtNode } from '@/lib/mastra/sample-data/tot-exploration-data';

interface ThoughtTreeVisualizationProps {
  data: ThoughtNode[];
  selectedPath?: string[];
  settings?: {
    depthFilter?: number | null;
    scoreThreshold?: number;
    showOnlySelectedPath?: boolean;
    zoomLevel?: number;
  };
  onNodeClick?: (node: ThoughtNode) => void;
}

// シンプルなツリーノードの型定義
interface SimpleTreeNode {
  id: string;
  data: ThoughtNode;
  children: SimpleTreeNode[];
  x?: number;
  y?: number;
  depth: number;
  parentId?: string;
}

export const ThoughtTreeVisualization: React.FC<ThoughtTreeVisualizationProps> = ({
  data,
  selectedPath = [],
  settings = {},
  onNodeClick
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  // リサイズハンドラ
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: 400 // 固定高さ
        });
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // フィルタリングされたデータを取得
  const getFilteredData = () => {
    let filteredData = [...data];
    
    // 深さフィルター
    if (settings.depthFilter !== undefined && settings.depthFilter !== null) {
      filteredData = filteredData.filter(node => node.depth <= settings.depthFilter!);
    }
    
    // スコア閾値
    if (settings.scoreThreshold !== undefined) {
      filteredData = filteredData.filter(node => node.score >= settings.scoreThreshold!);
    }
    
    // 選択パスのみ表示
    if (settings.showOnlySelectedPath) {
      filteredData = filteredData.filter(node => selectedPath.includes(node.id));
    }
    
    return filteredData;
  };
  
  // ノードがパスに含まれているかチェック
  const isInSelectedPath = (nodeId: string) => {
    return selectedPath.includes(nodeId);
  };
  
  // 各深さのノードをグループ化
  const renderTree = () => {
    const filteredData = getFilteredData();
    
    // 各深さのノードをグループ化
    const nodesByDepth: { [depth: number]: ThoughtNode[] } = {};
    filteredData.forEach(node => {
      if (!nodesByDepth[node.depth]) {
        nodesByDepth[node.depth] = [];
      }
      nodesByDepth[node.depth].push(node);
    });
    
    // 深さの配列を取得（ソート済み）
    const depths = Object.keys(nodesByDepth).map(Number).sort((a, b) => a - b);
    
    return (
      <div className="flex flex-col space-y-6">
        {depths.map(depth => (
          <div key={`depth-${depth}`} className="depth-level">
            <h3 className="text-sm font-medium text-gray-500 mb-2">深さ {depth}</h3>
            <div className="flex flex-wrap gap-3">
              {nodesByDepth[depth].map(node => (
                <div
                  key={node.id}
                  className={`node-card p-2 rounded-lg shadow cursor-pointer transition-all
                    ${isInSelectedPath(node.id) ? 'border-2 border-blue-500 bg-blue-50' : 'border border-gray-200 bg-white'}
                    hover:shadow-md`}
                  style={{
                    maxWidth: '220px',
                    opacity: isInSelectedPath(node.id) ? 1 : 0.8,
                    transform: `scale(${isInSelectedPath(node.id) ? 1.02 : 1})`,
                  }}
                  onClick={() => onNodeClick && onNodeClick(node)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-medium bg-gray-100 rounded px-1 py-0.5">
                      ID: {node.id.substring(0, 6)}...
                    </span>
                    <span className="text-xs font-bold bg-blue-100 text-blue-800 rounded px-1 py-0.5">
                      {node.score.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-xs line-clamp-2 mb-1">
                    {node.data.content.split('\n')[0]}
                  </div>
                  <div className="text-xs text-gray-500">
                    {node.parentId ? `親: ${node.parentId.substring(0, 6)}...` : 'ルート'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <div className="thought-tree-visualization">
      <div 
        ref={containerRef}
        className="tree-container border rounded-lg p-2 bg-gray-50 overflow-auto" 
        style={{ height: '400px' }}
      >
        {getFilteredData().length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">表示するデータがありません</p>
          </div>
        ) : (
          renderTree()
        )}
      </div>
      <div className="text-xs text-gray-500 mt-1 text-right">
        ノードをクリックすると詳細が表示されます
      </div>
    </div>
  );
};