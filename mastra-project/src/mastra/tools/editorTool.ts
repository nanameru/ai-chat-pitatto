import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { editorAgent } from '../agents/editorAgent';

export const editorTool = createTool({
  id: 'editor-agent',
  description: 'ブログ投稿のコピーを編集するためにエディターエージェントを呼び出します。',
  inputSchema: z.object({
    copy: z.string().describe('ブログ投稿のコピー'),
  }),
  outputSchema: z.object({
    copy: z.string().describe('編集されたブログ投稿のコピー'),
  }),
  execute: async ({ context }) => {
    const { copy } = context;
    const result = await editorAgent.generate(
      `Edit the following blog post only returning the edited copy: ${copy}`
    );
    return { copy: result.text };
  },
}); 