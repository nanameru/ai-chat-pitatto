import { Agent } from '@mastra/core/agent';
import { anthropic } from '@ai-sdk/anthropic';
import { copywriterTool } from '../tools/copywriterTool';
import { editorTool } from '../tools/editorTool';

// パブリッシャーエージェントの定義
export const publisherAgent = new Agent({
  name: 'publisherAgent',
  instructions: `
    あなたは特定のトピックについてブログ投稿のコピーを書くために
    まずコピーライターエージェントを呼び出し、
    その後コピーを編集するためにエディターエージェントを呼び出すパブリッシャーエージェントです。
    最終的な編集済みのコピーのみを返します。
  `,
  model: anthropic('claude-3-5-sonnet-20241022'),
  tools: {
    copywriterTool,
    editorTool,
  },
}); 