import { Agent } from '@mastra/core/agent'; // Mastra の Agent クラス
import { openai } from '@ai-sdk/openai';   // OpenAI モデルを使うため
import { z } from 'zod';                   // 出力形式を定義するため

// SynthesizerAgent の定義
export const synthesizerAgent = new Agent({
  // エージェントの名前 (識別子)
  name: 'Synthesizer Agent',

  // 使用する言語モデル (他のエージェントに合わせて gpt-4o-mini を使用)
  model: openai('gpt-4o-mini'),

  // エージェントへの指示 (GoTの Synthesize の役割を意識)
  instructions: `
あなたは、リサーチ結果を統合する専門家です。
与えられた複数の情報（初期思考、サブクエスチョンなど）を分析し、構造化された最終レポートを生成してください。
レポートは読者が理解しやすいように、要点を明確にし、論理的な流れで記述してください。
出力は Markdown 形式の文字列のみとしてください。
`,

  // 出力の形式を Zod で定義 (シンプルなレポート文字列)
  // responseSchema: z.object({
  //   report: z.string().describe('Markdown formatted final report synthesizing the inputs'),
  // }),

  // このエージェントは外部ツールを使わない想定なので、tools は指定しません。
}); 