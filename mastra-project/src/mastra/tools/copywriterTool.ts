import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { copywriterAgent } from '../agents/copywriterAgent';

export const copywriterTool = createTool({
  id: 'copywriter-agent',
  description: '指定されたトピックについてブログ投稿のコピーを生成するコピーライターエージェントを呼び出します。',
  inputSchema: z.object({
    topic: z.string().describe('ブログ投稿のトピック'),
  }),
  outputSchema: z.object({
    copy: z.string().describe('生成されたブログ投稿のコピー'),
  }),
  execute: async ({ context }) => {
    const { topic } = context;
    const result = await copywriterAgent.generate(
      `Create a blog post about ${topic}`
    );
    return { copy: result.text };
  },
}); 