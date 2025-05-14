import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { Workflow, Step, WorkflowContext, StepExecutionContext } from '@mastra/core/workflows';
import { 
  ThoughtNode, 
  NodeConnection, 
  SynthesizedThought,
  thoughtNodeSchema,
  nodeConnectionSchema,
  synthesizedThoughtSchema,
  calculateNetworkState
} from '../../types/thoughtNode';
import { thoughtAggregationAgent, aggregateThoughts } from '../../agents/thoughtAggregationAgent';
import { getLogger } from '../..';

const aggregateThoughtsInputSchema = z.object({
  thoughts: z.array(z.string()),
  query: z.string(),
});

const aggregateThoughtsOutputSchema = z.object({
  nodes: z.array(thoughtNodeSchema),
  connections: z.array(nodeConnectionSchema),
  synthesizedThoughts: z.array(synthesizedThoughtSchema),
  networkState: z.any(),
});

export const aggregateThoughtsStep = new Step({
  id: 'aggregateThoughtsStep',
  description: '思考ノード間の関連性を分析し、動的に結合・合成するステップ',
  inputSchema: aggregateThoughtsInputSchema,
  outputSchema: aggregateThoughtsOutputSchema,
  execute: async ({ context }: StepExecutionContext<any, WorkflowContext<any>>) => {
    const logger = getLogger();
    logger.info("(AggregateThoughts) Analyzing thought nodes for potential connections");
    
    const thoughtStrings = context.triggerData.thoughts || [];
    const query = context.triggerData.query || "";
    
    if (thoughtStrings.length < 2) {
      logger.info("(AggregateThoughts) Not enough thoughts for aggregation");
      return { 
        nodes: [], 
        connections: [], 
        synthesizedThoughts: [],
        networkState: { nodeCount: 0, connectionCount: 0 }
      };
    }
    
    const nodes: ThoughtNode[] = thoughtStrings.map((content: string, index: number) => ({
      id: `thought-${index + 1}`,
      content,
      score: 7.0, // デフォルトスコア
      metadata: { type: 'initial' },
      createdAt: new Date()
    }));
    
    try {
      const aggregationResult = await aggregateThoughts({
        nodes,
        query,
        existingConnections: []
      });
      
      const connections = aggregationResult.connections.map(conn => ({
        ...conn,
        id: conn.id || uuidv4(),
        createdAt: conn.createdAt || new Date(),
        lastActivated: conn.lastActivated || new Date(),
        activationCount: conn.activationCount || 1
      }));
      
      const synthesizedThoughts = aggregationResult.synthesizedThoughts.map(thought => ({
        id: uuidv4(),
        nodeIds: thought.nodeIds,
        content: thought.content,
        confidence: thought.confidence,
        createdAt: new Date()
      }));
      
      const newNodes = [...nodes];
      for (const synThought of synthesizedThoughts) {
        newNodes.push({
          id: synThought.id,
          content: synThought.content,
          score: synThought.confidence * 10, // 0-1のconfidenceを0-10のスコアに変換
          metadata: {
            type: 'synthesized',
            sourceNodeIds: synThought.nodeIds,
            confidence: synThought.confidence
          },
          createdAt: new Date()
        });
      }
      
      const networkState = calculateNetworkState(newNodes, connections);
      
      logger.info(`(AggregateThoughts) Generated ${synthesizedThoughts.length} synthesized thoughts and ${connections.length} connections`);
      
      return {
        nodes: newNodes,
        connections,
        synthesizedThoughts,
        networkState
      };
      
    } catch (error) {
      logger.error("(AggregateThoughts) Error during thought aggregation", { error });
      return { 
        nodes, 
        connections: [], 
        synthesizedThoughts: [],
        networkState: { nodeCount: nodes.length, connectionCount: 0, error: true }
      };
    }
  }
});
