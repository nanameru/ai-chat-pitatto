import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import * as searchTools from '../tools';

// エージェントが受け取るであろう情報 (selectedThought と originalQuery を想定)
const inputSchema = z.object({
    selectedThought: z.string().describe("現在注目している思考"),
    originalQuery: z.string().describe("元のユーザーからの質問"),
});

// エージェントの出力スキーマ (サブクエスチョンのリスト)
export const subQuestionsOutputSchema = z.object({
    subQuestions: z.array(z.string()).describe("生成されたサブクエスチョンのリスト"),
    searchResults: z.array(z.object({
        source: z.string().describe("検索結果のソース"),
        query: z.string().describe("使用された検索クエリ"),
        results: z.array(z.any()).describe("検索結果のリスト"),
    })).optional().describe("収集された検索結果（存在する場合）"),
});

// プロンプトテンプレート
export const generateSubQuestionsPrompt = (input: z.infer<typeof inputSchema>): string => `
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
  instructions: `
# =====================  ThoughtTransformerAgent Prompt  =====================
prompt:
  role: |
    あなたは「高度なリサーチアシスタント」です。
    与えられた「思考（selectedThought）」と「元の質問（originalQuery）」を起点にリサーチを行い、
    さらなる調査を深掘りするための具体的なサブクエスチョンを 3 件 提案してください。

  goal:
    - multiple_sub_questions: >
        指定フォーマット (JSON 配列) で 3 つのサブクエスチョンを生成する。
    - relevance: >
        各サブクエスチョンは元の質問と選択された思考の双方に明確に関連していること。
    - diversity: >
        可能な限り重複しない視点・情報源を提示し、幅広い調査角度を提供すること。
    - tool_usage: >
        サブクエスチョン生成のために、tool_policy に従い **必ず1つ以上の検索ツールを使用** すること。（特に tavilySearchTool は必須）

  input_schema:
    originalQuery: "string: 元のユーザー質問"
    selectedThought: "string: 現在注目している思考"

  tool_policy:
    - tool: tavilySearchTool
      priority: 1           # 最高優先度
      mandatory: true
      purpose: |
        幅広く包括的な検索結果を取得するために必ず最初に使用する。
    - tool: webSearchTool
      priority: 2
      mandatory: false
      purpose: "一般的な事実、最新ニュースを補完するときに使用する。"
    - tool: arxivSearchTool
      priority: 3
      mandatory: false
      purpose: "学術論文・研究動向を調べる際に使用する。"
    - tool: youTubeSearchTool
      priority: 3
      mandatory: false
      purpose: "動画講義やデモンストレーションを参照したい場合に使用する。"
    - tool: redditSearchTool
      priority: 4
      mandatory: false
      purpose: "コミュニティの体験談や議論を探す際に使用する。"
    - tool: mediumSearchTool
      priority: 4
      mandatory: false
      purpose: "専門家の解説記事を探す際に使用する。"
    - tool: noteSearchTool
      priority: 4
      mandatory: false
      purpose: "日本語ブログ／クリエイター記事を探す際に使用する。"

  quality_criteria:
    - SMART: |
        各サブクエスチョンは SMART 原則
        （Specific, Measurable, Achievable, Relevant, Time-bound）の
        うち少なくとも「Specific・Relevant」を満たすこと。
    - answerability: "検索結果や文献調査に基づき、回答可能なレベルの具体性を持つこと。"
    - uniqueness: "3 件のサブクエスチョンが互いに重複しないこと。"

  workflow_steps:
    - "Step 1: 入力（originalQuery, selectedThought）を理解し、重要キーワードを抽出する。"
    - "Step 2: tool_policy に従って必ず tavilySearchTool を呼び出し、概要を把握する。"
    - "Step 3: 必要に応じて他ツールを組み合わせ、追加の情報を取得する。"
    - "Step 4: 収集した情報をもとに、quality_criteria を満たす 3 件のサブクエスチョン案を生成する。"
    - "Step 5: 最終チェックを行い、出力フォーマットに整形して回答する。"

  output_format: |
    \`\`\`json
    [
      "サブクエスチョン 1",
      "サブクエスチョン 2",
      "サブクエスチョン 3"
    ]
    \`\`\`

  examples:
    success: |
      \`\`\`json
      [
        "現在ビジネスで広く利用されているAIチャットボットの主な種類と、それぞれの導入コストの相場は？（Web検索）",
        "製造業で導入されている画像認識系AIツールの具体的な事例と効果測定結果は？（Tavily検索＋論文検索）",
        "中小企業がAIツール導入時に直面するデータプライバシー課題と、その解決策を示す最新研究は？（arXiv検索）"
      ]
      \`\`\`
    failure: |
      \`\`\`json
      {
        "error": "出力が配列形式ではありません"
      }
      \`\`\`
# ============================================================================
`,
  model: openai('gpt-4.1'),
  tools: {
    tavilySearchTool: searchTools.tavilySearchTool,
    webSearchTool: searchTools.webSearchTool,
  },
});

// エージェントを利用する際のヘルパー関数 (型安全のため)
export async function generateSubQuestions(input: z.infer<typeof inputSchema>): Promise<z.infer<typeof subQuestionsOutputSchema>> {
    const logger = (await import('..')).mastra.getLogger(); // mastra インスタンス経由で logger 取得
    const prompt = generateSubQuestionsPrompt(input);
    logger.info("(ThoughtTransformerAgent) Generating sub-questions with prompt:", { prompt });
    logger.info("(ThoughtTransformerAgent) generateSubQuestions called with input:", { input });

    try {
        // agent.generate() の戻り値の型を仮定 (Vercel AI SDK の GenerateTextResult に準ずる)
        // 正確な型が分かれば修正する
        const response: any = await thoughtTransformerAgent.generate(prompt); 
        logger.info("(ThoughtTransformerAgent) Raw agent response received.", { response });

        let subQuestions: string[] = [];
        if (response.text) {
            try {
                let responseText = response.text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                const parsedJson = JSON.parse(responseText);
                if (Array.isArray(parsedJson) && parsedJson.every((item: unknown) => typeof item === 'string')) {
                    subQuestions = parsedJson as string[];
                    logger.info("(ThoughtTransformerAgent) Sub-questions extracted successfully.", { subQuestions });
                } else {
                     logger.warn("(ThoughtTransformerAgent) Agent response text is not an array of strings.", { responseText });
                }
            } catch (parseError) {
                logger.error("(ThoughtTransformerAgent) Failed to parse agent response JSON from text.", { error: parseError, responseText: response.text });
            }
        } else if (!response.toolCalls || response.toolCalls.length === 0) {
             logger.error("(ThoughtTransformerAgent) Agent returned no text and no tool calls.");
             // テキストもツール呼び出しもない場合はエラーを投げるか、空を返すか検討
             // ここでは一旦空を返す方針とする
             // throw new Error("Agent returned no text and no tool calls."); 
             return { subQuestions: [], searchResults: undefined };
        }

        // toolCalls と toolResults から searchResults を構築
        const searchResults: z.infer<typeof subQuestionsOutputSchema>['searchResults'] = [];
        // response.toolCalls や response.toolResults が存在するかチェック
        if (response.toolCalls && Array.isArray(response.toolCalls) && 
            response.toolResults && Array.isArray(response.toolResults)) {
            
             logger.info(`(ThoughtTransformerAgent) Found ${response.toolCalls.length} tool calls and ${response.toolResults.length} tool results.`);
             
            for (const toolCall of response.toolCalls) {
                // toolCall がオブジェクトで、必要なプロパティを持っているか確認
                if (typeof toolCall === 'object' && toolCall !== null && 'toolCallId' in toolCall && 'toolName' in toolCall && 'args' in toolCall) {
                    const matchingResult = response.toolResults.find((result: any) => 
                        typeof result === 'object' && result !== null && 'toolCallId' in result && result.toolCallId === toolCall.toolCallId
                    );
                    
                    if (matchingResult && 'result' in matchingResult) {
                        // toolCall.args から query を取得 (args の構造に依存する)
                        // args がオブジェクトであることを期待
                        let queryArg = 'unknown query';
                        if (typeof toolCall.args === 'object' && toolCall.args !== null && 'query' in toolCall.args) {
                            queryArg = String((toolCall.args as any).query);
                        } else {
                             logger.warn("(ThoughtTransformerAgent) Tool call args does not contain a 'query' property or is not an object.", { args: toolCall.args });
                        }

                        searchResults.push({
                            source: String(toolCall.toolName),
                            query: queryArg,
                            // matchingResult.result が配列でない場合も配列にする
                            results: Array.isArray(matchingResult.result) ? matchingResult.result : [matchingResult.result],
                        });
                        logger.info("(ThoughtTransformerAgent) Added search result entry.", { entry: searchResults[searchResults.length - 1] });
                    } else {
                        logger.warn(`(ThoughtTransformerAgent) No matching result found or result format incorrect for tool call ID: ${toolCall.toolCallId}`);
                    }
                } else {
                     logger.warn("(ThoughtTransformerAgent) Invalid toolCall format found in response.", { toolCall });
                }
            }
             logger.info(`(ThoughtTransformerAgent) Constructed ${searchResults.length} search results.`);
        } else {
             logger.info("(ThoughtTransformerAgent) No tool calls or tool results found in the response, or they are not arrays.");
        }

        // 最終的な結果オブジェクトを返す
        const finalResult: z.infer<typeof subQuestionsOutputSchema> = {
            subQuestions,
            // searchResults が空配列の場合は undefined にする (optional なので)
            searchResults: searchResults.length > 0 ? searchResults : undefined,
        };
        logger.info("(ThoughtTransformerAgent) Final result constructed.", { finalResult });

        return finalResult;

    } catch (error) {
        logger.error("(ThoughtTransformerAgent) Error during agent generation or processing.", { error });
        // エラー時はデフォルトの空リストを返す
        return { subQuestions: [], searchResults: undefined };
    }
} 