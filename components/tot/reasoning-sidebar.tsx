'use client';

import React, { useState } from 'react';
import { ThoughtNode } from '@/lib/mastra/sample-data/tot-exploration-data';
import { SimpleThoughtTree } from './simple-thought-tree';

interface ReasoningSidebarProps {
  thoughtNodes: ThoughtNode[];
  selectedPath: string[];
}

export const ReasoningSidebar: React.FC<ReasoningSidebarProps> = ({
  thoughtNodes,
  selectedPath
}) => {
  const [selectedNode, setSelectedNode] = useState<ThoughtNode | null>(null);
  
  // ノードクリックハンドラ
  const handleNodeClick = (node: ThoughtNode) => {
    setSelectedNode(node);
  };
  
  return (
    <div className="reasoning-sidebar h-full flex flex-col bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800">
      <div className="flex-1 overflow-auto custom-scrollbar">
        <SimpleThoughtTree 
          thoughtNodes={thoughtNodes}
          selectedPath={selectedPath}
          onNodeClick={handleNodeClick}
        />
      </div>
      
      {selectedNode && (
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">選択したノード</h4>
            <div className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
              スコア: {selectedNode.score.toFixed(1)}
            </div>
          </div>
          
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
            ID: {selectedNode.id} | 深さ: {selectedNode.depth}
          </div>
          
          <div className="mt-2 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 max-h-40 overflow-auto custom-scrollbar">
            {selectedNode.data.content}
          </div>
          
          <div className="mt-3 flex justify-end">
            <button 
              className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              onClick={() => setSelectedNode(null)}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 10px;
        }
        
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.2);
        }
        
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
};