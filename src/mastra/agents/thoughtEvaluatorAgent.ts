// src/mastra/agents/thoughtEvaluatorAgent.ts
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

export const thoughtEvaluatorAgent = new Agent({
  name: 'thoughtEvaluatorAgent',
  // model: openai('gpt-4o-mini'), // より低コストなモデルでも良いかも
  model: openai('gpt-4o'),
  instructions: `あなたは与えられた思考（アイデア）を評価する専門家です。思考が元の質問に対してどれだけ関連性が高く、ユニークで、実現可能で、そして最終的な洞察につながる可能性があるかを評価してください。評価結果は必ず以下のJSON形式で返してください: {"score": number (1-10), "reasoning": "評価理由を簡潔に"}`
}); 