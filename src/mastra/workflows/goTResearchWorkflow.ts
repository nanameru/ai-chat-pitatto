import { z } from 'zod';
// Workflow 型を明示的にインポート
import { Workflow, Step, WorkflowContext, StepExecutionContext } from '@mastra/core/workflows';
import { clarityCheckAgent, clarificationPromptAgent, thoughtGeneratorAgent, thoughtTransformerAgent } from '../agents';
import { processThoughtsWorkflow, thoughtEvaluationSchema } from './processThoughtsWorkflow';
// ★ mastra インスタンスをインポート ★
import { mastra } from '..';

// ★ ThoughtTransformerAgent の generateSubQuestions 関数と出力スキーマをインポート
import { generateSubQuestions, subQuestionsOutputSchema } from '../agents/thoughtTransformerAgent';

// ワークフローのトリガースキーマ (ユーザーからの入力)
const triggerSchema = z.object({
  query: z.string().describe('The initial question from the user.'),
});

// isClearとreasoningを明示的に定義し、passthroughを削除
const clarityCheckOutputSchema = z.object({
    isClear: z.boolean(),
    reasoning: z.string().optional(),
});

// 型定義を明示的に追加
type ClarityCheckOutput = z.infer<typeof clarityCheckOutputSchema>;

// requestClarificationステップの出力型
const requestClarificationOutputSchema = z.object({
    clarifiedQuery: z.string().describe("ユーザーによって明確化された質問"),
});

// 型定義を明示的に追加
type RequestClarificationOutput = z.infer<typeof requestClarificationOutputSchema>;

// initialThoughtsステップの出力型
const initialThoughtsOutputSchema = z.object({
    thoughts: z.array(z.string()).describe("生成された初期思考のリスト")
});

// 型定義を明示的に追加
type InitialThoughtsOutput = z.infer<typeof initialThoughtsOutputSchema>;

// ★ transformThoughtStep の入力スキーマを定義
const transformThoughtInputSchema = z.object({
  selectedThought: z.object({
    selectedThought: thoughtEvaluationSchema.optional().describe("選択された思考とその評価"),
  }).describe("processThoughtsWorkflow からの選択された思考"),
  query: triggerSchema.shape.query.describe("元のユーザーからの質問"),
});

// ★ transformThoughtStep の出力スキーマを定義 (サブクエスチョンのリスト)
const transformThoughtOutputSchema = subQuestionsOutputSchema;

// ジェネリックなしの Workflow 型を試す
export const goTResearchWorkflow: Workflow = new Workflow({
  name: 'goTResearchWorkflow',
  triggerSchema,
});

// clarityCheckStep の定義
const clarityCheckStep = new Step({
  id: 'clarityCheckStep',
  description: 'ユーザーの質問が明確かどうかを判断するステップ',
  inputSchema: triggerSchema,
  outputSchema: clarityCheckOutputSchema,
  execute: async ({ context }: StepExecutionContext<typeof triggerSchema>) => {
    const logger = mastra.getLogger();
    logger.info("(ClarityCheckStep) Checking clarity for query", { query: context.triggerData.query });
    try {
        const result = await clarityCheckAgent.generate(
            `ユーザーの質問「${context.triggerData.query}」が明確かどうかを判断し、理由とともにJSON形式で {"isClear": boolean, "reasoning": string} のように答えてください。明確な場合は reasoning は省略可能です。`
        );
        if (result.text) {
            try {
                const parsed = JSON.parse(result.text);
                logger.info("(ClarityCheckStep) Parsed agent response", { parsed });
                const isClear = typeof parsed.isClear === 'boolean' ? parsed.isClear : false;
                const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined;
                return { isClear, reasoning };
            } catch (parseError) {
                logger.error("(ClarityCheckStep) Failed to parse agent response JSON", { error: parseError, responseText: result.text });
                return { isClear: false, reasoning: "エージェントの応答を解析できませんでした。" };
            }
        } else {
             logger.error("(ClarityCheckStep) Agent did not return text");
             return { isClear: false, reasoning: "エージェントからテキスト応答がありませんでした。" };
        }
    } catch (agentError) {
        logger.error("(ClarityCheckStep) Error calling clarityCheckAgent", { error: agentError });
        return { isClear: false, reasoning: "明確性チェックエージェントの呼び出し中にエラーが発生しました。" };
    }
  },
});

const requestClarificationStep = new Step({
  id: 'requestClarificationStep',
  description: '質問が不明確な場合に明確化要求を生成し、一時停止するステップ',
  inputSchema: z.any().optional(),
  outputSchema: requestClarificationOutputSchema,
  execute: async ({ context, suspend }: StepExecutionContext<any, WorkflowContext<typeof triggerSchema>>) => {
    const logger = mastra.getLogger();
    // ★★★ デバッグ用: context の内容をログ出力 ★★★
    console.log("--- RequestClarificationStep Context Start ---");
    console.log(JSON.stringify(context, null, 2));
    console.log("--- RequestClarificationStep Context End ---");

    // ★★★ resume かどうかの判断を isResume キーで行う ★★★
    const isResuming = context.isResume !== undefined;

    if (isResuming) {
        logger.info("(RequestClarificationStep) Workflow is resuming.");
        let clarifiedQuery = '';
        // ★★★ inputData から文字列を復元 ★★★
        if (context.inputData && typeof context.inputData === 'object' && Object.keys(context.inputData).length > 0) {
           try {
               // オブジェクトの値を順番に結合して文字列にする
               clarifiedQuery = Object.values(context.inputData).join('');
               logger.info("(RequestClarificationStep) Reconstructed clarified query from inputData", { clarifiedQuery });
           } catch (e) {
               logger.error("(RequestClarificationStep) Failed to reconstruct query from inputData", { inputData: context.inputData, error: e});
               clarifiedQuery = 'エラー: 再開データの処理に失敗';
           }
        } else {
            logger.warn("(RequestClarificationStep) Resumed but inputData seems empty or invalid.", { inputData: context.inputData });
            clarifiedQuery = 'エラー: 再開データが空または不正';
        }
        return { clarifiedQuery: clarifiedQuery };
    }

    // --- 以下は isResuming が false (初回実行時) の処理 ---

    const clarityCheckResult = context.getStepResult(clarityCheckStep) as ClarityCheckOutput | null;

    if (clarityCheckResult?.isClear === true) {
        logger.info("(RequestClarificationStep) Query is clear. Skipping clarification and passing original query.", { query: context.triggerData.query });
        return { clarifiedQuery: context.triggerData.query };
    }

    // 初回不明確時: 質問を生成して suspend
    const reasoning = clarityCheckResult?.reasoning;
    const originalQuery = context.triggerData.query;

    // ログメッセージを修正
    logger.info("(RequestClarificationStep) Query is unclear (initial run). Generating clarification prompt...");
    const prompt = `ユーザーの質問「${originalQuery}」は不明確だと判断されました。理由: ${reasoning || '提示されていません'}。ユーザーに質問内容の明確化を促す、丁寧で具体的な質問文を生成してください。`;
    let generatedClarificationQuestion = "エラー: 質問生成中に問題が発生しました。";
    try {
        const agentResponse = await clarificationPromptAgent.generate(prompt);
        generatedClarificationQuestion = agentResponse.text || generatedClarificationQuestion;
    } catch (error) {
        logger.error("(RequestClarificationStep) Failed to generate clarification prompt", { error });
    }

    logger.info("(RequestClarificationStep) Generated question", { generatedClarificationQuestion });
    await suspend({ clarificationPrompt: generatedClarificationQuestion });
    logger.info("(RequestClarificationStep) Workflow suspended, waiting for clarification.");

    // suspend した場合はこの return には到達しない
    return { clarifiedQuery: '' };
  },
});

// initialThoughtsStep の定義
const initialThoughtsStep = new Step({
  id: 'initialThoughtsStep',
  description: '明確な質問に基づき、初期思考を生成するステップ',
  inputSchema: z.any().optional(),
  outputSchema: initialThoughtsOutputSchema,
  execute: async ({ context }: StepExecutionContext<any, WorkflowContext<typeof triggerSchema>>) => {
    const logger = mastra.getLogger();
    let query = context.triggerData.query; // デフォルトは元のクエリ

    // ★★★ 修正点 ★★★
    // 1. requestClarificationStep の結果を取得
    const clarificationStepResult = context.getStepResult(requestClarificationStep) as RequestClarificationOutput | null;

    // 2. clarifiedQuery が存在し、空でなければ、それを使用
    if (clarificationStepResult?.clarifiedQuery && clarificationStepResult.clarifiedQuery !== '') {
        logger.info("(InitialThoughtsStep) Using clarified query", { clarifiedQuery: clarificationStepResult.clarifiedQuery });
        query = clarificationStepResult.clarifiedQuery;
    } else {
        // clarifiedQuery がない場合（clarityCheckStep が true だった、またはエラー）は元のクエリを使用
        logger.info("(InitialThoughtsStep) Using original query (clarification not needed or available)", { query });
        // query はデフォルト値のまま
    }

    logger.info("(InitialThoughtsStep) Generating initial thoughts for query", { query });
    let generatedThoughts: string[] = ["エラー: 初期思考の生成に失敗しました。"];
    try {
        const agentResponse = await thoughtGeneratorAgent.generate(
             `与えられた質問「${query}」について、質問内で指定された主要な観点（例：コスト、技術、政策、社会的側面など）それぞれに紐づく形で、調査の出発点となる初期思考を合計5つ程度提案してください。もし質問内に明確な観点が指定されていない場合は、多様な観点から提案してください。JSON配列形式で ["思考1", "思考2", ...] のように答えてください。`
        );
        if (agentResponse.text) {
            try {
                // ★★★ 追加: Markdownコードブロックを除去 ★★★
                let responseText = agentResponse.text || '';
                // 行頭の ```json とそれに続く空白/改行、および末尾の空白/改行と ``` を削除
                responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                
                // ★★★ 修正後のテキストでパース ★★★
                const parsed = JSON.parse(responseText);
                if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
                    generatedThoughts = parsed;
                } else {
                   logger.error("(InitialThoughtsStep) Parsed response is not an array of strings", { parsed });
                   generatedThoughts = ["エラー: エージェントの応答形式が不正です (配列ではありません)。"];
                }
            } catch (parseError) {
                logger.error("(InitialThoughtsStep) Failed to parse thought generator agent response", { error: parseError, responseText: agentResponse.text });
                generatedThoughts = ["エラー: エージェントの応答をJSONとして解析できませんでした。"];
            }
        } else {
            logger.error("(InitialThoughtsStep) Thought generator agent did not return text");
            generatedThoughts = ["エラー: エージェントからテキスト応答がありませんでした。"];
        }
    } catch (error) {
        logger.error("(InitialThoughtsStep) Failed to generate initial thoughts", { error });
        generatedThoughts = ["エラー: 初期思考の生成中に問題が発生しました。"];
    }

    logger.info("(InitialThoughtsStep) Generated initial thoughts", { generatedThoughts });
    return { thoughts: generatedThoughts };
  },
});

// ★ 新しいステップ: transformThoughtStep
const transformThoughtStep = new Step({
  id: 'transformThoughtStep',
  description: '選択された思考を基にサブクエスチョンを生成するステップ',
  inputSchema: transformThoughtInputSchema,
  outputSchema: transformThoughtOutputSchema,
  execute: async ({ context }: StepExecutionContext<typeof transformThoughtInputSchema>) => {
    const logger = mastra.getLogger();
    const { selectedThought, query } = context.inputData;
    
    // 選択された思考がない場合（エラーなど）
    if (!selectedThought || !selectedThought.selectedThought) {
      logger.warn("(TransformThoughtStep) No selected thought to transform. Skipping.");
      // サブクエスチョンが生成できなかったことを示す空リストを返す
      return { subQuestions: [] };
    }
    
    const selectedThoughtData = selectedThought.selectedThought;
    logger.info("(TransformThoughtStep) Transforming thought:", { 
      thought: selectedThoughtData.thought,
      score: selectedThoughtData.score,
      reasoning: selectedThoughtData.reasoning
    });
    
    try {
      // ThoughtTransformerAgent のヘルパー関数を使用してサブクエスチョンを生成
      const result = await generateSubQuestions({
        selectedThought: selectedThoughtData.thought,
        originalQuery: query,
      });
      
      logger.info("(TransformThoughtStep) Generated sub-questions:", { subQuestions: result.subQuestions });
      return result;
    } catch (error) {
      logger.error("(TransformThoughtStep) Error generating sub-questions:", { error });
      return { subQuestions: [] }; // エラー時は空のリストを返す
    }
  },
});

// 直線的なワークフロー構造を定義
goTResearchWorkflow
  .step(clarityCheckStep)
  .then(requestClarificationStep)
  .then(initialThoughtsStep)
  .then(processThoughtsWorkflow, {
    variables: {
      thoughts: { step: initialThoughtsStep, path: 'thoughts' },
      originalQuery: { workflow: 'trigger', path: 'query' } // originalQuery パラメータを渡す
    }
  })
  // ★ 新しいステップ: processThoughtsWorkflow の次に transformThoughtStep を実行
  .then(transformThoughtStep, {
    variables: {
      selectedThought: { step: processThoughtsWorkflow, path: '$output' }, // サブワークフローの出力全体を渡す
      query: { workflow: 'trigger', path: 'query' }  // 元のクエリも渡す
    }
  })
  .commit();

// --- 共通関数: 初期思考生成 ---
async function generateInitialThoughts(query: string): Promise<string[]> {
    console.log("(generateInitialThoughts) Generating thoughts for query:", query);
    let generatedThoughts: string[] = ["エラー: 初期思考の生成に失敗しました。"];
     try {
        const agentResponse = await thoughtGeneratorAgent.generate(
             `与えられた質問「${query}」について、多様な観点からの初期思考を5つ提案してください。JSON配列形式で ["思考1", "思考2", ...] のように答えてください。`
        );
        if (agentResponse.text) {
            try {
                const parsed = JSON.parse(agentResponse.text);
                if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
                    generatedThoughts = parsed;
                } else {
                   console.error("(generateInitialThoughts) Parsed response is not an array of strings:", parsed);
                   generatedThoughts = ["エラー: エージェントの応答形式が不正です (配列ではありません)。"];
                }
            } catch (parseError) {
                console.error("(generateInitialThoughts) Failed to parse thought generator agent response:", parseError, "Response text:", agentResponse.text);
                generatedThoughts = ["エラー: エージェントの応答をJSONとして解析できませんでした。"];
            }
        } else {
            console.error("(generateInitialThoughts) Thought generator agent did not return text.");
            generatedThoughts = ["エラー: エージェントからテキスト応答がありませんでした。"];
        }
    } catch (error) {
        console.error("(generateInitialThoughts) Failed to generate initial thoughts:", error);
        generatedThoughts = ["エラー: 初期思考の生成中に問題が発生しました。"];
    }
    console.log("(generateInitialThoughts) Generated thoughts:", generatedThoughts);
    return generatedThoughts;
} 