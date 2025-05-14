'use client';

import { useState, useEffect } from 'react';
import { ThoughtNode, NodeConnection, SynthesizedThought } from '../src/mastra/types/thoughtNode';

interface ThoughtGraphData {
  nodes: ThoughtNode[];
  connections: NodeConnection[];
  synthesizedThoughts: SynthesizedThought[];
  networkMetrics: {
    nodeCount: number;
    connectionCount: number;
    averageStrength: number;
    averageScore: number;
    connectionDensity: number;
    timestamp: Date;
  };
}

interface UseThoughtGraphResult {
  data: ThoughtGraphData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: (sessionId?: string) => Promise<void>;
}

export function useThoughtGraph(sessionId: string = 'default'): UseThoughtGraphResult {
  const [data, setData] = useState<ThoughtGraphData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async (sid: string = sessionId) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/mastra/thought-graph?sessionId=${sid}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch thought graph data: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error occurred');
      }
      
      const parsedData = {
        ...result.data,
        nodes: result.data.nodes.map((node: any) => ({
          ...node,
          createdAt: new Date(node.createdAt)
        })),
        connections: result.data.connections.map((conn: any) => ({
          ...conn,
          createdAt: new Date(conn.createdAt),
          lastActivated: conn.lastActivated ? new Date(conn.lastActivated) : undefined
        })),
        synthesizedThoughts: result.data.synthesizedThoughts.map((thought: any) => ({
          ...thought,
          createdAt: new Date(thought.createdAt)
        })),
        networkMetrics: {
          ...result.data.networkMetrics,
          timestamp: new Date(result.data.networkMetrics.timestamp)
        }
      };
      
      setData(parsedData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [sessionId]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData
  };
}
