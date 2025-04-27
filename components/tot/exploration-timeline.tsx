'use client';

import React from 'react';
import { ReasoningStep } from '@/lib/mastra/sample-data/tot-exploration-data';

interface ExplorationTimelineProps {
  steps: ReasoningStep[];
  beamWidth: number;
  maxDepth: number;
  totalExploredNodes: number;
  executionTime: string;
}

export const ExplorationTimeline: React.FC<ExplorationTimelineProps> = ({
  steps,
  beamWidth,
  maxDepth,
  totalExploredNodes,
  executionTime
}) => {
  return (
    <div className="exploration-timeline">
      <div className="flex justify-between items-center mb-4">
        <div className="stats flex space-x-4 text-xs">
          <div className="stat bg-blue-50 rounded-lg p-2">
            <span className="font-medium">ビーム幅:</span> {beamWidth}
          </div>
          <div className="stat bg-blue-50 rounded-lg p-2">
            <span className="font-medium">最大深さ:</span> {maxDepth}
          </div>
          <div className="stat bg-blue-50 rounded-lg p-2">
            <span className="font-medium">探索ノード数:</span> {totalExploredNodes}
          </div>
          <div className="stat bg-blue-50 rounded-lg p-2">
            <span className="font-medium">実行時間:</span> {executionTime}
          </div>
        </div>
      </div>
      
      <div className="timeline relative">
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="timeline-item flex">
              <div className="timeline-marker relative">
                <div className={`
                  w-6 h-6 rounded-full flex items-center justify-center z-10 relative
                  ${getStepTypeColor(step.type)}
                `}>
                  <span className="text-xs text-white font-bold">{index + 1}</span>
                </div>
              </div>
              
              <div className="timeline-content ml-4 bg-white rounded-lg border border-gray-200 p-3 flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="text-sm font-medium">{step.title}</h4>
                  <span className="text-xs bg-gray-100 rounded px-1 py-0.5">
                    {formatTimestamp(step.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-gray-600">{step.content}</p>
                
                {step.metadata && (
                  <div className="mt-2 flex space-x-2 text-xs">
                    <span className="bg-gray-100 rounded px-1">
                      フェーズ: {step.metadata.phase}
                    </span>
                    <span className="bg-gray-100 rounded px-1">
                      ステップ: {step.metadata.currentStep}/{step.metadata.totalSteps}
                    </span>
                    {step.metadata.subStep && (
                      <span className="bg-gray-100 rounded px-1">
                        サブステップ: {step.metadata.subStep}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ステップタイプに応じた色を取得
function getStepTypeColor(type: string): string {
  switch (type) {
    case 'planning':
      return 'bg-blue-500';
    case 'thought_root':
      return 'bg-green-500';
    case 'thought_exploration':
      return 'bg-purple-500';
    case 'path_selection':
      return 'bg-yellow-500';
    case 'research_plan':
      return 'bg-red-500';
    case 'error':
      return 'bg-red-600';
    default:
      return 'bg-gray-500';
  }
}

// タイムスタンプをフォーマット
function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (e) {
    return timestamp;
  }
}