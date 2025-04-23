import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import OpenAI from 'openai';

// Step 1: LLMでユーザー入力へのフィードバックを生成
const provideFeedback = new Step({
  id: 'provideFeedback',
  description: 'ユーザー入力に対するフィードバックをLLMで生成する',
  inputSchema: z.object({ userText: z.string() }),
  outputSchema: z.object({ userText: z.string(), feedback: z.string() }),
  execute: async ({ context }) => {
    const { userText } = context.triggerData;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: `次の文章にフィードバックをお願いします：\n"${userText}"` }
      ],
      temperature: 0.5,
    });
    const feedback = completion.choices[0].message.content || '';
    return { userText, feedback };
  },
});

// Step 2: suspend()を呼び出し、人間のオペレーターにフィードバックをレビュー・応答してもらう
const reviewFeedback = new Step({
  id: 'reviewFeedback',
  description: 'フィードバックを受け取って人間の応答を取得する',
  inputSchema: z.object({ userResponse: z.string() }),
  outputSchema: z.object({ userResponse: z.string() }),
  execute: async ({ context, suspend }) => {
    const prev = context.getStepResult(provideFeedback) || { userText: '', feedback: '' };
    const { userText, feedback } = prev;
    // まだ人間の入力がない場合、一時停止
    if (!context.inputData || !context.inputData.userResponse) {
      await suspend({
        userText,
        feedback,
        message: 'フィードバックを確認し、応答を入力してください。',
      });
      return { userResponse: '' };
    }
    // 人間の応答を返却
    return { userResponse: context.inputData.userResponse };
  },
});

// Step 3: オリジナル文章と人間の応答を基に最終文章を生成
const generateFinal = new Step({
  id: 'generateFinal',
  description: 'オリジナル文章とユーザー応答を踏まえて最終文章を生成する',
  outputSchema: z.object({ finalText: z.string() }),
  execute: async ({ context }) => {
    const prev1 = context.getStepResult(provideFeedback) || { userText: '', feedback: '' };
    const prev2 = context.getStepResult(reviewFeedback) || { userResponse: '' };
    const { userText, feedback } = prev1;
    const { userResponse } = prev2;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'オリジナル文章とそのフィードバックへの応答を踏まえて、改善された最終文章を作成してください。' },
        { role: 'user', content: `オリジナル文章："${userText}"\n\nフィードバック："${feedback}"\n\nユーザー応答："${userResponse}"` }
      ],
      temperature: 0.5,
    });
    const finalText = completion.choices[0].message.content || '';
    return { finalText };
  },
});

// Workflow定義
export const humanInTheLoopWorkflow = new Workflow({
  name: 'human-in-the-loop-workflow',
  triggerSchema: z.object({
    userText: z.string().describe('ユーザーが入力する原文'),
  }),
});

humanInTheLoopWorkflow
  .step(provideFeedback)
  .then(reviewFeedback)
  .then(generateFinal)
  .commit();
