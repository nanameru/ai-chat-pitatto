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

export function updateConnectionStrengthHebbian(
  connection: NodeConnection, 
  sourceNodeActivity: number, 
  targetNodeActivity: number,
  learningRate: number = 0.1
): NodeConnection {
  const activityProduct = sourceNodeActivity * targetNodeActivity;
  
  const strengthDelta = learningRate * activityProduct;
  
  const newStrength = Math.min(1.0, connection.strength + strengthDelta);
  
  return {
    ...connection,
    strength: newStrength,
    lastActivated: new Date(),
    activationCount: (connection.activationCount || 0) + 1
  };
}

export function pruneConnections(
  connections: NodeConnection[], 
  pruningThreshold: number = 0.2,
  inactivityThresholdMs: number = 7 * 24 * 60 * 60 * 1000 // 1週間
): NodeConnection[] {
  const now = new Date();
  
  return connections.filter(conn => {
    const lastActive = conn.lastActivated || conn.createdAt || now;
    const inactiveTimeMs = now.getTime() - lastActive.getTime();
    
    const shouldPrune = inactiveTimeMs > inactivityThresholdMs && conn.strength < pruningThreshold;
    
    return !shouldPrune;
  });
}

export function calculateNodeActivity(
  node: ThoughtNode, 
  connections: NodeConnection[], 
  allNodes: ThoughtNode[],
  decayFactor: number = 0.9
): number {
  const baseActivity = node.score / 10;
  
  const relatedConnections = connections.filter(
    conn => conn.sourceNodeId === node.id || conn.targetNodeId === node.id
  );
  
  if (relatedConnections.length === 0) {
    return baseActivity;
  }
  
  const avgConnectionStrength = relatedConnections.reduce(
    (sum, conn) => sum + conn.strength, 
    0
  ) / relatedConnections.length;
  
  const connectedNodesActivity = relatedConnections.reduce((sum, conn) => {
    const connectedNodeId = conn.sourceNodeId === node.id ? conn.targetNodeId : conn.sourceNodeId;
    const connectedNode = allNodes.find(n => n.id === connectedNodeId);
    if (!connectedNode) return sum;
    
    return sum + (connectedNode.score / 10) * conn.strength;
  }, 0) / relatedConnections.length;
  
  return decayFactor * (baseActivity * 0.4 + avgConnectionStrength * 0.3 + connectedNodesActivity * 0.3);
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
