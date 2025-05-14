'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Box, LayoutGrid } from 'lucide-react';
import { ThoughtGraphPreview } from './thought-graph-preview';
import { ThoughtGraph3DPreview } from './thought-graph-3d-preview';
import { ThoughtNode, NodeConnection, SynthesizedThought } from '../src/mastra/types/thoughtNode';

interface ThoughtGraphSidebarProps {
  onClose?: () => void;
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
  nodes: ThoughtNode[];
  connections: NodeConnection[];
  synthesizedThoughts?: SynthesizedThought[];
  networkMetrics?: {
    nodeCount: number;
    connectionCount: number;
    averageStrength: number;
    averageScore: number;
    connectionDensity: number;
    timestamp: Date;
  };
}

const DEFAULT_MIN_WIDTH = 300;
const DEFAULT_MAX_WIDTH = 800;
const DEFAULT_INITIAL_WIDTH = 400;

export const ThoughtGraphSidebar: React.FC<ThoughtGraphSidebarProps> = ({
  onClose,
  initialWidth = DEFAULT_INITIAL_WIDTH,
  minWidth = DEFAULT_MIN_WIDTH,
  maxWidth = DEFAULT_MAX_WIDTH,
  className = '',
  nodes,
  connections,
  synthesizedThoughts = [],
  networkMetrics,
}) => {
  const [width, setWidth] = useState<number>(initialWidth);
  const isResizingRef = useRef(false);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<ThoughtNode | null>(null);
  const [visualizationMode, setVisualizationMode] = useState<'2d' | '3d'>('2d');
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !sidebarRef.current) return;
    const newWidth = window.innerWidth - e.clientX;
    const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
    setWidth(clampedWidth);
  }, [minWidth, maxWidth]);
  
  const handleMouseUp = useCallback(() => {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleMouseMove]);
  
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault(); // Prevent text selection during drag
    isResizingRef.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };
  
  useEffect(() => {
    return () => {
      if (isResizingRef.current) {
        handleMouseUp(); // This also removes the listeners
      }
    };
  }, [handleMouseUp]);
  
  const handleNodeClick = (node: ThoughtNode) => {
    setSelectedNode(node);
  };
  
  return (
    <aside
      ref={sidebarRef}
      style={{ width: `${width}px` }}
      className={`fixed right-0 top-0 h-full bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-800 shadow-lg rounded-l-xl flex flex-col overflow-hidden ${className}`}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute left-[-4px] top-0 h-full w-2 cursor-ew-resize group z-10"
        aria-label="Resize sidebar"
      >
        <div className="w-full h-full bg-transparent transition-colors duration-150 group-hover:bg-gray-300 dark:group-hover:bg-gray-600 opacity-0 group-hover:opacity-50 rounded-l-full"></div>
      </div>
      
      {/* Header with close button, title, and visualization mode toggle */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-zinc-700 flex-shrink-0">
        <span className="font-semibold text-sm text-gray-700 dark:text-zinc-300">思考グラフ可視化</span>
        <div className="flex items-center">
          {/* Visualization mode toggle */}
          <div className="flex mr-2 bg-gray-100 dark:bg-zinc-800 rounded-md overflow-hidden">
            <button
              onClick={() => setVisualizationMode('2d')}
              className={`p-1 text-xs flex items-center ${
                visualizationMode === '2d' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
              }`}
              aria-label="2D visualization"
              title="2D visualization"
            >
              <LayoutGrid size={14} className="mr-1" />
              <span>2D</span>
            </button>
            <button
              onClick={() => setVisualizationMode('3d')}
              className={`p-1 text-xs flex items-center ${
                visualizationMode === '3d' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
              }`}
              aria-label="3D visualization"
              title="3D visualization"
            >
              <Box size={14} className="mr-1" />
              <span>3D</span>
            </button>
          </div>
          
          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>
      
      {/* Network Metrics */}
      {networkMetrics && (
        <div className="p-3 border-b border-gray-200 dark:border-zinc-700">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-gray-100 dark:bg-zinc-800 p-2 rounded">
              <span className="font-medium">ノード数:</span> {networkMetrics.nodeCount}
            </div>
            <div className="bg-gray-100 dark:bg-zinc-800 p-2 rounded">
              <span className="font-medium">結合数:</span> {networkMetrics.connectionCount}
            </div>
            <div className="bg-gray-100 dark:bg-zinc-800 p-2 rounded">
              <span className="font-medium">平均強度:</span> {networkMetrics.averageStrength.toFixed(2)}
            </div>
            <div className="bg-gray-100 dark:bg-zinc-800 p-2 rounded">
              <span className="font-medium">平均スコア:</span> {networkMetrics.averageScore.toFixed(2)}
            </div>
            <div className="bg-gray-100 dark:bg-zinc-800 p-2 rounded col-span-2">
              <span className="font-medium">結合密度:</span> {networkMetrics.connectionDensity.toFixed(2)}
            </div>
          </div>
        </div>
      )}
      
      {/* Graph Visualization */}
      <div className="flex-grow overflow-auto">
        {visualizationMode === '2d' ? (
          <ThoughtGraphPreview
            nodes={nodes}
            connections={connections}
            synthesizedThoughts={synthesizedThoughts}
            width={width - 20}
            height={500}
            onNodeClick={handleNodeClick}
          />
        ) : (
          <ThoughtGraph3DPreview
            nodes={nodes}
            connections={connections}
            synthesizedThoughts={synthesizedThoughts}
            width={width - 20}
            height={500}
            onNodeClick={handleNodeClick}
          />
        )}
      </div>
      
      {/* Selected Node Details */}
      {selectedNode && (
        <div className="p-4 border-t border-gray-200 dark:border-zinc-700 max-h-[200px] overflow-auto">
          <h3 className="font-medium text-sm mb-2">
            {selectedNode.metadata?.type === 'synthesized' ? '合成思考' : '思考ノード'}
          </h3>
          <p className="text-sm mb-2 text-gray-700 dark:text-zinc-300">{selectedNode.content}</p>
          <div className="flex gap-2 text-xs text-gray-500 dark:text-zinc-400">
            <span>スコア: {selectedNode.score.toFixed(1)}</span>
            <span>ID: {selectedNode.id}</span>
            <span>作成: {selectedNode.createdAt.toLocaleString()}</span>
          </div>
        </div>
      )}
    </aside>
  );
};
