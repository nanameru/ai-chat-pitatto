import { z } from 'zod';
import { mastra, getLogger } from '..';
import { aggregateThoughts } from '../agents/thoughtAggregationAgent';
import { 
  ThoughtNode, 
  createThoughtNode, 
  calculateNetworkState 
} from '../types/thoughtNode';

/**
 * ThoughtAggregationAgent 統合テスト
 * 
 * このテストは以下を検証します：
 * 1. 思考ノードの作成と型の整合性
 * 2. 思考集約エージェントの基本機能
 * 3. ネットワーク状態の計算
 */
async function runTest() {
  const logger = getLogger();
  logger.info('=== ThoughtAggregation Integration Test ===');

  try {
    const testNodes: ThoughtNode[] = [
      createThoughtNode(
        "AIの倫理的側面は、開発者と利用者の双方に責任がある。開発者は安全性メカニズムを実装し、利用者は適切な使用方法を理解する必要がある。",
        8.5,
        { type: 'initial', tags: ['ethics', 'responsibility'] }
      ),
      createThoughtNode(
        "AIモデルの選択は、タスクの複雑さ、データの量、計算リソース、および期待される精度に基づいて行うべきである。",
        7.2,
        { type: 'initial', tags: ['model_selection', 'resources'] }
      ),
      createThoughtNode(
        "AIシステムの透明性と説明可能性は、ユーザーの信頼を構築し、システムの採用を促進するために不可欠である。",
        8.9,
        { type: 'initial', tags: ['transparency', 'explainability'] }
      ),
      createThoughtNode(
        "実際のAI実装では、理論的な最適解よりも、実用的な制約とユーザーのニーズに合わせたアプローチが重要である。",
        7.8,
        { type: 'initial', tags: ['implementation', 'practical'] }
      )
    ];

    logger.info(`Created ${testNodes.length} test thought nodes`);

    const query = "AIシステムの開発と実装における最適なアプローチは何か？";
    logger.info(`Running thought aggregation with query: "${query}"`);

    const result = await aggregateThoughts({
      nodes: testNodes,
      query,
      existingConnections: []
    });

    logger.info(`Aggregation complete. Generated ${result.connections.length} connections and ${result.synthesizedThoughts.length} synthesized thoughts`);

    result.connections.forEach((conn, idx) => {
      logger.info(`Connection ${idx + 1}: ${conn.sourceNodeId} ↔ ${conn.targetNodeId} (strength: ${conn.strength.toFixed(2)})`);
      logger.info(`  Reasoning: ${conn.reasoning || 'No reasoning provided'}`);
    });

    result.synthesizedThoughts.forEach((thought, idx) => {
      logger.info(`Synthesized Thought ${idx + 1} (confidence: ${thought.confidence.toFixed(2)}):`);
      logger.info(`  Source nodes: ${thought.nodeIds.join(', ')}`);
      logger.info(`  Content: ${thought.content}`);
    });

    const networkState = calculateNetworkState(testNodes, result.connections);
    logger.info('Network state:', networkState);

    return {
      success: true,
      connectionCount: result.connections.length,
      synthesizedThoughtCount: result.synthesizedThoughts.length,
      networkState
    };
  } catch (error) {
    logger.error('Test failed with error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

if (require.main === module) {
  runTest()
    .then(result => {
      console.log('Test result:', JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('Unhandled error:', err);
      process.exit(1);
    });
}

export { runTest };
