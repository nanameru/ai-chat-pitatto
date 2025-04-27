'use client';

import React, { useState } from 'react';
import { ThoughtNode } from '@/lib/mastra/sample-data/tot-exploration-data';

interface SimpleThoughtTreeProps {
  thoughtNodes: ThoughtNode[];
  selectedPath: string[];
  onNodeClick?: (node: ThoughtNode) => void;
}

export const SimpleThoughtTree: React.FC<SimpleThoughtTreeProps> = ({
  thoughtNodes,
  selectedPath,
  onNodeClick
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(selectedPath));
  
  // ノードの展開/折りたたみを切り替える
  const toggleNode = (nodeId: string) => {
    const newExpandedNodes = new Set(expandedNodes);
    if (newExpandedNodes.has(nodeId)) {
      newExpandedNodes.delete(nodeId);
    } else {
      newExpandedNodes.add(nodeId);
    }
    setExpandedNodes(newExpandedNodes);
  };
  
  // ノードのタイトルを取得（最初の行）
  const getNodeTitle = (node: ThoughtNode): string => {
    const firstLine = node.data.content.split('\n')[0];
    // 長すぎる場合は省略
    return firstLine.length > 60 ? firstLine.substring(0, 60) + '...' : firstLine;
  };
  
  // ルートノードを取得
  const rootNodes = thoughtNodes.filter(node => !node.parentId);
  
  // ツリーを再帰的にレンダリング
  const renderTree = (nodes: ThoughtNode[], parentId: string | undefined = undefined, level: number = 0) => {
    const childNodes = parentId 
      ? thoughtNodes.filter(node => node.parentId === parentId)
      : rootNodes;
    
    if (childNodes.length === 0) return null;
    
    return (
      <ul className={`pl-0 list-none ${level > 0 ? 'ml-6' : ''}`}>
        {childNodes.map(node => {
          const hasChildren = thoughtNodes.some(n => n.parentId === node.id);
          const isExpanded = expandedNodes.has(node.id);
          const isSelected = selectedPath.includes(node.id);
          
          return (
            <li key={node.id} className="mb-2">
              <div 
                className={`
                  flex items-start p-2 rounded-md transition-all duration-200
                  ${isSelected ? 'bg-black/5 dark:bg-white/10' : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'}
                `}
              >
                <div className="flex-shrink-0 mr-2 mt-0.5">
                  {hasChildren ? (
                    <button
                      onClick={() => toggleNode(node.id)}
                      className="w-5 h-5 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <svg 
                        className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'transform rotate-90' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24" 
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ) : (
                    <div className="w-5 h-5 flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                    </div>
                  )}
                </div>
                
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => onNodeClick && onNodeClick(node)}
                >
                  <div className="flex items-start">
                    <div className="flex-1">
                      <div className={`text-sm ${isSelected ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                        {getNodeTitle(node)}
                      </div>
                      
                      <div className="flex items-center mt-1">
                        <div className="relative w-24 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mr-2">
                          <div 
                            className={`absolute top-0 left-0 h-full rounded-full ${isSelected ? 'bg-black dark:bg-white' : 'bg-gray-400 dark:bg-gray-500'}`}
                            style={{ width: `${node.score * 10}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {node.score.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    
                    {isSelected && (
                      <div className="ml-2 flex-shrink-0 w-5 h-5 rounded-full bg-black/10 dark:bg-white/20 flex items-center justify-center">
                        <svg className="w-3 h-3 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {hasChildren && isExpanded && renderTree(thoughtNodes, node.id, level + 1)}
            </li>
          );
        })}
      </ul>
    );
  };
  
  return (
    <div className="simple-thought-tree p-4 overflow-auto">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">思考プロセス</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">AIがどのように考えたかの探索経路</p>
      </div>
      
      {renderTree(thoughtNodes)}
      
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div>ノード数: {thoughtNodes.length}</div>
          <div>最大深さ: {Math.max(...thoughtNodes.map(n => n.depth))}</div>
        </div>
      </div>
    </div>
  );
};