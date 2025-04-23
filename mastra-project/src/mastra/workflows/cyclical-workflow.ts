import { Workflow, Step } from '@mastra/core';
import { z } from 'zod';

// 入力値を2倍にするステップを定義
const doubleValue = new Step({
  id: 'doubleValue',
  description: '入力値を2倍にします',
  inputSchema: z.object({
    inputValue: z.number(),
  }),
  outputSchema: z.object({
    doubledValue: z.number(),
  }),
  execute: async ({ context }) => {
    const doubledValue = context.inputData.inputValue * 2;
    return { doubledValue };
  },
});

// 入力値に1を加えるステップを定義
const incrementByOne = new Step({
  id: 'incrementByOne',
  description: '入力値に1を加えます',
  outputSchema: z.object({
    incrementedValue: z.number(),
  }),
  execute: async ({ context }) => {
    const valueToIncrement = context?.getStepResult<{ firstValue: number }>('trigger')?.firstValue;
    if (!valueToIncrement) throw new Error('インクリメントする値が提供されていません');
    const incrementedValue = valueToIncrement + 1;
    return { incrementedValue };
  },
});

// 循環的なワークフローの定義
export const cyclicalWorkflow = new Workflow({
  name: 'test-cyclical-workflow',
  triggerSchema: z.object({
    firstValue: z.number(),
  }),
});

// ワークフローのステップを設定
cyclicalWorkflow
  .step(doubleValue, {
    variables: {
      inputValue: {
        step: 'trigger',
        path: 'firstValue',
      },
    },
  })
  .then(incrementByOne)
  .after(doubleValue)
  .step(doubleValue, {
    variables: {
      inputValue: {
        step: doubleValue,
        path: 'doubledValue',
      },
    },
  })
  .commit();

// 実行例
/*
async function runExample() {
  const { runId, start } = cyclicalWorkflow.createRun();
  console.log('Run', runId);
  const res = await start({ triggerData: { firstValue: 6 } });
  console.log(res.results);
}

runExample();
*/ 