
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ThoughtNode } from '@/lib/mastra/sample-data/tot-exploration-data';

interface ThoughtGraphProps {
  thoughtNodes: ThoughtNode[];
  selectedPath: string[];
  onNodeClick?: (node: ThoughtNode) => void;
}

interface NodePosition {
  x: number;
  y: number;
}

interface GraphNode extends ThoughtNode {
  position: NodePosition;
  targetPosition?: NodePosition;
  velocity?: NodePosition;
}

export const ThoughtGraph: React.FC<ThoughtGraphProps> = ({
  thoughtNodes,
  selectedPath,
  onNodeClick
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [isInitialLayoutDone, setIsInitialLayoutDone] = useState(false);
  
  // アニメーションフレーム参照
  const animationFrameRef = useRef<number | null>(null);
  
  // 初期化
  useEffect(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setDimensions({ width, height });
    }
    
    // ノードの初期位置を設定
    initializeNodePositions();
    
    // リサイズイベントリスナー
    const handleResize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);
  
  // ノードが変更されたときに再初期化
  useEffect(() => {
    initializeNodePositions();
    
    // 初期レイアウトを実行（一度だけ）
    if (!isInitialLayoutDone) {
      setIsSimulationRunning(true);
      
      // 初期レイアウト後に自動的に停止
      const timer = setTimeout(() => {
        setIsSimulationRunning(false);
        setIsInitialLayoutDone(true);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [thoughtNodes]);
  
  // シミュレーション実行
  useEffect(() => {
    if (isSimulationRunning) {
      runSimulation();
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isSimulationRunning, nodes]);
  
  // ノードの初期位置を設定
  const initializeNodePositions = () => {
    const newNodes: GraphNode[] = thoughtNodes.map(node => {
      // 深さに基づいて水平位置を決定
      const x = node.depth * 200 + 100;
      
      // 同じ深さのノードを垂直方向に分散
      const sameDepthNodes = thoughtNodes.filter(n => n.depth === node.depth);
      const index = sameDepthNodes.findIndex(n => n.id === node.id);
      const y = (dimensions.height / (sameDepthNodes.length + 1)) * (index + 1);
      
      return {
        ...node,
        position: { x, y },
        targetPosition: { x, y },
        velocity: { x: 0, y: 0 }
      };
    });
    
    setNodes(newNodes);
  };
  
  // 力学シミュレーションを実行
  const runSimulation = () => {
    if (nodes.length === 0) return;
    
    let stabilityCounter = 0;
    const MAX_STABILITY_COUNT = 10;
    
    const simulationStep = () => {
      setNodes(prevNodes => {
        const newNodes = [...prevNodes];
        let isStable = true;
        
        // 各ノードに力を適用
        newNodes.forEach(node => {
          if (node.id === draggedNode) return; // ドラッグ中のノードはスキップ
          
          // 初期速度をリセット
          node.velocity = { x: 0, y: 0 };
          
          // 親ノードへの引力
          if (node.parentId) {
            const parentNode = newNodes.find(n => n.id === node.parentId);
            if (parentNode) {
              const dx = parentNode.position.x - node.position.x;
              const dy = parentNode.position.y - node.position.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              if (distance > 0) {
                // 理想的な距離（深さに基づく）
                const idealDistance = 150;
                const forceFactor = (distance - idealDistance) * 0.03;
                
                node.velocity = {
                  x: (node.velocity?.x || 0) + dx * forceFactor / distance,
                  y: (node.velocity?.y || 0) + dy * forceFactor / distance
                };
              }
            }
          }
          
          // 他のノードからの反発力
          newNodes.forEach(otherNode => {
            if (node.id === otherNode.id) return;
            
            const dx = node.position.x - otherNode.position.x;
            const dy = node.position.y - otherNode.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0 && distance < 200) {
              const force = 1 / (distance * distance) * 500;
              
              node.velocity = {
                x: (node.velocity?.x || 0) + dx * force / distance,
                y: (node.velocity?.y || 0) + dy * force / distance
              };
            }
          });
          
          // 深さに基づく水平位置への引力
          const targetX = node.depth * 200 + 100;
          const dx = targetX - node.position.x;
          node.velocity = {
            x: (node.velocity?.x || 0) + dx * 0.1,
            y: (node.velocity?.y || 0)
          };
          
          // 画面中央への引力
          const centerY = dimensions.height / 2;
          const dy = centerY - node.position.y;
          node.velocity = {
            x: (node.velocity?.x || 0),
            y: (node.velocity?.y || 0) + dy * 0.01
          };
          
          // 速度の減衰（強めに設定）
          node.velocity = {
            x: (node.velocity?.x || 0) * 0.6,
            y: (node.velocity?.y || 0) * 0.6
          };
          
          // 位置の更新
          const newX = node.position.x + (node.velocity?.x || 0);
          const newY = node.position.y + (node.velocity?.y || 0);
          
          // 速度が十分小さければ安定とみなす
          const vx = node.velocity?.x || 0;
          const vy = node.velocity?.y || 0;
          const speed = Math.sqrt(vx * vx + vy * vy);
          
          if (speed > 0.1) {
            isStable = false;
          }
          
          node.position = {
            x: newX,
            y: newY
          };
          
          // 画面外に出ないように制限
          node.position.x = Math.max(50, Math.min(dimensions.width - 50, node.position.x));
          node.position.y = Math.max(50, Math.min(dimensions.height - 50, node.position.y));
        });
        
        // 安定状態の判定
        if (isStable) {
          stabilityCounter++;
          if (stabilityCounter >= MAX_STABILITY_COUNT) {
            setIsSimulationRunning(false);
          }
        } else {
          stabilityCounter = 0;
        }
        
        return newNodes;
      });
      
      if (isSimulationRunning) {
        animationFrameRef.current = requestAnimationFrame(simulationStep);
      }
    };
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(simulationStep);
  };
  
  // マウスダウンハンドラ
  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (!svgRef.current) return;
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const svgPoint = svgRef.current.createSVGPoint();
    svgPoint.x = e.clientX;
    svgPoint.y = e.clientY;
    
    const svgCoords = svgPoint.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
    
    setIsDragging(true);
    setDraggedNode(nodeId);
    setDragOffset({
      x: node.position.x - (svgCoords.x - pan.x) / zoom,
      y: node.position.y - (svgCoords.y - pan.y) / zoom
    });
    
    // シミュレーションを一時停止
    setIsSimulationRunning(false);
  };
  
  // マウスムーブハンドラ
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !draggedNode || !svgRef.current) return;
    
    const svgPoint = svgRef.current.createSVGPoint();
    svgPoint.x = e.clientX;
    svgPoint.y = e.clientY;
    
    const svgCoords = svgPoint.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
    
    setNodes(prevNodes => {
      return prevNodes.map(node => {
        if (node.id === draggedNode) {
          return {
            ...node,
            position: {
              x: (svgCoords.x - pan.x) / zoom + dragOffset.x,
              y: (svgCoords.y - pan.y) / zoom + dragOffset.y
            }
          };
        }
        return node;
      });
    });
  };
  
  // マウスアップハンドラ
  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      setDraggedNode(null);
    }
  };
  
  // ホイールハンドラ（ズーム）
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.5, Math.min(2, zoom * delta));
    
    // マウス位置を中心にズーム
    if (svgRef.current) {
      const svgPoint = svgRef.current.createSVGPoint();
      svgPoint.x = e.clientX;
      svgPoint.y = e.clientY;
      
      const svgCoords = svgPoint.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
      
      const mouseX = (svgCoords.x - pan.x) / zoom;
      const mouseY = (svgCoords.y - pan.y) / zoom;
      
      const newPanX = svgCoords.x - mouseX * newZoom;
      const newPanY = svgCoords.y - mouseY * newZoom;
      
      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    }
  };
  
  // ノードクリックハンドラ
  const handleNodeClick = (node: ThoughtNode) => {
    if (onNodeClick) {
      onNodeClick(node);
    }
  };
  
  // エッジ（線）を描画
  const renderEdges = () => {
    return nodes.map(node => {
      if (!node.parentId) return null;
      
      const parentNode = nodes.find(n => n.id === node.parentId);
      if (!parentNode) return null;
      
      const isSelected = selectedPath.includes(node.id) && selectedPath.includes(parentNode.id);
      
      return (
        <g key={`edge-${parentNode.id}-${node.id}`}>
          <line
            x1={parentNode.position.x}
            y1={parentNode.position.y}
            x2={node.position.x}
            y2={node.position.y}
            stroke={isSelected ? '#000000' : '#cccccc'}
            strokeWidth={isSelected ? 2 : 1}
            strokeOpacity={isSelected ? 0.8 : 0.4}
            strokeDasharray={isSelected ? 'none' : '4,4'}
          />
          {isSelected && (
            <circle
              cx={(parentNode.position.x + node.position.x) / 2}
              cy={(parentNode.position.y + node.position.y) / 2}
              r={3}
              fill="#000000"
              fillOpacity={0.6}
            >
              <animate
                attributeName="r"
                values="3;5;3"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
          )}
        </g>
      );
    });
  };
  
  // ノードを描画
  const renderNodes = () => {
    return nodes.map(node => {
      const isSelected = selectedPath.includes(node.id);
      const isHovered = hoveredNode === node.id;
      
      // スコアに基づいた色を計算
      const getScoreColor = (score: number) => {
        if (score >= 9) return '#1a1a1a';
        if (score >= 8) return '#333333';
        if (score >= 7) return '#4d4d4d';
        if (score >= 6) return '#666666';
        return '#999999';
      };
      
      const nodeSize = isSelected ? 40 : 35;
      const fontSize = isSelected ? 10 : 9;
      
      return (
        <g
          key={node.id}
          transform={`translate(${node.position.x}, ${node.position.y})`}
          onMouseDown={(e) => handleMouseDown(e, node.id)}
          onMouseEnter={() => setHoveredNode(node.id)}
          onMouseLeave={() => setHoveredNode(null)}
          onClick={() => handleNodeClick(node)}
          style={{ cursor: 'pointer' }}
        >
          {/* 背景円 */}
          <circle
            r={nodeSize}
            fill="white"
            stroke={isSelected ? '#000000' : '#cccccc'}
            strokeWidth={isSelected ? 2 : 1}
            opacity={isHovered ? 1 : 0.9}
            filter={isHovered ? 'url(#shadow)' : undefined}
          >
            {isSelected && (
              <animate
                attributeName="r"
                values={`${nodeSize};${nodeSize + 2};${nodeSize}`}
                dur="2s"
                repeatCount="indefinite"
              />
            )}
          </circle>
          
          {/* スコアインジケーター */}
          <circle
            r={nodeSize - 5}
            fill="none"
            stroke={getScoreColor(node.score)}
            strokeWidth={3}
            strokeDasharray={`${2 * Math.PI * (nodeSize - 5) * (node.score / 10)} ${2 * Math.PI * (nodeSize - 5) * (1 - node.score / 10)}`}
            strokeDashoffset="0"
            transform="rotate(-90)"
          />
          
          {/* スコアテキスト */}
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fontSize + 2}
            fontWeight="bold"
            fill={getScoreColor(node.score)}
          >
            {node.score.toFixed(1)}
          </text>
          
          {/* ノードタイトル */}
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            y={nodeSize + 15}
            fontSize={fontSize}
            fill="#333333"
            fontWeight={isSelected ? 'bold' : 'normal'}
            opacity={0.8}
          >
            {node.data.content.split('\n')[0].substring(0, 20)}
            {node.data.content.split('\n')[0].length > 20 ? '...' : ''}
          </text>
          
          {/* 深さインジケーター */}
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            y={-nodeSize - 10}
            fontSize={8}
            fill="#666666"
            opacity={0.6}
          >
            深さ: {node.depth}
          </text>
        </g>
      );
    });
  };
  
  return (
    <div 
      ref={containerRef}
      className="thought-graph-container w-full h-full overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodOpacity="0.2" />
          </filter>
        </defs>
        
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {renderEdges()}
          {renderNodes()}
        </g>
      </svg>
      
      <div className="absolute bottom-4 right-4 flex space-x-2">
        <button
          className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={() => setIsSimulationRunning(!isSimulationRunning)}
        >
          {isSimulationRunning ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </button>
        <button
          className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
          </svg>
        </button>
      </div>
    </div>
  );
};