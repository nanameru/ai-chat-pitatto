import { Workflow, Step } from '@mastra/core';
import { z } from 'zod';

// カウンターをインクリメントするステップ
const incrementStep = new Step({
  id: 'increment',
  description: 'カウンターを1つ増やします',
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ context }) => {
    // 前回の実行から現在の値を取得するか、0から開始
    const currentValue =
      context.getStepResult<{ value: number }>('increment')?.value ||
      context.getStepResult<{ startValue: number }>('trigger')?.startValue ||
      0;

    // 値をインクリメント
    const value = currentValue + 1;
    console.log(`${value}にインクリメントしました`);

    return { value };
  },
});

// 最終ステップ
const finalStep = new Step({
  id: 'final',
  description: 'ループ完了後の最終ステップ',
  execute: async ({ context }) => {
    const finalValue = context.getStepResult<{ value: number }>('increment')?.value;
    console.log(`ループが完了し、最終値は ${finalValue} です`);
    return { finalValue };
  },
});

// ワークフローの作成
export const whileLoopWorkflow = new Workflow({
  name: 'test-while-loop-workflow',
  triggerSchema: z.object({
    startValue: z.number(),
    targetValue: z.number(),
  }),
});

// while条件付きのワークフローを構成
whileLoopWorkflow
  .step(incrementStep)
  .while(
    async ({ context }) => {
      const targetValue = context.triggerData.targetValue;
      const currentValue = context.getStepResult('increment')?.value ?? 0;
      return currentValue < targetValue;
    },
    incrementStep
  )
  .then(finalStep)
  .commit();

// 実行例
/*
async function runExample() {
  const run = whileLoopWorkflow.createRun();
  const result = await run.start({ triggerData: { startValue: 0, targetValue: 5 } });
  // 0から4までインクリメントし、その後停止して最終ステップを実行
  console.log(result.results);
}

runExample();
*/ 