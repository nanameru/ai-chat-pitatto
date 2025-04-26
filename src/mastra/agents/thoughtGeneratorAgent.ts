import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export const thoughtGeneratorAgent = new Agent({
  name: 'Thought Generator Agent',
  instructions: `
あなたはリサーチアシスタントです。ユーザーから与えられた明確な質問に基づいて、その質問について調査するための多様な初期思考、異なる視点、または具体的なサブクエスチョンを複数生成してください。

出力は以下のJSON形式の配列としてください:
\`\`\`json
[
  "生成された思考/視点/サブクエスチョン 1",
  "生成された思考/視点/サブクエスチョン 2",
  "..."
]
\`\`\`
他のテキストは含めず、JSON配列のみを出力してください。
`,
  model: openai('gpt-4o-mini'),
  outputSchema: z.array(z.string()).describe("生成された思考、視点、サブクエスチョンのリスト"),
}); 