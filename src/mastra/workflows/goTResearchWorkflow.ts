import { z } from 'zod';
// Workflow 型を明示的にインポート
import { Workflow, Step, WorkflowContext, StepExecutionContext } from '@mastra/core/workflows';
import {
    clarityCheckAgent,
    clarificationPromptAgent,
    thoughtGeneratorAgent,
    thoughtTransformerAgent,
    synthesizerAgent,
    thoughtAggregationAgent
} from '../agents';
import { aggregateThoughtsStep } from './steps/aggregateThoughtsStep';
import {
  processThoughtsWorkflow,
  // ★ ThoughtEvaluation 型をインポート
  type ThoughtEvaluation,
  // ★ thoughtEvaluationSchema をインポート
  thoughtEvaluationSchema,
} from './processThoughtsWorkflow';
// ★ getLogger をインポート ★
import { getLogger } from '..';
// ★ Node.js の標準ユーティリティを追加 ★
import { inspect } from 'util';

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
    // ★ インポートしたスキーマを使用
    selectedThought: thoughtEvaluationSchema.optional().describe("選択された思考とその評価"),
  }).describe("processThoughtsWorkflow からの選択された思考"),
  query: triggerSchema.shape.query.describe("元のユーザーからの質問"),
});

// ★ transformThoughtStep の出力スキーマを定義 (サブクエスチョンのリスト)
const transformThoughtOutputSchema = z.object({
  selectedThought: z.custom<ThoughtEvaluation>().optional(),
  subQuestions: z.array(z.string()),
});

// ★ 型定義を追加
type TransformThoughtOutput = z.infer<typeof transformThoughtOutputSchema>;

// ★ synthesizeStep の入力スキーマを定義
const synthesizeInputSchema = z.object({
  query: z.string(),
  subQuestions: z.array(z.string()),
  bestThought: z.any().optional(),
  searchResults: z.array(z.object({
    source: z.string(),
    query: z.string(),
    results: z.array(z.any()),
  })).optional(),
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
  query: z.string(),
  subQuestions: z.array(z.string()),
  selectedThought: z.any().optional(),
});

// ★ NEW: prepareSynthesizeInput の出力スキーマ (synthesizeStep の入力スキーマと同じ)
const prepareSynthesizeOutputSchema = synthesizeInputSchema;

// ★ NEW: prepareSynthesizeInput ステップ
const prepareSynthesizeInput = new Step({
    id: 'prepareSynthesizeInput',
    description: 'synthesizeStep への入力を準備するステップ',
    inputSchema: z.any().optional(),
    outputSchema: synthesizeInputSchema,
    execute: async ({ context }: StepExecutionContext<any>) => {
        const logger = getLogger();
        
        // ループからの最終結果を取得 (researchCycleStep の最後の実行結果)
        const cycleResult = context.getStepResult(researchCycleStep);
        const clarificationResult = context.getStepResult(requestClarificationStep);
        
        // 元のクエリまたは明確化されたクエリを取得
        const query = clarificationResult?.clarifiedQuery ?? context.triggerData.query;
        const subQuestions = cycleResult?.subQuestions ?? [];
        // cycleResultのselectedThoughtを取得
        const bestThought = cycleResult?.selectedThought;
        // 検索結果も取得
        const searchResults = cycleResult?.searchResults ?? [];

        logger.info("(PrepareSynthesizeInput) Preparing inputs for synthesizeStep", {
          subQuestionsCount: subQuestions.length,
          query,
          selectedThought: JSON.stringify(bestThought),
          searchResultsCount: searchResults.length
        });
        
        // ★★★ 修正: synthesizeInputSchemaに完全に一致する形式でデータを返す
        return { 
          query, 
          subQuestions, 
          bestThought,
          searchResults
        };
  },
});

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
    const logger = getLogger();
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
    const logger = getLogger();
    // ★★★ デバッグ用: context の内容をログ出力 ★★★
    console.log("--- RequestClarificationStep Context Start ---");
    console.log(JSON.stringify(context, null, 2));
    console.log("--- RequestClarificationStep Context End ---");

    // ★★★ resume かどうかの判断をコンテキストから直接判断 ★★★
    const isResuming = false; // 一時的に無効化

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
    const logger = getLogger();

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
    outputSchema: z.object({
      thoughts: z.array(z.string()),
      originalQuery: z.string(),
    }),
    execute: async ({ context }: StepExecutionContext<any, WorkflowContext<typeof triggerSchema>>) => {
        const logger = getLogger();
        
        // デバッグログ追加
        logger.info("--- [DEBUG] prepareProcessThoughtsInput context ---");
        logger.info(`Steps so far: ${Object.keys(context.steps).join(', ')}`);
        
        // initialThoughtsStep から思考リストを取得
        const initialThoughtsResult = context.getStepResult(initialThoughtsStep);
        
        // requestClarificationStep の結果を取得
        const clarificationResult = context.getStepResult(requestClarificationStep);
        // 元のクエリまたは明確化されたクエリを取得
        const reconstructedQuery = clarificationResult?.clarifiedQuery ?? context.triggerData.query;
        
        if (!initialThoughtsResult || !initialThoughtsResult.thoughts || !Array.isArray(initialThoughtsResult.thoughts)) {
          logger.error("Failed to retrieve thoughts from initialThoughtsStep");
          return { thoughts: [], originalQuery: reconstructedQuery };
        }
        
        const thoughts = initialThoughtsResult.thoughts;
        logger.info(`(PrepareProcessThoughtsInput) Successfully retrieved thoughts from initialThoughtsStep: ${thoughts.length}`);
        logger.info(`(PrepareProcessThoughtsInput) Preparing inputs for processThoughtsWorkflow`);
        logger.info(`thoughtsCount: ${thoughts.length}`);
        logger.info(`query: "${reconstructedQuery}"`);
        logger.info(`thoughtsExample: "${thoughts.length > 0 ? thoughts[0] : ''}"`);
        
        return {
          thoughts: thoughts,
          originalQuery: reconstructedQuery
        };
    },
});

// synthesizeStep の定義
const synthesizeStep = new Step({
  id: 'synthesizeStep',
  description: '最終レポートを生成するステップ',
  inputSchema: synthesizeInputSchema,
  outputSchema: synthesizeOutputSchema,
  execute: async ({ context }) => {
    const logger = getLogger();
    logger.info("(SynthesizeStep) Generating final report");
    
    // デバッグ情報
    logger.info("(SynthesizeStep) Debug info - query=\"" + context.triggerData.query + 
        "\", subQuestionsCount=" + context.triggerData.subQuestions.length + 
        ", bestThought=" + JSON.stringify(context.triggerData.bestThought) +
        ", searchResultsCount=" + (context.triggerData.searchResults?.length || 0));
    
    try {
      const searchResults = context.triggerData.searchResults || [];
      // 検索結果の有無に応じてプロンプトを調整
      let prompt = '';
      
      if (searchResults && searchResults.length > 0) {
        // 検索結果がある場合、それらの情報を含める
        prompt = `以下の情報に基づいて、ユーザーの質問に対する包括的な最終レポートをマークダウン形式で作成してください。

ユーザーの質問: "${context.triggerData.query}"

選択された主要な思考: ${context.triggerData.bestThought ? JSON.stringify(context.triggerData.bestThought) : "情報なし"}

サブクエスチョン: 
${context.triggerData.subQuestions.map((q: string, i: number) => `${i+1}. ${q}`).join('\n')}

検索結果:
${searchResults.map((result: any, i: number) => 
  `検索ソース: ${result.source}
  検索クエリ: "${result.query}"
  結果件数: ${result.results.length}件
  主要な結果:
  ${result.results.slice(0, 3).map((item: any, j: number) => 
    `- タイトル: ${item.title || '不明'}
     URL: ${item.url || '不明'}
     説明: ${item.description || item.content || '不明'}`
  ).join('\n  ')}`
).join('\n\n')}

これらの情報を統合し、以下の構成で最終レポートを作成してください:
1. 概要: 質問とその背景について簡潔に説明
2. 主要な思考の詳細分析: 選択された思考の重要性と意味を分析
3. 収集された証拠と情報: 検索で見つかった関連情報を要約
4. 結論と洞察: 質問に対する総合的な見解や洞察
5. 今後の調査方向（サブクエスチョン）: 挙げられたサブクエスチョンを今後の調査方向として提示

レポートは事実に基づき、情報ソースを適切に参照し、バランスの取れた見解を提供してください。`;
      } else {
        // 検索結果がない場合、より一般的なプロンプト
        prompt = `以下の情報に基づいて、ユーザーの質問に対する包括的な最終レポートをマークダウン形式で作成してください。

ユーザーの質問: "${context.triggerData.query}"

選択された主要な思考: ${context.triggerData.bestThought ? JSON.stringify(context.triggerData.bestThought) : "情報なし"}

サブクエスチョン: 
${context.triggerData.subQuestions.map((q: string, i: number) => `${i+1}. ${q}`).join('\n')}

これらの情報を統合し、以下の構成で最終レポートを作成してください:
1. 概要: 質問とその背景について簡潔に説明
2. 主要な思考の詳細分析: 選択された思考の重要性と意味を分析
3. 収集された証拠と情報: 現時点では外部情報が限られていることを説明
4. 結論と洞察: 質問に対する総合的な見解や洞察
5. 今後の調査方向（サブクエスチョン）: 挙げられたサブクエスチョンを今後の調査方向として提示

レポートは事実に基づき、バランスの取れた見解を提供してください。`;
      }
      
      const result = await synthesizerAgent.generate(prompt);
      
      if (result.text) {
        logger.info("(SynthesizeStep) Generated report successfully.");
        // 最終レポートの内容をログに出力
        logger.info("=========== 最終レポート内容 =============");
        logger.info("```markdown\n" + result.text + "\n```");
        logger.info("=========== 最終レポート終了 =============");
        return { report: result.text };
      } else {
        logger.error("(SynthesizeStep) Agent did not return text");
        return { report: "エラー: レポート生成中に問題が発生しました。" };
      }
    } catch (error) {
      logger.error("(SynthesizeStep) Error generating report", { error });
      return { report: "エラー: レポート生成中にエラーが発生しました。" };
    }
  },
});

// ループ内で実行されるステップ (researchCycleStep の定義は変更なし)
const researchCycleStep = new Step({
    id: 'researchCycleStep',
    description: 'ループ内で検索を実行し、思考を更新するステップ',
    inputSchema: z.any(), // ループの状態を受け取る
    outputSchema: z.any(), // 更新されたループの状態を返す
    execute: async ({ context }: StepExecutionContext<any>) => {
        const logger = getLogger();
        const loopData = context.inputData; // .while から渡される accumulatedData
        // ★ 修正: inspectの結果をオブジェクトに入れる ★
        logger.info('[DEBUG] researchCycleStep execute - START', { inspectedLoopData: inspect(loopData, { depth: null }) });

        let currentSearchResults: any[] = [];
        let nextSubQuestionsForLoop: string[] = [];
        let currentBestThought = loopData.bestThought;

        // 1. サブクエスチョンに基づいて検索を実行
        if (loopData.subQuestions && loopData.subQuestions.length > 0) {
            // ★ ログ修正: 文字列ではなくオブジェクトを渡す ★
            logger.info('[DEBUG] researchCycleStep - Performing search for subQuestions:', { subQuestions: loopData.subQuestions });
            const searchPromises = loopData.subQuestions.map(async (subQuery: string) => {
                try {
                    // thoughtTransformerAgent を使って検索ツールを呼び出す
                    // (注意: ここでは thoughtTransformerAgent が検索ツールを呼び出す前提)
                    const agentResponse = await thoughtTransformerAgent.generate(
                        `Based on the original query "${loopData.query}" and the current thought ${JSON.stringify(loopData.selectedThought)}, perform a web search for the sub-question: "${subQuery}". Use the available search tool.`
                    );

                    // toolResults から検索結果を抽出する (エージェントの応答形式に依存)
                    const searchToolResult = agentResponse.toolResults?.find(tr => tr.toolName === 'webSearchTool'); // 仮のツール名
                    if (searchToolResult?.result) {
                        // ★ ログ修正: 文字列ではなくオブジェクトを渡す ★
                        logger.info(`[DEBUG] researchCycleStep - Search successful for subQuery: "${subQuery}"`, { subQuery: subQuery });
                        return { source: 'webSearchTool', query: subQuery, results: searchToolResult.result };
                    } else {
                        logger.warn(`[DEBUG] researchCycleStep - No search result found in agent response for subQuery: "${subQuery}"`, { subQuery: subQuery, agentResponse });
                        return { source: 'webSearchTool', query: subQuery, results: [] }; // 結果なし
                    }
                } catch (error) {
                    logger.error(`[DEBUG] researchCycleStep - Error searching for subQuery: "${subQuery}"`, { subQuery: subQuery, error });
                    return { source: 'webSearchTool', query: subQuery, results: [] }; // エラー時も空配列
                }
            });
            currentSearchResults = await Promise.all(searchPromises);
            logger.info('[DEBUG] researchCycleStep - Completed searches', { currentSearchResults });
        } else {
            logger.info('[DEBUG] researchCycleStep - No subQuestions to search for this cycle.');
        }

        // 2. (オプション) 検索結果に基づいて思考を更新・評価する
        // ここで再度 thoughtGeneratorAgent や processThoughtsWorkflow を呼び出すことも可能
        // 今回はシンプルにするため、既存の bestThought を維持
        logger.info('[DEBUG] researchCycleStep - Maintaining current best thought', { currentBestThought });


        // 3. 次のループのためのサブクエスチョンを生成 (必要なら)
        // 例: 検索結果が不十分なら新しいサブクエスチョンを生成
        // ここでは簡単化のため、次のサブクエスチョンは生成しない (ループは回数で終了)
        logger.info('[DEBUG] researchCycleStep - No generation of next subQuestions in this simplified version.');
        nextSubQuestionsForLoop = []; // 次のサブクエスチョンは空


        const output = {
            searchResults: currentSearchResults, // このサイクルでの検索結果
            bestThought: currentBestThought,     // 更新された思考 (今回は維持)
            nextSubQuestions: nextSubQuestionsForLoop // 次のサイクルで使うサブクエスチョン
        };
        // ★ 修正: inspectの結果をオブジェクトに入れる ★
        logger.info('[DEBUG] researchCycleStep execute - END', { inspectedOutput: inspect(output, { depth: null }) });
        return output;
    },
});

// ★★★ ワークフローチェインの修正 (ループ構造導入) ★★★
goTResearchWorkflow
  .step(clarityCheckStep)
  .then(requestClarificationStep, {
    when: async ({ context }) => {
      const clarityResult = context.getStepResult(clarityCheckStep);
      return !clarityResult?.isClear;
    },
  })
  .then(initialThoughtsStep)
  .then(prepareProcessThoughtsInput)
  .then(aggregateThoughtsStep, {
    when: async ({ context }) => {
      const thoughts = context.getStepResult(prepareProcessThoughtsInput)?.thoughts;
      return thoughts && thoughts.length > 1;
    }
  })
  // --- .while ループ --- 
  .while(
    // 第一引数: 条件判定関数
    async ({ context }: { context: WorkflowContext<any, any> }) => {
      // 直前のループステップの結果を取得
      const cycleResult = context.getStepResult(researchCycleStep);
      const logger = getLogger();
      
      // 詳細なデバッグログ
      logger.info(`(.while condition) cycleResult: ${JSON.stringify(cycleResult)}`);
      
      // 型安全にプロパティをアクセス (cycleResult が any 型のため)
      const score = cycleResult && typeof cycleResult === 'object' && 'score' in cycleResult 
         ? cycleResult.score as number | undefined
         : undefined;
      const threshold = 7; // ループ継続の閾値
      
      // スコアがない場合は最初のループなので、必ず実行する
      // (初回はcycleResultがundefined)
      const isFirstRun = cycleResult === undefined || score === undefined;
      
      // ★★★ 修正: isFirstRun を単独変数で確実に評価 ★★★
      if (isFirstRun) {
        logger.info(`(.while condition) First run detected, will continue loop`);
        return true;
      }
      
      // それ以降はスコアに基づいて判断
      const shouldContinue = score !== undefined && score < threshold;
      logger.info(`(.while condition) isFirstRun: ${isFirstRun}, Score: ${score}, Threshold: ${threshold}, Should continue? ${shouldContinue}`);
      return shouldContinue;
    },
    // 第二引数: 繰り返すステップ
    researchCycleStep
  )
  // --- ループ終了後 --- 
  .then(prepareSynthesizeInput)
  .then(synthesizeStep)
  .commit();          