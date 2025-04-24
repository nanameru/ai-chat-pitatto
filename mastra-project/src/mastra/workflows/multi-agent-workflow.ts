import { copywriterAgent, editorAgent } from '../agents';
import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Step 1: Copywriter Agentによる初期ブログ投稿の作成
const copywriterStep = new Step({
  id: 'copywriterStep',
  description: 'トピックに基づいて初期ブログ投稿を作成する',
  inputSchema: z.object({ topic: z.string() }),
  outputSchema: z.object({ copy: z.string() }),
  execute: async ({ context }) => {
    const { topic } = context.triggerData;
    const result = await copywriterAgent.generate(
      `Create a blog post about ${topic}`
    );
    console.log('copywriter result', result.text);
    return { copy: result.text };
  },
});

// Step 2: Editor Agentによる投稿の洗練
const editorStep = new Step({
  id: 'editorStep',
  description: 'コピーライターの投稿を編集する',
  inputSchema: z.object({ copy: z.string() }),
  outputSchema: z.object({ copy: z.string() }),
  execute: async ({ context }) => {
    const { copy } = context.getStepResult(copywriterStep) || { copy: '' };
    const result = await editorAgent.generate(
      `Edit the following blog post only returning the edited copy: ${copy}`
    );
    console.log('editor result', result.text);
    return { copy: result.text };
  },
});

// ワークフロー定義
export const multiAgentWorkflow = new Workflow({
  name: 'multi-agent-workflow',
  triggerSchema: z.object({ topic: z.string() }),
});

multiAgentWorkflow
  .step(copywriterStep)
  .then(editorStep)
  .commit(); 