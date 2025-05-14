'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ThoughtNode, NodeConnection, SynthesizedThought } from '../src/mastra/types/thoughtNode';

interface ThoughtGraphPreviewProps {
  nodes: ThoughtNode[];
  connections: NodeConnection[];
  synthesizedThoughts?: SynthesizedThought[];
  width?: number;
  height?: number;
  onNodeClick?: (node: ThoughtNode) => void;
}

const colors = {
  node: {
    initial: '#4f46e5', // インディゴ
    synthesized: '#7c3aed', // パープル
    selected: '#f97316', // オレンジ
    text: '#ffffff',
    border: '#1e293b',
  },
  connection: {
    strong: '#10b981', // エメラルド
    medium: '#a3e635', // ライム
    weak: '#d1d5db', // グレー
  },
  background: '#f8fafc',
  dark: {
    background: '#0f172a',
    node: {
      initial: '#6366f1',
      synthesized: '#a78bfa',
      selected: '#fb923c',
      text: '#ffffff',
      border: '#334155',
    },
    connection: {
      strong: '#34d399',
      medium: '#bef264',
      weak: '#4b5563',
    },
  }
};

function calculateNodePositions(
  nodes: ThoughtNode[], 
  connections: NodeConnection[], 
  width: number, 
  height: number
): Map<string, { x: number, y: number }> {
  const positions = new Map<string, { x: number, y: number }>();
  
  nodes.forEach(node => {
    positions.set(node.id, {
      x: Math.random() * (width - 100) + 50,
      y: Math.random() * (height - 100) + 50
    });
  });
  
  const iterations = 50;
  const repulsionForce = 300;
  const attractionForce = 0.1;
  
  for (let i = 0; i < iterations; i++) {
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const nodeA = nodes[a];
        const nodeB = nodes[b];
        const posA = positions.get(nodeA.id)!;
        const posB = positions.get(nodeB.id)!;
        
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const force = repulsionForce / (distance * distance);
        const forceX = dx / distance * force;
        const forceY = dy / distance * force;
        
        posA.x -= forceX;
        posA.y -= forceY;
        posB.x += forceX;
        posB.y += forceY;
      }
    }
    
    connections.forEach(conn => {
      const sourcePos = positions.get(conn.sourceNodeId);
      const targetPos = positions.get(conn.targetNodeId);
      
      if (sourcePos && targetPos) {
        const dx = targetPos.x - sourcePos.x;
        const dy = targetPos.y - sourcePos.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const force = distance * attractionForce * conn.strength;
        const forceX = dx / distance * force;
        const forceY = dy / distance * force;
        
        sourcePos.x += forceX;
        sourcePos.y += forceY;
        targetPos.x -= forceX;
        targetPos.y -= forceY;
      }
    });
    
    positions.forEach((pos) => {
      pos.x = Math.max(50, Math.min(width - 50, pos.x));
      pos.y = Math.max(50, Math.min(height - 50, pos.y));
    });
  }
  
  return positions;
}

function getConnectionColor(strength: number, isDarkMode: boolean = false): string {
  const palette = isDarkMode ? colors.dark.connection : colors.connection;
  
  if (strength >= 0.7) return palette.strong;
  if (strength >= 0.3) return palette.medium;
  return palette.weak;
}

function getNodeColor(node: ThoughtNode, isSelected: boolean = false, isDarkMode: boolean = false): string {
  const palette = isDarkMode ? colors.dark.node : colors.node;
  
  if (isSelected) return palette.selected;
  
  const type = node.metadata?.type;
  if (type === 'synthesized') return palette.synthesized;
  return palette.initial;
}

export const ThoughtGraphPreview: React.FC<ThoughtGraphPreviewProps> = ({
  nodes,
  connections,
  synthesizedThoughts = [],
  width = 600,
  height = 400,
  onNodeClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedNode, setSelectedNode] = useState<ThoughtNode | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [positions, setPositions] = useState<Map<string, { x: number, y: number }>>(new Map());
  const [hoveredNode, setHoveredNode] = useState<ThoughtNode | null>(null);
  
  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(isDark);
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);
  
  useEffect(() => {
    if (nodes.length > 0) {
      const newPositions = calculateNodePositions(nodes, connections, width, height);
      setPositions(newPositions);
    }
  }, [nodes, connections, width, height]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || positions.size === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, width, height);
    
    ctx.fillStyle = isDarkMode ? colors.dark.background : colors.background;
    ctx.fillRect(0, 0, width, height);
    
    connections.forEach(conn => {
      const sourcePos = positions.get(conn.sourceNodeId);
      const targetPos = positions.get(conn.targetNodeId);
      
      if (sourcePos && targetPos) {
        ctx.beginPath();
        ctx.moveTo(sourcePos.x, sourcePos.y);
        ctx.lineTo(targetPos.x, targetPos.y);
        
        ctx.lineWidth = conn.strength * 5 + 1;
        ctx.strokeStyle = getConnectionColor(conn.strength, isDarkMode);
        
        ctx.stroke();
        
        const midX = (sourcePos.x + targetPos.x) / 2;
        const midY = (sourcePos.y + targetPos.y) / 2;
        
        ctx.font = '10px Arial';
        ctx.fillStyle = isDarkMode ? '#e2e8f0' : '#334155';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(conn.strength.toFixed(2), midX, midY);
      }
    });
    
    nodes.forEach(node => {
      const pos = positions.get(node.id);
      if (!pos) return;
      
      const isSelected = selectedNode?.id === node.id;
      const isHovered = hoveredNode?.id === node.id;
      
      ctx.beginPath();
      const radius = isSelected ? 25 : (node.score / 10 * 15 + 10);
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = getNodeColor(node, isSelected, isDarkMode);
      ctx.fill();
      
      if (isSelected || isHovered) {
        ctx.strokeStyle = isDarkMode ? colors.dark.node.border : colors.node.border;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      
      ctx.font = '10px Arial';
      ctx.fillStyle = isDarkMode ? colors.dark.node.text : colors.node.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const shortId = node.id.length > 8 ? `${node.id.substring(0, 8)}...` : node.id;
      ctx.fillText(shortId, pos.x, pos.y);
    });
    
  }, [nodes, connections, positions, selectedNode, hoveredNode, width, height, isDarkMode]);
  
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    let closestNode: ThoughtNode | null = null;
    let minDistance = Infinity;
    
    nodes.forEach(node => {
      const pos = positions.get(node.id);
      if (!pos) return;
      
      const dx = pos.x - x;
      const dy = pos.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const radius = node.score / 10 * 15 + 10;
      if (distance <= radius && distance < minDistance) {
        closestNode = node;
        minDistance = distance;
      }
    });
    
    if (closestNode) {
      setSelectedNode(closestNode);
      if (onNodeClick) {
        onNodeClick(closestNode);
      }
    } else {
      setSelectedNode(null);
    }
  };
  
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    let closestNode: ThoughtNode | null = null;
    let minDistance = Infinity;
    
    nodes.forEach(node => {
      const pos = positions.get(node.id);
      if (!pos) return;
      
      const dx = pos.x - x;
      const dy = pos.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const radius = node.score / 10 * 15 + 10;
      if (distance <= radius && distance < minDistance) {
        closestNode = node;
        minDistance = distance;
      }
    });
    
    setHoveredNode(closestNode);
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          className="w-full h-full"
        />
      </div>
      
      {selectedNode && (
        <div className="p-4 border-t border-gray-200 dark:border-zinc-700 max-h-[200px] overflow-auto">
          <h3 className="font-medium text-sm mb-2">
            {selectedNode.metadata?.type === 'synthesized' ? '合成思考' : '思考ノード'}
          </h3>
          <p className="text-sm mb-2 text-gray-700 dark:text-zinc-300">{selectedNode.content}</p>
          <div className="flex gap-2 text-xs text-gray-500 dark:text-zinc-400">
            <span>スコア: {selectedNode.score.toFixed(1)}</span>
            <span>ID: {selectedNode.id}</span>
          </div>
          
          {/* 関連する接続を表示 */}
          <div className="mt-2">
            <h4 className="text-xs font-medium mb-1">関連する結合:</h4>
            <ul className="text-xs">
              {connections
                .filter(conn => conn.sourceNodeId === selectedNode.id || conn.targetNodeId === selectedNode.id)
                .map(conn => {
                  const connectedNodeId = conn.sourceNodeId === selectedNode.id ? conn.targetNodeId : conn.sourceNodeId;
                  const connectedNode = nodes.find(n => n.id === connectedNodeId);
                  return (
                    <li key={conn.id} className="mb-1">
                      <span className="inline-block w-4 h-1 mr-1" style={{ 
                        backgroundColor: getConnectionColor(conn.strength, isDarkMode),
                        verticalAlign: 'middle'
                      }}></span>
                      <span>
                        {connectedNode ? 
                          `${connectedNodeId} (強度: ${conn.strength.toFixed(2)})` : 
                          `不明なノード (強度: ${conn.strength.toFixed(2)})`
                        }
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
