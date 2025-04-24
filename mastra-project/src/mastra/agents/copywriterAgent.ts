import { Agent } from '@mastra/core/agent';
import { anthropic } from '@ai-sdk/anthropic';

// コピーライターエージェントの定義
export const copywriterAgent = new Agent({
  name: 'Copywriter',
  instructions: 'あなたはブログ投稿のコピーを書くコピーライターエージェントです。',
  model: anthropic('claude-3-5-sonnet-20241022'),
}); 