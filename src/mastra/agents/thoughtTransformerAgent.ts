import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// エージェントが受け取るであろう情報 (selectedThought と originalQuery を想定)
const inputSchema = z.object({
    selectedThought: z.string().describe("現在注目している思考"),
    originalQuery: z.string().describe("元のユーザーからの質問"),
});

// エージェントの出力スキーマ (サブクエスチョンのリスト)
export const subQuestionsOutputSchema = z.object({
    subQuestions: z.array(z.string()).describe("生成されたサブクエスチョンのリスト"),
});

// プロンプトテンプレート
const generateSubQuestionsPrompt = (input: z.infer<typeof inputSchema>): string => `
あなたは優秀なリサーチャーです。以下の情報に基づいて、思考をさらに深掘りするための具体的なサブクエスチョンを生成してください。

元の質問:
"${input.originalQuery}"

現在注目している思考:
"${input.selectedThought}"

この思考から派生する、調査を進める上で次に明らかにするべき具体的なサブクエスチョンを3つ提案してください。
各質問は、具体的で焦点を絞り、可能であれば特定の情報源（例: Web検索、論文検索、専門家への質問）での調査を念頭に置いた形にしてください。

出力は必ず以下のJSON形式の配列で返してください:
["質問1", "質問2", "質問3"]
`;

// ThoughtTransformerAgent の定義
export const thoughtTransformerAgent = new Agent({
  name: 'thoughtTransformerAgent',
  description: '入力された思考に基づいて、調査を深掘りするためのサブクエスチョンを生成するエージェント。',
  instructions: 'ユーザーから与えられた思考と元の質問に基づき、具体的なサブクエスチョンを生成し、指定されたJSON形式で出力してください。',
  model: openai('gpt-4o-mini'), // モデルは適宜選択
});

// エージェントを利用する際のヘルパー関数 (型安全のため)
export async function generateSubQuestions(input: z.infer<typeof inputSchema>): Promise<z.infer<typeof subQuestionsOutputSchema>> {
    const logger = (await import('..')).mastra.getLogger(); // mastra インスタンス経由で logger 取得
    const prompt = generateSubQuestionsPrompt(input);
    logger.info("(ThoughtTransformerAgent) Generating sub-questions with prompt:", { prompt });

    try {
        const response = await thoughtTransformerAgent.generate(prompt);
        if (!response.text) {
            logger.error("(ThoughtTransformerAgent) Agent returned no text.");
            throw new Error("Agent returned no text.");
        }

        // JSON パースとバリデーション
        try {
             // Markdown コードブロックを除去する可能性を考慮
            let responseText = response.text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            const parsedJson = JSON.parse(responseText);
            
            // 配列形式かどうか確認
            if (Array.isArray(parsedJson) && parsedJson.every(item => typeof item === 'string')) {
                const result = { subQuestions: parsedJson };
                logger.info("(ThoughtTransformerAgent) Sub-questions generated successfully.", { subQuestions: result.subQuestions });
                return result;
            } else {
                logger.error("(ThoughtTransformerAgent) Agent response is not an array of strings.", { responseText });
                throw new Error("Agent response is not an array of strings.");
            }
        } catch (parseError) {
             logger.error("(ThoughtTransformerAgent) Failed to parse agent response JSON.", { error: parseError, responseText: response.text });
             throw new Error(`Failed to parse agent response JSON: ${parseError}`);
        }
    } catch (error) {
        logger.error("(ThoughtTransformerAgent) Error during agent generation.", { error });
        // エラー時はデフォルトの空リストを返す
        return { subQuestions: [] };
    }
} 