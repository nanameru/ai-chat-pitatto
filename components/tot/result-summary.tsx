'use client';

import React, { useState } from 'react';
import { ThoughtNode, ResearchPlan } from '@/lib/mastra/sample-data/tot-exploration-data';

interface ResultSummaryProps {
  bestThought: ThoughtNode;
  researchPlan?: ResearchPlan;
  statistics: {
    nodesExplored: number;
    maxDepthReached: number;
    bestScore: number;
    executionTimeMs?: number;
  };
}

export const ResultSummary: React.FC<ResultSummaryProps> = ({
  bestThought,
  researchPlan,
  statistics
}) => {
  const [showDetails, setShowDetails] = useState(false);
  
  return (
    <div className="result-summary bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold">探索結果サマリー</h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-1 px-2 rounded transition-colors"
        >
          {showDetails ? '詳細を隠す' : '詳細を表示'}
        </button>
      </div>
      
      <div className="stats grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="stat bg-blue-50 rounded-lg p-2">
          <div className="text-xs text-gray-500">探索ノード数</div>
          <div className="text-lg font-bold">{statistics.nodesExplored}</div>
        </div>
        <div className="stat bg-blue-50 rounded-lg p-2">
          <div className="text-xs text-gray-500">最大深さ</div>
          <div className="text-lg font-bold">{statistics.maxDepthReached}</div>
        </div>
        <div className="stat bg-blue-50 rounded-lg p-2">
          <div className="text-xs text-gray-500">最高スコア</div>
          <div className="text-lg font-bold">{statistics.bestScore.toFixed(1)}</div>
        </div>
        <div className="stat bg-blue-50 rounded-lg p-2">
          <div className="text-xs text-gray-500">実行時間</div>
          <div className="text-lg font-bold">
            {statistics.executionTimeMs ? `${(statistics.executionTimeMs / 1000).toFixed(1)}秒` : 'N/A'}
          </div>
        </div>
      </div>
      
      <div className="best-thought mb-4">
        <h4 className="text-sm font-medium mb-2">最良の思考</h4>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium">ID: {bestThought.id}</span>
            <span className="text-xs bg-yellow-100 text-yellow-800 rounded px-2 py-0.5 font-bold">
              スコア: {bestThought.score.toFixed(1)}
            </span>
          </div>
          <p className="text-sm font-medium">{bestThought.data.content.split('\n')[0]}</p>
        </div>
      </div>
      
      {showDetails && researchPlan && (
        <div className="research-plan">
          <h4 className="text-sm font-medium mb-2">研究計画</h4>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="mb-2">
              <div className="text-xs text-gray-500 mb-1">アプローチ</div>
              <p className="text-sm">{researchPlan.approach}</p>
            </div>
            
            <div className="mb-2">
              <div className="text-xs text-gray-500 mb-1">サブトピック</div>
              <ul className="list-disc list-inside text-sm">
                {researchPlan.subtopics.map((topic, index) => (
                  <li key={index} className="text-sm">{topic}</li>
                ))}
              </ul>
            </div>
            
            <div>
              <div className="text-xs text-gray-500 mb-1">検索クエリ</div>
              <div className="space-y-1">
                {researchPlan.queries.map((query, index) => (
                  <div key={index} className="text-sm bg-white rounded p-1 border border-green-100">
                    <div className="flex justify-between">
                      <span className="font-medium">{query.query}</span>
                      <span className="text-xs bg-green-100 rounded px-1">優先度: {query.priority}</span>
                    </div>
                    <div className="text-xs text-gray-500">{query.purpose} ({query.queryType})</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};