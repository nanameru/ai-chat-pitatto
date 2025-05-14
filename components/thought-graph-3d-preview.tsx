'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { ThoughtNode, NodeConnection, SynthesizedThought } from '../src/mastra/types/thoughtNode';

interface ThoughtGraph3DPreviewProps {
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

function useForceGraph(nodes: ThoughtNode[], connections: NodeConnection[]) {
  const positions = useRef<Map<string, THREE.Vector3>>(new Map());
  const velocities = useRef<Map<string, THREE.Vector3>>(new Map());
  
  useEffect(() => {
    nodes.forEach(node => {
      if (!positions.current.has(node.id)) {
        positions.current.set(node.id, new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10
        ));
      }
      
      if (!velocities.current.has(node.id)) {
        velocities.current.set(node.id, new THREE.Vector3(0, 0, 0));
      }
    });
  }, [nodes]);
  
  useFrame(() => {
    const repulsionForce = 10;
    const attractionForce = 0.05;
    const damping = 0.8;
    const maxVelocity = 0.5;
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];
        
        const posA = positions.current.get(nodeA.id);
        const posB = positions.current.get(nodeB.id);
        
        if (posA && posB) {
          const direction = new THREE.Vector3().subVectors(posB, posA);
          const distance = direction.length();
          
          if (distance > 0.1) {
            const force = repulsionForce / (distance * distance);
            direction.normalize().multiplyScalar(force);
            
            const velA = velocities.current.get(nodeA.id);
            const velB = velocities.current.get(nodeB.id);
            
            if (velA && velB) {
              velA.sub(direction);
              velB.add(direction);
            }
          }
        }
      }
    }
    
    connections.forEach(conn => {
      const sourcePos = positions.current.get(conn.sourceNodeId);
      const targetPos = positions.current.get(conn.targetNodeId);
      
      if (sourcePos && targetPos) {
        const direction = new THREE.Vector3().subVectors(targetPos, sourcePos);
        const distance = direction.length();
        
        if (distance > 0.1) {
          const force = distance * attractionForce * conn.strength;
          direction.normalize().multiplyScalar(force);
          
          const sourceVel = velocities.current.get(conn.sourceNodeId);
          const targetVel = velocities.current.get(conn.targetNodeId);
          
          if (sourceVel && targetVel) {
            sourceVel.add(direction);
            targetVel.sub(direction);
          }
        }
      }
    });
    
    nodes.forEach(node => {
      const velocity = velocities.current.get(node.id);
      const position = positions.current.get(node.id);
      
      if (velocity && position) {
        velocity.multiplyScalar(damping);
        
        if (velocity.length() > maxVelocity) {
          velocity.normalize().multiplyScalar(maxVelocity);
        }
        
        position.add(velocity);
        
        const bound = 15;
        position.x = Math.max(-bound, Math.min(bound, position.x));
        position.y = Math.max(-bound, Math.min(bound, position.y));
        position.z = Math.max(-bound, Math.min(bound, position.z));
      }
    });
  });
  
  return positions.current;
}

function Node({ 
  node, 
  position, 
  isSelected, 
  isDarkMode, 
  onClick 
}: { 
  node: ThoughtNode; 
  position: THREE.Vector3; 
  isSelected: boolean; 
  isDarkMode: boolean; 
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = getNodeColor(node, isSelected, isDarkMode);
  const radius = isSelected ? 0.6 : (node.score / 10 * 0.4 + 0.3);
  
  return (
    <group position={position}>
      <mesh
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial 
          color={color} 
          emissive={hovered || isSelected ? color : undefined}
          emissiveIntensity={hovered ? 0.3 : (isSelected ? 0.5 : 0)}
          roughness={0.5}
          metalness={0.2}
        />
      </mesh>
      
      {/* Node label */}
      <Text
        position={[0, radius + 0.2, 0]}
        fontSize={0.2}
        color={isDarkMode ? '#ffffff' : '#000000'}
        textAlign="center"
        anchorY="middle"
      >
        {node.id.substring(0, 8)}
      </Text>
      
      {/* Show content on hover */}
      {(hovered || isSelected) && (
        <Html
          position={[0, -radius - 0.3, 0]}
          center
          distanceFactor={10}
          style={{
            backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'rgba(248, 250, 252, 0.8)',
            color: isDarkMode ? '#e2e8f0' : '#334155',
            padding: '0.5rem',
            borderRadius: '0.25rem',
            fontSize: '0.75rem',
            maxWidth: '200px',
            pointerEvents: 'none',
            transform: 'translateY(100%)',
          }}
        >
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
              {node.metadata?.type === 'synthesized' ? '合成思考' : '思考ノード'}
            </div>
            <div style={{ marginBottom: '0.25rem' }}>
              {node.content.length > 100 ? `${node.content.substring(0, 100)}...` : node.content}
            </div>
            <div style={{ fontSize: '0.6rem', opacity: 0.8 }}>
              スコア: {node.score.toFixed(1)}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

function Connection({ 
  connection, 
  sourcePosition, 
  targetPosition, 
  isDarkMode 
}: { 
  connection: NodeConnection; 
  sourcePosition: THREE.Vector3; 
  targetPosition: THREE.Vector3; 
  isDarkMode: boolean;
}) {
  const color = getConnectionColor(connection.strength, isDarkMode);
  const lineWidth = connection.strength * 3 + 1;
  
  const points = useMemo(() => {
    return [sourcePosition, targetPosition];
  }, [sourcePosition, targetPosition]);
  
  return (
    <group>
      <line>
        <bufferGeometry attach="geometry">
          <bufferAttribute
            attach="attributes-position"
            args={[
              new Float32Array([
                sourcePosition.x, sourcePosition.y, sourcePosition.z,
                targetPosition.x, targetPosition.y, targetPosition.z
              ]),
              3
            ]}
          />
        </bufferGeometry>
        <lineBasicMaterial 
          attach="material" 
          color={color} 
          linewidth={lineWidth} 
          opacity={0.8}
          transparent
        />
      </line>
      
      {/* Connection strength label */}
      {connection.strength >= 0.5 && (
        <Text
          position={[
            (sourcePosition.x + targetPosition.x) / 2,
            (sourcePosition.y + targetPosition.y) / 2,
            (sourcePosition.z + targetPosition.z) / 2
          ]}
          fontSize={0.15}
          color={isDarkMode ? '#e2e8f0' : '#334155'}
          textAlign="center"
          anchorY="middle"
        >
          {connection.strength.toFixed(2)}
        </Text>
      )}
    </group>
  );
}

function Scene({ 
  nodes, 
  connections, 
  isDarkMode, 
  selectedNode, 
  onNodeClick 
}: { 
  nodes: ThoughtNode[]; 
  connections: NodeConnection[]; 
  isDarkMode: boolean; 
  selectedNode: ThoughtNode | null; 
  onNodeClick: (node: ThoughtNode) => void;
}) {
  const positions = useForceGraph(nodes, connections);
  const { camera } = useThree();
  
  useEffect(() => {
    camera.position.set(0, 0, 20);
  }, [camera]);
  
  return (
    <>
      {/* Ambient light */}
      <ambientLight intensity={0.5} />
      
      {/* Directional light */}
      <directionalLight position={[10, 10, 10]} intensity={0.5} />
      
      {/* Connections */}
      {connections.map(connection => {
        const sourcePosition = positions.get(connection.sourceNodeId);
        const targetPosition = positions.get(connection.targetNodeId);
        
        if (sourcePosition && targetPosition) {
          return (
            <Connection
              key={connection.id}
              connection={connection}
              sourcePosition={sourcePosition}
              targetPosition={targetPosition}
              isDarkMode={isDarkMode}
            />
          );
        }
        return null;
      })}
      
      {/* Nodes */}
      {nodes.map(node => {
        const position = positions.get(node.id);
        
        if (position) {
          return (
            <Node
              key={node.id}
              node={node}
              position={position}
              isSelected={selectedNode?.id === node.id}
              isDarkMode={isDarkMode}
              onClick={() => onNodeClick(node)}
            />
          );
        }
        return null;
      })}
      
      {/* Orbit controls */}
      <OrbitControls 
        enableDamping 
        dampingFactor={0.1} 
        rotateSpeed={0.5}
        zoomSpeed={0.7}
      />
    </>
  );
}

export const ThoughtGraph3DPreview: React.FC<ThoughtGraph3DPreviewProps> = ({
  nodes,
  connections,
  synthesizedThoughts = [],
  width = 600,
  height = 400,
  onNodeClick,
}) => {
  const [selectedNode, setSelectedNode] = useState<ThoughtNode | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  
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
  
  const handleNodeClick = (node: ThoughtNode) => {
    setSelectedNode(node);
    if (onNodeClick) {
      onNodeClick(node);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow relative">
        <Canvas
          style={{ width, height }}
          camera={{ position: [0, 0, 20], fov: 60 }}
          gl={{ antialias: true }}
        >
          <Scene
            nodes={nodes}
            connections={connections}
            isDarkMode={isDarkMode}
            selectedNode={selectedNode}
            onNodeClick={handleNodeClick}
          />
        </Canvas>
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
