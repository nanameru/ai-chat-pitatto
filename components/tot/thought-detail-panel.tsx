'use client';

import React from 'react';
import { ThoughtNode } from '@/lib/mastra/sample-data/tot-exploration-data';

interface ThoughtDetailPanelProps {
  thought: ThoughtNode;
  parentThought?: ThoughtNode;
  childThoughts?: ThoughtNode[];
  evaluationCriteria?: string[];
}

export const ThoughtDetailPanel: React.FC<ThoughtDetailPanelProps> = ({
  thought,
  parentThought,
  childThoughts = [],
  evaluationCriteria = []
}) => {
  // 思考内容を段落に分割
  const contentParagraphs = thought.data.content.split('\n').filter(p => p.trim().length > 0);
  
  return (
    <div className="thought-detail-panel">
      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold">ノード情報</h3>
          <span className="text-xs bg-blue-100 text-blue-800 rounded px-2 py-1 font-bold">
            スコア: {thought.score.toFixed(1)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>ID: <span className="font-mono">{thought.id}</span></div>
          <div>深さ: {thought.depth}</div>
          {thought.parentId && (
            <div>親ID: <span className="font-mono">{thought.parentId}</span></div>
          )}
          <div>子ノード数: {childThoughts.length}</div>
        </div>
      </div>
      
      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-2">思考内容</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          {contentParagraphs.map((paragraph, index) => (
            <p key={index} className={`text-sm ${index > 0 ? 'mt-2' : ''}`}>
              {paragraph}
            </p>
          ))}
        </div>
      </div>
      
      {thought.data.evaluationCriteria && evaluationCriteria.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">評価スコア</h3>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {evaluationCriteria.map(criterion => (
                <div key={criterion} className="flex items-center justify-between">
                  <span className="text-xs">{criterion}:</span>
                  <div className="flex items-center">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden mr-2">
                      <div 
                        className="h-full bg-blue-500 rounded-full" 
                        style={{ 
                          width: `${thought.data.evaluationCriteria?.[criterion] ? 
                            (thought.data.evaluationCriteria[criterion] * 10) : 0}%` 
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium">
                      {thought.data.evaluationCriteria?.[criterion] || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {parentThought && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">親思考</h3>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-medium">{parentThought.id}</span>
              <span className="text-xs bg-gray-100 rounded px-1">スコア: {parentThought.score.toFixed(1)}</span>
            </div>
            <p className="text-xs line-clamp-2">{parentThought.data.content.split('\n')[0]}</p>
          </div>
        </div>
      )}
      
      {childThoughts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">子思考 ({childThoughts.length})</h3>
          <div className="space-y-2">
            {childThoughts.map(child => (
              <div key={child.id} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium">{child.id}</span>
                  <span className="text-xs bg-gray-100 rounded px-1">スコア: {child.score.toFixed(1)}</span>
                </div>
                <p className="text-xs line-clamp-2">{child.data.content.split('\n')[0]}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};