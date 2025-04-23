import { Mastra } from '@mastra/core';
import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import OpenAI from 'openai';

// AIに関する文章を生成するステップ
const generateAIContentStep = new Step({
  id: 'generateAIContent',
  outputSchema: z.object({
    content: z.string(),
  }),
  execute: async ({ context }) => {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ 
        role: 'user', 
        content: "AIの歴史、現在の状況、将来の可能性について簡潔に説明してください。" 
      }],
      temperature: 0.7,
      max_tokens: 500
    });
    
    return { content: completion.choices[0].message.content || "AI情報を生成できませんでした。" };
  },
});

// ちいかわについて説明するステップ
const generateChiikawaContentStep = new Step({
  id: 'generateChiikawaContent',
  outputSchema: z.object({
    content: z.string(),
  }),
  execute: async ({ context }) => {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ 
        role: 'user', 
        content: "「ちいかわ」というキャラクターについて、その特徴や人気の理由を説明してください。" 
      }],
      temperature: 0.7,
      max_tokens: 500
    });
    
    return { content: completion.choices[0].message.content || "ちいかわに関する情報を生成できませんでした。" };
  },
});

// 評価ステップ - ユーザークエリを数値化して判断
const evaluateQueryStep = new Step({
  id: 'evaluateQuery',
  outputSchema: z.object({
    queryValue: z.number(),
  }),
  execute: async ({ context }) => {
    // トリガーデータからユーザークエリ値を取得
    const queryValue = context.triggerData.queryValue;
    return { queryValue };
  },
});

// 結果を整形する最終ステップ
const formatResultStep = new Step({
  id: 'formatResult',
  outputSchema: z.object({
    result: z.string(),
    topic: z.string(),
  }),
  execute: async ({ context }) => {
    // 実行されたどちらかのブランチから結果を取得
    const aiContent = context.getStepResult<{ content: string }>('generateAIContent')?.content;
    const chiikawaContent = context.getStepResult<{ content: string }>('generateChiikawaContent')?.content;

    const content = aiContent || chiikawaContent;
    const topic = aiContent ? 'AI' : 'ちいかわ';
    
    return { 
      result: content || "コンテンツが生成されませんでした。",
      topic
    };
  },
});

// 条件分岐を持つワークフローを構築
const conditionalContentWorkflow = new Workflow({
  name: 'test-conditional-content-workflow',
  triggerSchema: z.object({
    queryValue: z.number(),
  }),
});

conditionalContentWorkflow
  .step(evaluateQueryStep)
  .if(async ({ context }) => {
    const value = context.getStepResult<{ queryValue: number }>('evaluateQuery')?.queryValue ?? 0;
    return value > 10; // 条件: 値が10より大きい
  })
  .then(generateChiikawaContentStep)
  .then(formatResultStep)
  .else()
  .then(generateAIContentStep)
  .then(formatResultStep)
  .commit();

export { conditionalContentWorkflow };

// 使用例
export async function runConditionalContentWorkflow(queryValue: number) {
  const { start } = conditionalContentWorkflow.createRun();
  
  const result = await start({
    triggerData: { queryValue },
  });
  
  return result.results;
} 