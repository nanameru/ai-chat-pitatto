import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export const thoughtNodeSchema = z.object({
  id: z.string(),
  content: z.string(),
  score: z.number().min(0).max(10),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date().optional().default(() => new Date()),
});

export type ThoughtNode = z.infer<typeof thoughtNodeSchema>;

export const nodeConnectionSchema = z.object({
  id: z.string().optional().default(() => uuidv4()),
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  strength: z.number().min(0).max(1),
  reasoning: z.string().optional(),
  createdAt: z.date().optional().default(() => new Date()),
  lastActivated: z.date().optional(),
  activationCount: z.number().optional().default(1),
});

export type NodeConnection = z.infer<typeof nodeConnectionSchema>;

export const synthesizedThoughtSchema = z.object({
  id: z.string().optional().default(() => uuidv4()),
  nodeIds: z.array(z.string()),
  content: z.string(),
  confidence: z.number().min(0).max(1),
  createdAt: z.date().optional().default(() => new Date()),
});

export type SynthesizedThought = z.infer<typeof synthesizedThoughtSchema>;

export const thoughtGraphStateSchema = z.object({
  nodes: z.array(thoughtNodeSchema),
  connections: z.array(nodeConnectionSchema),
  synthesizedThoughts: z.array(synthesizedThoughtSchema),
  metadata: z.object({
    nodeCount: z.number(),
    connectionCount: z.number(),
    averageStrength: z.number(),
    averageScore: z.number(),
    connectionDensity: z.number(),
    timestamp: z.date(),
  }).optional(),
});

export type ThoughtGraphState = z.infer<typeof thoughtGraphStateSchema>;

export function createThoughtNode(content: string, score: number, metadata?: Record<string, any>): ThoughtNode {
  return {
    id: uuidv4(),
    content,
    score,
    metadata,
    createdAt: new Date(),
  };
}

export function createNodeConnection(
  sourceNodeId: string, 
  targetNodeId: string, 
  strength: number, 
  reasoning?: string
): NodeConnection {
  return {
    id: uuidv4(),
    sourceNodeId,
    targetNodeId,
    strength,
    reasoning,
    createdAt: new Date(),
    lastActivated: new Date(),
    activationCount: 1,
  };
}

export function createSynthesizedThought(
  nodeIds: string[], 
  content: string, 
  confidence: number
): SynthesizedThought {
  return {
    id: uuidv4(),
    nodeIds,
    content,
    confidence,
    createdAt: new Date(),
  };
}

export function calculateNetworkState(nodes: ThoughtNode[], connections: NodeConnection[]) {
  const avgStrength = connections.length > 0 
    ? connections.reduce((sum, conn) => sum + conn.strength, 0) / connections.length 
    : 0;
  
  const avgScore = nodes.length > 0
    ? nodes.reduce((sum, node) => sum + node.score, 0) / nodes.length
    : 0;
    
  const connDensity = nodes.length > 1
    ? connections.length / (nodes.length * (nodes.length - 1) / 2)
    : 0;
    
  return {
    nodeCount: nodes.length,
    connectionCount: connections.length,
    averageStrength: avgStrength,
    averageScore: avgScore,
    connectionDensity: connDensity,
    timestamp: new Date()
  };
}
