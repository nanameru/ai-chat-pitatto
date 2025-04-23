import { cyclicalWorkflow, whileLoopWorkflow } from './workflows';
import { memoryAgent } from './agents';

/**
 * 循環的ワークフローの実行例
 */
export async function runCyclicalWorkflowExample() {
  const { runId, start } = cyclicalWorkflow.createRun();
  console.log('実行ID:', runId);
  
  // 初期値6で実行
  const res = await start({ triggerData: { firstValue: 6 } });
  
  console.log('=== 循環的ワークフロー実行結果 ===');
  console.log(JSON.stringify(res.results, null, 2));
  console.log('===============================');
  
  return res.results;
}

/**
 * Whileループワークフローの実行例
 */
export async function runWhileLoopWorkflowExample() {
  const { runId, start } = whileLoopWorkflow.createRun();
  console.log('実行ID:', runId);
  
  // 0から始めて5になるまでインクリメント
  const res = await start({ triggerData: { startValue: 0, targetValue: 5 } });
  
  console.log('=== Whileループワークフロー実行結果 ===');
  console.log(JSON.stringify(res.results, null, 2));
  console.log('===============================');
  
  return res.results;
}

/**
 * エージェントメモリーの実行例
 */
export async function runMemoryAgentExample() {
  console.log('=== Memory Agent Example ===');
  const resourceId = 'user_alice';
  const threadId = 'preferences_thread';
  // 初回: ユーザーの好みを記憶させる
  await memoryAgent.generate('私の好きな色は青です。', { resourceId, threadId });
  // 記憶を参照させる
  const response = await memoryAgent.generate('私の好きな色は何ですか？', { resourceId, threadId });
  console.log('Agent response:', response);
  return response;
}

// コマンドラインから直接実行された場合、両方の例を実行
if (require.main === module) {
  (async () => {
    console.log('循環的ワークフローを実行中...');
    await runCyclicalWorkflowExample();
    
    console.log('\nWhileループワークフローを実行中...');
    await runWhileLoopWorkflowExample();
    
    console.log('\nMemory Agent Exampleを実行中...');
    await runMemoryAgentExample();
  })().catch(err => {
    console.error('実行中にエラーが発生しました:', err);
    process.exit(1);
  });
} 