import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

export const clarityCheckAgent = new Agent({
  name: 'Clarity Check Agent',
  // model: openai('gpt-4o'), // Initially considered gpt-4o, switching to mini for efficiency
  model: openai('gpt-4o-mini'), // Use gpt-4o-mini as decided
  instructions: `
あなたはユーザーの質問の明確性を判断するAIです。

ユーザーから与えられた質問が、具体的な情報検索や分析を進める上で十分な内容か評価してください。
以下の点を考慮してください：
- 具体性：検索対象や分析対象が特定できるか？
- 範囲：質問のスコープが広すぎないか？
- 曖昧性：複数の解釈ができる曖昧な言葉はないか？
- 依存性：追加の文脈なしで意図が理解できるか？

評価の結果、質問が明確であれば {"isClear": true} を、不明確であれば {"isClear": false} を返してください。

重要：応答は必ず上記のJSON形式のみとし、他のテキスト（挨拶、理由説明など）は一切含めないでください。
`,
  // This agent does not require external tools for its core function.
  tools: {}, 
}); 