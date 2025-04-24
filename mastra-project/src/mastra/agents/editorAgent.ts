import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

// エディターエージェントの定義
export const editorAgent = new Agent({
  name: 'Editor',
  instructions: 'あなたはブログ投稿のコピーを編集するエディターエージェントです。',
  model: openai('gpt-4o-mini'),
}); 