import { z } from 'zod';
// Workflow 型を明示的にインポート
import { Workflow, Step, WorkflowContext, StepExecutionContext } from '@mastra/core/workflows';
import {
    clarityCheckAgent,
    clarificationPromptAgent,
    thoughtGeneratorAgent,
    thoughtTransformerAgent,
    synthesizerAgent
} from '../agents';
import { processThoughtsWorkflow, thoughtEvaluationSchema, type ThoughtEvaluation } from './processThoughtsWorkflow';
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

// ★ 型定義を追加
type TransformThoughtOutput = z.infer<typeof transformThoughtOutputSchema>;

// ★ synthesizeStep の入力スキーマを定義
const synthesizeInputSchema = z.object({
  initialThoughts: initialThoughtsOutputSchema.shape.thoughts, // initialThoughtsStep の出力から thoughts を取得
  subQuestions: transformThoughtOutputSchema.shape.subQuestions, // transformThoughtStep の出力から subQuestions を取得
});

// ★ synthesizeStep の出力スキーマを定義
const synthesizeOutputSchema = z.object({
  report: z.string().describe("Synthesized final report in Markdown format."),
});

// ★ NEW: prepareProcessThoughtsInput の入力スキーマ
const prepareProcessThoughtsInputSchema = z.object({
  thoughts: initialThoughtsOutputSchema.shape.thoughts,
  query: triggerSchema.shape.query,
});

// ★ NEW: prepareProcessThoughtsInput の出力スキーマ (processThoughtsWorkflow のトリガースキーマに合わせる)
const prepareProcessThoughtsOutputSchema = z.object({
  thoughts: z.array(z.string()),
  originalQuery: z.string(), // processThoughtsWorkflow 側の期待する名前
});

// ★ NEW: prepareSynthesizeInput の入力スキーマ
const prepareSynthesizeInputSchema = z.object({
  initialThoughts: initialThoughtsOutputSchema.shape.thoughts,
  subQuestions: transformThoughtOutputSchema.shape.subQuestions,
});

// ★ NEW: prepareSynthesizeInput の出力スキーマ (synthesizeStep の入力スキーマと同じ)
const prepareSynthesizeOutputSchema = synthesizeInputSchema;

// 文字列入力のためのヘルパー関数を追加
function reconstructStringFromObjectIfNeeded(input: any): string {
  if (input === null || input === undefined) {
    return '';
  }

  // 入力がオブジェクトで、数値キー（"0", "1", "2"...）を持っているかチェック
  if (typeof input === 'object' && input !== null) {
    // 数値キーが連続しているかチェック
    const keys = Object.keys(input).filter(k => !isNaN(Number(k))).sort((a, b) => Number(a) - Number(b));
    
    // キーが連続した数値（"0", "1", "2"...）の場合、文字列として再構築
    if (keys.length > 0 && keys.every((k, i) => Number(k) === i)) {
      // 配列に変換して結合
      return keys.map(k => input[k]).join('');
    }
  }

  // すでに文字列の場合はそのまま返す
  if (typeof input === 'string') {
    return input;
  }

  // その他の場合は文字列化
  return String(input);
}

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
  description: 'ユーザーの質問を基に最初の思考群を生成するステップ',
  // デバッグのため一時的に any に変更
  inputSchema: z.any().optional(),
  outputSchema: initialThoughtsOutputSchema,
  execute: async ({ context }: StepExecutionContext<any, WorkflowContext<typeof triggerSchema>>) => {
    const logger = mastra.getLogger();

    // ★★★ デバッグログ ★★★
    logger.info('--- [DEBUG] initialThoughtsStep context.inputData ---');
    logger.info(`typeof context.inputData: ${typeof context.inputData}`);
    try {
      logger.info(`context.inputData (JSON): ${JSON.stringify(context.inputData, null, 2)}`);
    } catch (e) {
      logger.error('context.inputData の JSON 文字列化に失敗:', { error: String(e) });
      logger.info(`context.inputData (raw): ${String(context.inputData)}`);
    }
    logger.info('--- [DEBUG] End initialThoughtsStep context.inputData ---');

    // 入力データから query を取得
    let query = '';
    
    // ★ 文字列処理の修正: 入力が文字列オブジェクトの場合の処理を追加
    // "0": "文", "1": "字",... の形式から文字列を再構築
    if (context.inputData) {
      // 文字列を再構築
      query = reconstructStringFromObjectIfNeeded(context.inputData);
      logger.info(`[DEBUG] Reconstructed query: "${query}"`);
    }

    // トリガーデータから取得（初回実行時）
    if (!query && context.triggerData) {
      query = context.triggerData.query;
      logger.info(`[DEBUG] Using trigger query: "${query}"`);
    }

    // 明確化チェック後の入力がある場合はそれを使用（第2パスの場合）
    const clarificationResult = context.getStepResult(requestClarificationStep) as RequestClarificationOutput | null;
    if (clarificationResult && clarificationResult.clarifiedQuery) {
      query = clarificationResult.clarifiedQuery;
      logger.info(`[DEBUG] Using clarified query: "${query}"`);
    }

    if (!query) {
      logger.error("[ERROR] 質問の取得に失敗しました");
      return { thoughts: ["エラー: 質問が見つかりませんでした。"] };
    }

    logger.info(`(InitialThoughts) 生成する思考のクエリ: ${query}`);

    // ★ generate に query を直接渡す
    const agentResponse = await thoughtGeneratorAgent.generate(query);

    // ★ 結果のパース処理を元に戻す
    let generatedThoughts: string[] = ["エラー: 初期思考の生成に失敗しました。"];
    if (agentResponse && agentResponse.text) {
        try {
            let responseText = agentResponse.text.trim();
            // マークダウンのコードブロックを除去
            responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            const parsed = JSON.parse(responseText);
            if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
                generatedThoughts = parsed;
            } else {
                logger.error("(InitialThoughts) パース結果が文字列配列ではありません", { parsed });
                generatedThoughts = ["エラー: エージェントの応答形式が不正です (配列ではありません)。"];
            }
        } catch (parseError) {
            logger.error("(InitialThoughts) エージェント応答のJSONパースに失敗しました", { error: parseError, responseText: agentResponse.text });
            generatedThoughts = ["エラー: エージェントの応答をJSONとして解析できませんでした。", agentResponse.text];
        }
    } else {
        // ★ logger.error から第二引数を削除
        logger.error("(InitialThoughts) エージェントからテキスト応答がありませんでした");
        generatedThoughts = ["エラー: エージェントからテキスト応答がありませんでした。"];
    }

    logger.info(`(InitialThoughts) 生成された思考: ${generatedThoughts.length}件`);
    return { thoughts: generatedThoughts };
  },
});

// ★ NEW: prepareProcessThoughtsInput ステップ
const prepareProcessThoughtsInput = new Step({
    id: 'prepareProcessThoughtsInput',
    description: 'processThoughtsWorkflow への入力を準備するステップ',
    inputSchema: z.any().optional(),
    outputSchema: prepareProcessThoughtsOutputSchema,
    execute: async ({ context }: StepExecutionContext<any, WorkflowContext<typeof triggerSchema>>) => {
        const logger = mastra.getLogger();
        
        // デバッグログ追加
        logger.info("--- [DEBUG] prepareProcessThoughtsInput context ---");
        logger.info(`Steps so far: ${Object.keys(context.steps).join(', ')}`);
        try {
            logger.info(`Initial thoughts step result: ${JSON.stringify(context.getStepResult(initialThoughtsStep), null, 2)}`);
        } catch (e) {
            logger.error("Failed to stringify initialThoughtsStep result", { error: String(e) });
        }
        
        // 明示的に initialThoughtsStep の結果を取得 (型キャストを使用)
        const initialThoughtsResult = context.getStepResult(initialThoughtsStep) as InitialThoughtsOutput | null;
        
        // 思考リストを取得
        let thoughts: string[] = [];
        if (initialThoughtsResult && Array.isArray(initialThoughtsResult.thoughts)) {
            thoughts = initialThoughtsResult.thoughts;
            logger.info(`(PrepareProcessThoughtsInput) Successfully retrieved thoughts from initialThoughtsStep: ${thoughts.length}`);
        } else {
            logger.error("(PrepareProcessThoughtsInput) Failed to get thoughts array from initialThoughtsStep", { initialThoughtsResult });
        }
        
        // Clarified クエリが存在すればそれを使用。無ければトリガーのクエリをフォールバック
        const clarification = context.getStepResult(requestClarificationStep) as RequestClarificationOutput | null;
        const query = clarification?.clarifiedQuery ?? context.triggerData.query;
        logger.info("(PrepareProcessThoughtsInput) Preparing inputs for processThoughtsWorkflow", { 
            thoughtsCount: thoughts.length, 
            query,
            thoughtsExample: thoughts.length > 0 ? thoughts[0] : 'none'
        });
        
        return {
            thoughts: thoughts,
            originalQuery: query
        };
    },
});

// ★ NEW: prepareSynthesizeInput ステップ
const prepareSynthesizeInput = new Step({
    id: 'prepareSynthesizeInput',
    description: 'synthesizeStep への入力を準備するステップ',
    inputSchema: z.any().optional(),
    outputSchema: prepareSynthesizeOutputSchema,
    execute: async ({ context }: StepExecutionContext<any, WorkflowContext<typeof triggerSchema>>) => {
        const logger = mastra.getLogger();
        const initialThoughtsResult = context.getStepResult(initialThoughtsStep) as InitialThoughtsOutput | null;
        const initialThoughts = initialThoughtsResult?.thoughts ?? [];
        // ★ transformThoughtStep の出力型を明示的に取得
        const transformResult = context.getStepResult(transformThoughtStep) as z.infer<typeof transformThoughtOutputSchema> | null;
        const subQuestions = transformResult?.subQuestions ?? [];
        logger.info("(PrepareSynthesizeInput) Preparing inputs for synthesizeStep", { initialThoughtsCount: initialThoughts.length, subQuestionsCount: subQuestions.length });
        return {
            initialThoughts: initialThoughts,
            subQuestions: subQuestions,
        };
    },
});

// ★ transformThoughtStep の execute 関数の入力型を事前に定義
const transformStepInputType = z.object({ selectedThought: thoughtEvaluationSchema.optional() });

// ★ 新しいステップ: transformThoughtStep
const transformThoughtStep = new Step({
  id: 'transformThoughtStep',
  description: '選択された思考を基にサブクエスチョンを生成するステップ',
  inputSchema: transformStepInputType, // ★ 事前定義した型を使用
  outputSchema: transformThoughtOutputSchema,
  // ★ execute の型パラメータを修正: ステップ自身を参照せず、直接スキーマを指定 -> ★ 事前定義した型を使用
  execute: async ({ context }: StepExecutionContext<typeof transformStepInputType, WorkflowContext<typeof triggerSchema>>) => {
    const logger = mastra.getLogger();

    // ★ デバッグログ追加: 受け取った inputData の内容を確認 (これは残してもOK)
    logger.info("--- [DEBUG] transformThoughtStep received inputData --- ");
    try {
        logger.info(`context.inputData (JSON): ${JSON.stringify(context.inputData, null, 2)}`);
    } catch (e) {
        logger.error('transformThoughtStep context.inputData の JSON 文字列化に失敗:', { error: String(e) });
        logger.info(`transformThoughtStep context.inputData (raw): ${String(context.inputData)}`);
    }
    logger.info("--- [DEBUG] End transformThoughtStep received inputData ---");

    // ★★★ 修正: processThoughtsSubWorkflow の結果を取得する手順を改善 ★★★
    let selectedThoughtData: ThoughtEvaluation | undefined = undefined;
    
    try {
        // サブワークフローの結果をまず取得
        const subWorkflowResult = context.getStepResult('processThoughtsSubWorkflow');
        logger.info("(TransformThoughtStep) Raw subWorkflowResult:", { subWorkflowResult });
        
        // 可能性のあるデータパスをすべて試す
        if (subWorkflowResult) {
            // パターン1: 直接 selectedThought を持つ場合
            if (subWorkflowResult.selectedThought) {
                selectedThoughtData = subWorkflowResult.selectedThought;
                logger.info("(TransformThoughtStep) Found selectedThought directly in subWorkflowResult");
            }
            // パターン2: results > selectNodeStep > output 内にある場合
            else if (subWorkflowResult.results?.selectNodeStep?.output?.selectedThought) {
                selectedThoughtData = subWorkflowResult.results.selectNodeStep.output.selectedThought;
                logger.info("(TransformThoughtStep) Found selectedThought in results.selectNodeStep.output");
            }
            // パターン3: output > selectedThought 内にある場合
            else if (subWorkflowResult.output?.selectedThought) {
                selectedThoughtData = subWorkflowResult.output.selectedThought;
                logger.info("(TransformThoughtStep) Found selectedThought in output");
            }
            // 他にも可能性があればここに追加
            else {
                logger.warn("(TransformThoughtStep) Could not find selectedThought in any expected location", { subWorkflowResult });
            }
        } else {
            logger.warn("(TransformThoughtStep) No subWorkflowResult returned from getStepResult");
        }
    } catch (e) {
        logger.error("(TransformThoughtStep) Error retrieving subWorkflowResult", { error: String(e) });
    }

    const query = context.triggerData.query; // これはトリガー時の元のクエリのまま

    // ★ 修正: selectedThoughtData 自体の存在を確認
    if (!selectedThoughtData) {
      logger.warn("(TransformThoughtStep) No valid selected thought retrieved. Skipping sub-question generation.");
      return { subQuestions: [] };
    }

    logger.info("(TransformThoughtStep) Transforming thought:", {
      // ★ 修正: selectedThoughtData から直接プロパティにアクセス
      thought: selectedThoughtData.thought,
      score: selectedThoughtData.score,
      reasoning: selectedThoughtData.reasoning
    });

    try {
      const result = await generateSubQuestions({
        // ★ 修正: selectedThoughtData.thought を渡す
        selectedThought: selectedThoughtData.thought,
        originalQuery: query,
      });
      logger.info("(TransformThoughtStep) Generated sub-questions:", { subQuestions: result.subQuestions });
      return result;
    } catch (error) {
      // ★ エラーをオブジェクトでラップ
      logger.error("(TransformThoughtStep) Error generating sub-questions:", { error: String(error) });
      return { subQuestions: [] };
    }
  },
});

// ★ 新しいステップ: synthesizeStep
const synthesizeStep = new Step({
  id: 'synthesizeStep',
  description: '初期思考とサブクエスチョンを統合して最終レポートを生成するステップ',
  inputSchema: synthesizeInputSchema,
  outputSchema: synthesizeOutputSchema,
  execute: async ({ context }: StepExecutionContext<typeof synthesizeInputSchema>) => {
    const logger = mastra.getLogger();

    // ★★★ デバッグログを追加 ★★★
    logger.info('--- [DEBUG] synthesizeStep context.inputData ---');
    logger.info(`typeof context.inputData: ${typeof context.inputData}`);
    try {
      logger.info(`context.inputData (JSON): ${JSON.stringify(context.inputData, null, 2)}`);
    } catch (e) {
      logger.error('synthesizeStep context.inputData の JSON 文字列化に失敗:', { error: String(e) });
      logger.info(`synthesizeStep context.inputData (raw): ${String(context.inputData)}`);
    }
    logger.info('--- [DEBUG] End synthesizeStep context.inputData ---');

    // 入力からデータを抽出、オブジェクトに変換された文字列の可能性を考慮
    let initialThoughts: string[] = [];
    let subQuestions: string[] = [];

    try {
      // 初期の思考とサブクエスチョンを取得
      // 可能であれば前のステップから
      const initialThoughtsResult = context.getStepResult(initialThoughtsStep) as InitialThoughtsOutput | null;
      if (initialThoughtsResult) {
        initialThoughts = initialThoughtsResult.thoughts || [];
      }

      const transformResult = context.getStepResult(transformThoughtStep) as TransformThoughtOutput | null;
      if (transformResult) {
        subQuestions = transformResult.subQuestions || [];
      }

      // InputData から取得 (文字列化された可能性を考慮)
      if (initialThoughts.length === 0 && context.inputData && context.inputData.initialThoughts) {
        initialThoughts = Array.isArray(context.inputData.initialThoughts) 
                         ? context.inputData.initialThoughts 
                         : [reconstructStringFromObjectIfNeeded(context.inputData.initialThoughts)];
      }

      if (subQuestions.length === 0 && context.inputData && context.inputData.subQuestions) {
        subQuestions = Array.isArray(context.inputData.subQuestions) 
                     ? context.inputData.subQuestions 
                     : [reconstructStringFromObjectIfNeeded(context.inputData.subQuestions)];
      }

      logger.info(`[DEBUG] Initial thoughts: ${JSON.stringify(initialThoughts)}`);
      logger.info(`[DEBUG] SubQuestions: ${JSON.stringify(subQuestions)}`);

      const prompt = `
以下の情報を統合し、構造化された最終レポートをMarkdown形式で生成してください。

### 初期思考
${initialThoughts.map(t => `- ${t}`).join('\n')}

### サブクエスチョン
${subQuestions.map(q => `- ${q}`).join('\n')}

レポート:
`;

      const result = await synthesizerAgent.generate(prompt);
      const report = result.text || 'エラー: レポートの生成に失敗しました。';
      logger.info("(SynthesizeStep) Generated report successfully.");
      // 最終レポートの内容を詳細にログ出力
      logger.info("=========== 最終レポート内容 =============");
      logger.info(report);
      logger.info("=========== 最終レポート終了 =============");
      return { report };
    } catch (error) {
      // ★ エラーをオブジェクトでラップ
      logger.error("(SynthesizeStep) Error calling synthesizerAgent:", { error: String(error) });
      return { report: 'エラー: レポート生成中に問題が発生しました。' };
    }
  },
});

// ★★★ ワークフローチェインの修正 ★★★
goTResearchWorkflow
  .step(clarityCheckStep)
  // requestClarificationStep は clarityCheckStep の出力を暗黙的に受け取る
  .then(requestClarificationStep)
  // initialThoughtsStep は requestClarificationStep の出力を暗黙的に受け取る
  .then(initialThoughtsStep)
  // ★ 中間ステップ prepareProcessThoughtsInput を挿入
  .then(prepareProcessThoughtsInput)
  // ★ processThoughtsWorkflow は prepareProcessThoughtsInput の出力を variables でマッピング
  .then(processThoughtsWorkflow, {
    variables: {
      // '$output' は直前の prepareProcessThoughtsInput の出力全体を指す
      trigger: { step: prepareProcessThoughtsInput, path: '$output' }
    }
  })
  // ★ transformThoughtStep は processThoughtsWorkflow の出力を暗黙的に受け取る
  .then(transformThoughtStep)
  // ★ 中間ステップ prepareSynthesizeInput を挿入
  .then(prepareSynthesizeInput)
  // ★ synthesizeStep は prepareSynthesizeInput の出力を暗黙的に受け取る
  .then(synthesizeStep)
  .commit();

// --- 共通関数: 初期思考生成 (現在は未使用) ---
/*
async function generateInitialThoughts(query: string): Promise<string[]> {
    // ... (省略) ...
}
*/ 