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
  calculateNetworkState,
  pruneConnections,
  updateConnectionStrengthHebbian,
  calculateNodeActivity
} from '../../types/thoughtNode';
import { thoughtAggregationAgent, aggregateThoughts } from '../../agents/thoughtAggregationAgent';
import { getLogger } from '../..';

// 入力スキーマ
const aggregateThoughtsInputSchema = z.object({
  thoughts: z.array(z.string()),
  query: z.string(),
});

// 出力スキーマ（状態保持のための拡張フィールドを含む）
const aggregateThoughtsOutputSchema = z.object({
  nodes: z.array(thoughtNodeSchema),
  connections: z.array(nodeConnectionSchema),
  synthesizedThoughts: z.array(synthesizedThoughtSchema),
  networkState: z.any(),
  cycleCount: z.number().optional(),
  persistentState: z.record(z.any()).optional(),
  lastUpdated: z.date().optional()
});

// 出力型の定義
type AggregateThoughtsOutput = z.infer<typeof aggregateThoughtsOutputSchema>;

// ステップの型定義を先に宣言
type AggregateThoughtsStep = Step<
  'aggregateThoughtsStep',
  z.infer<typeof aggregateThoughtsInputSchema>,
  AggregateThoughtsOutput,
  any
>;

// ステップの実装
export const aggregateThoughtsStep: AggregateThoughtsStep = new Step({
  id: 'aggregateThoughtsStep',
  description: '思考ノード間の関連性を分析し、動的に結合・合成するステップ',
  inputSchema: aggregateThoughtsInputSchema,
  outputSchema: aggregateThoughtsOutputSchema,
  execute: async ({ context }: StepExecutionContext<any, WorkflowContext<any>>): Promise<AggregateThoughtsOutput> => {
    const logger = getLogger();
    logger.info("(AggregateThoughts) Analyzing thought nodes for potential connections");
    
    const thoughtStrings = context.triggerData.thoughts || [];
    const query = context.triggerData.query || "";
    
    // 前回の実行結果から状態を取得
    const previousResult = context.getStepResult(aggregateThoughtsStep) as AggregateThoughtsOutput | undefined;
    const existingConnections: NodeConnection[] = previousResult?.connections || [];
    const cycleCount: number = previousResult?.cycleCount || 0;
    const persistentState: Record<string, any> = previousResult?.persistentState || {};
    
    logger.info(`(AggregateThoughts) Cycle ${cycleCount + 1} with ${existingConnections.length} existing connections`);
    
    if (thoughtStrings.length < 2) {
      logger.info("(AggregateThoughts) Not enough thoughts for aggregation");
      return { 
        nodes: [], 
        connections: [], 
        synthesizedThoughts: [],
        networkState: { nodeCount: 0, connectionCount: 0 },
        cycleCount: cycleCount,
        persistentState: persistentState,
        lastUpdated: new Date()
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
      // ヘブ学習パラメータ
      const learningRate = 0.1;
      const pruningThreshold = 0.2;
      const inactivityThresholdMs = 7 * 24 * 60 * 60 * 1000; // 1週間
      const decayFactor = 0.9;
      
      // 思考集約エージェントを呼び出し
      const aggregationResult = await aggregateThoughts({
        nodes,
        query,
        existingConnections,
        learningRate,
        pruningThreshold,
        inactivityThresholdMs,
        decayFactor,
        cycleCount,
        persistentState
      });
      
      // 結合情報の正規化
      const connections = aggregationResult.connections.map((conn: NodeConnection) => ({
        ...conn,
        id: conn.id || uuidv4(),
        createdAt: conn.createdAt || new Date(),
        lastActivated: conn.lastActivated || new Date(),
        activationCount: conn.activationCount || 1
      }));
      
      // 合成思考の正規化
      const synthesizedThoughts = aggregationResult.synthesizedThoughts.map((thought: any) => ({
        id: uuidv4(),
        nodeIds: thought.nodeIds,
        content: thought.content,
        confidence: thought.confidence,
        createdAt: new Date()
      }));
      
      // 合成思考をノードとして追加
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
      
      // ネットワーク状態の計算
      const networkState = aggregationResult.networkMetrics || calculateNetworkState(newNodes, connections);
      
      // 更新された状態
      const updatedState = aggregationResult.updatedState || {};
      
      // ヘブ学習の状態をログ出力
      if (cycleCount > 0 && connections.length > 0) {
        const strengthChanges = connections
          .filter((conn: NodeConnection) => conn.activationCount && conn.activationCount > 1)
          .map((conn: NodeConnection) => {
            const oldConn = existingConnections.find(
              (old: NodeConnection) => old.sourceNodeId === conn.sourceNodeId && old.targetNodeId === conn.targetNodeId
            );
            if (oldConn) {
              return {
                sourceId: conn.sourceNodeId,
                targetId: conn.targetNodeId,
                oldStrength: oldConn.strength,
                newStrength: conn.strength,
                delta: conn.strength - oldConn.strength,
                activations: conn.activationCount
              };
            }
            return null;
          })
          .filter((change: any) => change !== null);
          
        if (strengthChanges.length > 0) {
          logger.info(`(AggregateThoughts) Hebbian learning changes:`, { strengthChanges });
        }
      }
      
      // 刈り込まれた結合をログ出力
      if (cycleCount > 0) {
        const prunedConnections = existingConnections.filter((oldConn: NodeConnection) => 
          !connections.some((newConn: NodeConnection) => 
            newConn.sourceNodeId === oldConn.sourceNodeId && 
            newConn.targetNodeId === oldConn.targetNodeId
          )
        );
        
        if (prunedConnections.length > 0) {
          logger.info(`(AggregateThoughts) Pruned ${prunedConnections.length} weak connections:`, { 
            prunedConnections: prunedConnections.map((conn: NodeConnection) => ({
              sourceId: conn.sourceNodeId,
              targetId: conn.targetNodeId,
              strength: conn.strength,
              activations: conn.activationCount || 0
            }))
          });
        }
      }
      
      logger.info(`(AggregateThoughts) Generated ${synthesizedThoughts.length} synthesized thoughts and ${connections.length} connections`);
      logger.info(`(AggregateThoughts) Network metrics:`, networkState);
      
      // 状態を含めた結果を返す
      return {
        nodes: newNodes,
        connections,
        synthesizedThoughts,
        networkState,
        cycleCount: cycleCount + 1,
        persistentState: updatedState,
        lastUpdated: new Date()
      };
      
    } catch (error) {
      logger.error("(AggregateThoughts) Error during thought aggregation", { error });
      return { 
        nodes, 
        connections: existingConnections, // エラー時は既存の結合を維持
        synthesizedThoughts: [],
        networkState: { 
          nodeCount: nodes.length, 
          connectionCount: existingConnections.length, 
          error: true 
        },
        cycleCount: cycleCount,
        persistentState: persistentState,
        lastUpdated: new Date()
      };
    }
  }
});
