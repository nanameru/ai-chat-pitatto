import { z } from 'zod';
// Workflow 型を明示的にインポート, WorkflowOptions も追加
import { Workflow, Step, WorkflowContext, StepExecutionContext, WorkflowOptions } from '@mastra/core/workflows';
// import { mastra } from '..'; // <-- この行を削除
import { clarityCheckAgent, clarificationPromptAgent, thoughtGeneratorAgent } from '../agents'; // clarificationPromptAgent をインポート
import { processThoughtsWorkflow } from './processThoughtsWorkflow'; // ★ 作成したサブワークフローをインポート
// Agent の generate の戻り値型 (必要に応じてインポート)
// import { GenerateTextResult } from '@ai-sdk/provider';
// TODO: Define and import the agent responsible for generating clarification prompts
// import { clarificationPromptAgent } from '../agents'; // <-- この行は不要なので削除

// ワークフローのトリガースキーマ (ユーザーからの入力)
const triggerSchema = z.object({
  query: z.string().describe('The initial question from the user.'),
});

// このスキーマはAgentの出力に合わせて調整が必要です
const clarityCheckOutputSchema = z.object({
    isClear: z.boolean().optional(), // Agentが出力する想定
    reasoning: z.string().optional(), // Agentが出力する想定
}).passthrough(); // Agentが他のフィールドを返す可能性を考慮

// ジェネリックなしの Workflow 型を試す
export const goTResearchWorkflow: Workflow = new Workflow({
  name: 'goTResearchWorkflow',
  // description: 'Workflow for the GoT Research process, starting with clarity check.', // description はオプションにない可能性
  triggerSchema,
  // mastra, // <-- この行も削除 (またはコメントアウト)
});

// clarityCheckStep の定義
const clarityCheckStep = new Step({
  id: 'clarityCheckStep',
  description: 'ユーザーの質問が明確かどうかを判断するステップ',
  inputSchema: triggerSchema,
  outputSchema: clarityCheckOutputSchema,
  execute: async ({ context }: StepExecutionContext<typeof triggerSchema>) => {
    console.log("(ClarityCheckStep) Checking clarity for query:", context.triggerData.query);
    try {
        // AgentにJSON形式での出力を期待するプロンプトを追加するなどの工夫が必要
        const result = await clarityCheckAgent.generate(
            `ユーザーの質問「${context.triggerData.query}」が明確かどうかを判断し、理由とともにJSON形式で {"isClear": boolean, "reasoning": string} のように答えてください。明確な場合は reasoning は省略可能です。`
        );
        // Agentのテキスト出力をパース
        if (result.text) {
            try {
                const parsed = JSON.parse(result.text);
                console.log("(ClarityCheckStep) Parsed agent response:", parsed);
                // isClear が boolean であればそれを採用、なければ false 扱い (安全のため)
                const isClear = typeof parsed.isClear === 'boolean' ? parsed.isClear : false;
                 // reasoning が string であればそれを採用
                const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined;
                return { isClear, reasoning };
            } catch (parseError) {
                console.error("(ClarityCheckStep) Failed to parse agent response JSON:", parseError, "Response text:", result.text);
                // パース失敗時は不明確扱い
                return { isClear: false, reasoning: "エージェントの応答を解析できませんでした。" };
            }
        } else {
             console.error("(ClarityCheckStep) Agent did not return text.");
             return { isClear: false, reasoning: "エージェントからテキスト応答がありませんでした。" };
        }
    } catch (agentError) {
        console.error("(ClarityCheckStep) Error calling clarityCheckAgent:", agentError);
        return { isClear: false, reasoning: "明確性チェックエージェントの呼び出し中にエラーが発生しました。" };
    }
  },
});

// ★ initialThoughtsStep の入力スキーマを定義 ★
const initialThoughtsInputSchema = z.object({
    query: z.string().describe("明確化された、または最初から明確だった質問"),
});

// ★ initialThoughtsStep の定義を修正 ★
const initialThoughtsStep = new Step({
  id: 'initialThoughtsStep',
  description: '明確な質問に基づき、多様な初期思考を生成するステップ',
  inputSchema: initialThoughtsInputSchema, // ★ 変更 ★
  outputSchema: z.object({
      thoughts: z.array(z.string()).describe("生成された初期思考のリスト")
  }),
  // ★ 型引数を変更 ★
  execute: async ({ context }: StepExecutionContext<typeof initialThoughtsInputSchema>) => {
    // ★ context.inputData から query を取得 ★
    const clearQuery = context.inputData.query;
    console.log("(InitialThoughtsStep) Generating initial thoughts for query:", clearQuery);

    let generatedThoughts: string[] = ["エラー: 初期思考の生成に失敗しました。"]; // デフォルトエラーメッセージ
    try {
        const agentResponse = await thoughtGeneratorAgent.generate(
             `与えられた質問「${clearQuery}」について、多様な観点からの初期思考を5つ提案してください。JSON配列形式で ["思考1", "思考2", ...] のように答えてください。`
        );
        if (agentResponse.text) {
            try {
                const parsed = JSON.parse(agentResponse.text);
                if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
                    generatedThoughts = parsed;
                } else {
                   console.error("(InitialThoughtsStep) Parsed response is not an array of strings:", parsed);
                   generatedThoughts = ["エラー: エージェントの応答形式が不正です (配列ではありません)。"];
                }
            } catch (parseError) {
                console.error("(InitialThoughtsStep) Failed to parse thought generator agent response:", parseError, "Response text:", agentResponse.text);
                generatedThoughts = ["エラー: エージェントの応答をJSONとして解析できませんでした。"];
            }
        } else {
            console.error("(InitialThoughtsStep) Thought generator agent did not return text.");
            generatedThoughts = ["エラー: エージェントからテキスト応答がありませんでした。"];
        }
    } catch (error) {
        console.error("(InitialThoughtsStep) Failed to generate initial thoughts:", error);
        generatedThoughts = ["エラー: 初期思考の生成中に問題が発生しました。"];
    }

    console.log("(InitialThoughtsStep) Generated initial thoughts:", generatedThoughts);
    return { thoughts: generatedThoughts };
  },
});

// ★ requestClarificationStep の出力スキーマを定義 ★
// resume 時に明確化されたクエリを返すようにする
const requestClarificationOutputSchema = z.object({
    clarifiedQuery: z.string().describe("ユーザーによって明確化された質問"),
}).optional(); // suspend 時は出力がないため optional

const requestClarificationStep = new Step({
  id: 'requestClarificationStep',
  description: '質問が不明確な場合に明確化要求を生成し、一時停止するステップ',
  // inputSchema: triggerSchema, // input は triggerData から取得するので不要かも
  inputSchema: z.any().optional(), // inputData を受け取るために必要
  outputSchema: requestClarificationOutputSchema, // ★ 出力スキーマを設定 ★
  execute: async ({ context, suspend }: StepExecutionContext<any, WorkflowContext<typeof triggerSchema>>) => {

    // --- resume 時の処理 ---
    // inputData に userClarification が含まれていれば、それが明確化されたクエリ
    if (context.inputData?.userClarification && typeof context.inputData.userClarification === 'string') {
        const clarifiedQuery = context.inputData.userClarification;
        console.log("(RequestClarificationStep) Resumed with clarification:", clarifiedQuery);
        // ★ 明確化されたクエリを出力として返す ★
        return { clarifiedQuery: clarifiedQuery };
    }

    // --- suspend 時の処理 ---
    const clarityResult = context.getStepResult(clarityCheckStep)?.output;
    // isClear が false の場合のみ実行される想定だが、念のため reasoning を取得
    // clarityResult や reasoning が存在するか、型が string かを確認し、なければデフォルト値を設定
    const reasoning = (clarityResult && typeof clarityResult.reasoning === 'string') ? clarityResult.reasoning : undefined;
    const originalQuery = context.triggerData.query;

    console.log("(RequestClarificationStep) Query is unclear. Generating clarification prompt...");
    const prompt = `ユーザーの質問「${originalQuery}」は不明確だと判断されました。理由: ${reasoning || '提示されていません'}。ユーザーに質問内容の明確化を促す、丁寧で具体的な質問文を生成してください。`;
    let generatedClarificationQuestion = "エラー: 質問生成中に問題が発生しました。";
    try {
        const agentResponse = await clarificationPromptAgent.generate(prompt);
        generatedClarificationQuestion = agentResponse.text || generatedClarificationQuestion;
    } catch (error) {
        console.error("(RequestClarificationStep) Failed to generate clarification prompt:", error);
    }

    console.log("(RequestClarificationStep) Generated question:", generatedClarificationQuestion);
    // suspend する。resume 時には inputData として userClarification を期待
    await suspend({ clarificationPrompt: generatedClarificationQuestion });
    console.log("(RequestClarificationStep) Workflow suspended, waiting for clarification.");

    // suspend する場合は、outputSchema に合致する値を返さない (undefined を返す)
    // outputSchema を optional にしているのでこれで OK
    return undefined;
  },
});

// ★ 共通関数を呼び出すステップ 1 (明確な場合) ★
const initialThoughtsDirectStep = new Step({
    id: 'initialThoughtsDirectStep',
    description: '明確な質問に基づき初期思考を生成する (共通関数呼び出し)',
    inputSchema: triggerSchema, // triggerData を受け取る
    outputSchema: z.object({
        thoughts: z.array(z.string()).describe("生成された初期思考のリスト"),
    }),
    execute: async ({ context }: StepExecutionContext<typeof triggerSchema>) => {
        const thoughts = await generateInitialThoughts(context.triggerData.query);
        return { thoughts };
    }
});

// ★ 共通関数を呼び出すステップ 2 (不明確→明確化後の場合) ★
// このステップの入力は requestClarificationStep の出力
const initialThoughtsAfterClarificationInputSchema = z.object({
    clarifiedQuery: z.string(), // requestClarificationStep から渡される想定
});
const initialThoughtsAfterClarificationStep = new Step({
    id: 'initialThoughtsAfterClarificationStep',
    description: '明確化された質問に基づき初期思考を生成する (共通関数呼び出し)',
    inputSchema: initialThoughtsAfterClarificationInputSchema,
    outputSchema: z.object({
        thoughts: z.array(z.string()).describe("生成された初期思考のリスト"),
    }),
    execute: async ({ context }: StepExecutionContext<typeof initialThoughtsAfterClarificationInputSchema>) => {
        const thoughts = await generateInitialThoughts(context.inputData.clarifiedQuery);
        return { thoughts };
    }
});

// ワークフロー構築部分を修正
goTResearchWorkflow
  .step(clarityCheckStep)
  .if(async ({ context }) => {
    const clarityResult = context.getStepResult(clarityCheckStep)?.output;
    // clarityCheckStep の isClear を参照
    const isClear = clarityResult?.isClear;
    console.log(`(If Condition) Is query clear? ${isClear}`);
    // isClear が true の場合に .then に進む
    return isClear === true;
  })
    // --- 1. 明確な場合のパス ---
    .then(initialThoughtsDirectStep) // 共通関数を呼び出すステップ
    .then(processThoughtsWorkflow, { // ★ サブワークフローを呼び出す ★
        variables: {
            // initialThoughtsDirectStep の出力をサブWFの入力(thoughts)にマッピング
            thoughts: { step: initialThoughtsDirectStep, path: 'thoughts' }
        }
    })
  .else()
    // --- 2. 不明瞭な場合のパス ---
    .then(requestClarificationStep) // suspend する可能性があるステップ
    // requestClarificationStep の後に initialThoughtsAfterClarificationStep を実行
    .then(initialThoughtsAfterClarificationStep, {
        variables: {
            // requestClarificationStep の出力 (clarifiedQuery) を
            // initialThoughtsAfterClarificationStep の入力 (clarifiedQuery) にマッピング
            clarifiedQuery: { step: requestClarificationStep, path: 'clarifiedQuery' } // output. なし
        },
        // requestClarificationStep が成功した場合のみ実行
        when: async ({ context }) => {
            const result = context.getStepResult(requestClarificationStep);
            const condition = result?.status === 'success' && typeof result?.output?.clarifiedQuery === 'string';
            console.log(`(When condition for initialThoughtsAfterClarificationStep) ${condition}`, result);
            return condition;
        }
    })
    .then(processThoughtsWorkflow, { // ★ 同じサブワークフローを呼び出す ★
        variables: {
            // initialThoughtsAfterClarificationStep の出力をサブWFの入力(thoughts)にマッピング
            thoughts: { step: initialThoughtsAfterClarificationStep, path: 'thoughts' }
        },
         // initialThoughtsAfterClarificationStep が成功した場合のみ実行
         when: async ({ context }) => {
            const result = context.getStepResult(initialThoughtsAfterClarificationStep);
            const condition = result?.status === 'success';
            console.log(`(When condition for processThoughtsWorkflow after clarification) ${condition}`, result);
            return condition;
        }
    })
  // --- 3. 合流後の処理 (サブワークフローが完了した後) ---
  // 必要であれば、サブワークフローの完了を待ってさらにステップを追加
  // .after(processThoughtsWorkflow) // この書き方ができるか要確認
  // .step(finalSummaryStep)
  .commit();

// サンプルコードにあった createRun と start はワークフロー定義には含めません。
// これらはワークフローを外部から実行する際に使用します。

// --- 共通関数: 初期思考生成 ---
async function generateInitialThoughts(query: string): Promise<string[]> {
    console.log("(generateInitialThoughts) Generating thoughts for query:", query);
    let generatedThoughts: string[] = ["エラー: 初期思考の生成に失敗しました。"];
     try {
        // thoughtGeneratorAgent を呼び出す (プロンプト調整やエラー処理は Agent 側で行う方が良い場合もある)
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