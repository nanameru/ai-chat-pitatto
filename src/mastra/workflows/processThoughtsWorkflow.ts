// src/mastra/workflows/processThoughtsWorkflow.ts
import { z } from 'zod';
import { Workflow, Step, StepExecutionContext } from '@mastra/core/workflows';
import { thoughtEvaluatorAgent } from '../agents';
import { mastra } from '..';

// サブワークフローが受け取るデータ型を元に戻す (originalQuery のみ追加された状態)
const triggerSchema = z.object({
  thoughts: z.array(z.string()).describe("生成された初期思考のリスト"),
  originalQuery: z.string().describe("元のユーザーからの質問"),
});

// 評価結果スキーマ定義を追加（他のスキーマより先に定義）
export const thoughtEvaluationSchema = z.object({
  thought: z.string().describe("元の思考内容"),
  score: z.number().min(1).max(10).describe("評価スコア (1-10)"),
  reasoning: z.string().describe("評価理由"),
});

// サブワークフローの出力スキーマを明示的に定義
export const processThoughtsOutputSchema = z.object({
  selectedThought: thoughtEvaluationSchema.optional().describe("選択された思考とその評価"),
});

export const evaluateThoughtsOutputSchema = z.object({
  evaluatedThoughts: z.array(thoughtEvaluationSchema).describe("評価された思考のリスト"),
});
export type ThoughtEvaluation = z.infer<typeof thoughtEvaluationSchema>;

// サブワークフローの定義 - outputSchema は Mastra 3.0.0 以降でサポートする予定（現在は使わない）
export const processThoughtsWorkflow = new Workflow({
  name: 'processThoughtsSubWorkflow', // サブワークフロー固有の名前
  triggerSchema,
  // outputSchema は Mastra 3.0.0 以降でサポート予定
  // outputSchema: processThoughtsOutputSchema,
});

// --- サブワークフロー内のステップ定義 ---

// evaluateThoughtsStep の実装を更新
const evaluateThoughtsStep = new Step({
    id: 'evaluateThoughtsStep',
    description: '生成された初期思考を評価する',
    inputSchema: triggerSchema,
    outputSchema: evaluateThoughtsOutputSchema,
    execute: async ({ context }: StepExecutionContext<typeof triggerSchema>) => {
        const logger = mastra.getLogger();

        // ★★★ デバッグログ強化 ★★★
        logger.info("--- [DEBUG] evaluateThoughtsStep received triggerData ---");
        try { 
          logger.info(`context.triggerData (JSON): ${JSON.stringify(context.triggerData, null, 2)}`); 
          logger.info(`context.triggerData keys: ${Object.keys(context.triggerData || {}).join(', ')}`);
          logger.info(`context.triggerData.thoughts is array: ${Array.isArray(context.triggerData?.thoughts)}`);
          logger.info(`context.triggerData.thoughts length: ${context.triggerData?.thoughts?.length || 0}`);
        } catch(e) { 
          logger.error("Failed to stringify triggerData", { error: String(e) }); 
        }
        logger.info("--- [DEBUG] End evaluateThoughtsStep received triggerData ---");

        // ★★★ 入力データ検証を強化 ★★★
        let thoughts: string[] = [];
        let originalQuery: string = '';
        
        // 直接 triggerData からデータを取得
        if (context.triggerData) {
            if (Array.isArray(context.triggerData.thoughts)) {
                thoughts = context.triggerData.thoughts;
                logger.info("(SubWorkflow - Evaluate) Successfully retrieved thoughts from triggerData", { count: thoughts.length });
            }
            if (typeof context.triggerData.originalQuery === 'string') {
                originalQuery = context.triggerData.originalQuery;
                logger.info("(SubWorkflow - Evaluate) Successfully retrieved originalQuery from triggerData", { originalQuery });
            }
        }
        
        // inputData からもデータ取得を試みる (フォールバック)
        if (thoughts.length === 0 && context.inputData) {
            if (Array.isArray(context.inputData.thoughts)) {
                thoughts = context.inputData.thoughts;
                logger.info("(SubWorkflow - Evaluate) Retrieved thoughts from inputData", { count: thoughts.length });
            }
            if (typeof context.inputData.originalQuery === 'string') {
                originalQuery = context.inputData.originalQuery;
                logger.info("(SubWorkflow - Evaluate) Retrieved originalQuery from inputData", { originalQuery });
            }
        }

        // 入力データの検証
        if (thoughts.length === 0) {
            logger.error("(SubWorkflow - Evaluate) No valid thoughts array found in input");
            return { evaluatedThoughts: [] };
        }
        if (!originalQuery) {
            logger.error("(SubWorkflow - Evaluate) No valid originalQuery found in input");
            // エラーではなく、空のクエリで続行
            originalQuery = "未指定のクエリ";
        }

        logger.info("(SubWorkflow - Evaluate) Evaluating thoughts", { 
            count: thoughts.length, 
            originalQuery,
            firstThought: thoughts.length > 0 ? thoughts[0] : 'none'
        });

        const evaluatedThoughts: ThoughtEvaluation[] = [];

        for (const thought of thoughts) {
            logger.info(`(SubWorkflow - Evaluate) Evaluating thought: "${thought}"`);
            try {
                const prompt = `元の質問:「${originalQuery}」\n\nこの質問に対する以下の思考（アイデア）を評価してください:\n「${thought}」\n\n評価結果は必ず {"score": number (1-10), "reasoning": "評価理由"} のJSON形式で返してください。`;
                const agentResponse = await thoughtEvaluatorAgent.generate(prompt);

                if (agentResponse.text) {
                    try {
                        let responseText = agentResponse.text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                        const parsed: { score: number; reasoning: string } = JSON.parse(responseText);

                        const validation = thoughtEvaluationSchema.pick({ score: true, reasoning: true }).safeParse(parsed);
                        if (validation.success) {
                            evaluatedThoughts.push({
                                thought: thought, 
                                score: validation.data.score,
                                reasoning: validation.data.reasoning,
                            });
                            logger.info(`(SubWorkflow - Evaluate) Evaluation successful`, { thought, score: validation.data.score });
                        } else {
                           logger.error(`(SubWorkflow - Evaluate) Agent response validation failed`, { thought, responseText, error: validation.error });
                           evaluatedThoughts.push({ thought: thought, score: 0, reasoning: "評価形式エラー" });
                        }
                    } catch (parseError) {
                        logger.error(`(SubWorkflow - Evaluate) Failed to parse agent response`, { thought, responseText: agentResponse.text, error: parseError });
                        evaluatedThoughts.push({ thought: thought, score: 0, reasoning: "評価パースエラー" });
                    }
                } else {
                    logger.error(`(SubWorkflow - Evaluate) Agent returned no text`, { thought });
                    evaluatedThoughts.push({ thought: thought, score: 0, reasoning: "評価応答なし" });
                }
            } catch (agentError) {
                logger.error(`(SubWorkflow - Evaluate) Error calling evaluation agent`, { thought, error: agentError });
                evaluatedThoughts.push({ thought: thought, score: 0, reasoning: "評価エージェントエラー" });
            }
        }

        logger.info("(SubWorkflow - Evaluate) Finished evaluating thoughts", { count: evaluatedThoughts.length });
        return { evaluatedThoughts }; 
    },
});

const selectNodeStep = new Step({
    id: 'selectNodeStep',
    description: '評価に基づき、次に探索する思考ノードを選択する',
    inputSchema: evaluateThoughtsOutputSchema,
    outputSchema: processThoughtsOutputSchema, // サブワークフロー出力型と一致させる
    execute: async ({ context }: StepExecutionContext<typeof evaluateThoughtsOutputSchema>) => {
        const logger = mastra.getLogger();
        
        // context.inputData から evaluatedThoughts を取得
        let evaluatedThoughts: ThoughtEvaluation[] = [];
        
        if (context.inputData && Array.isArray(context.inputData.evaluatedThoughts)) {
            evaluatedThoughts = context.inputData.evaluatedThoughts;
        }
        
        logger.info("(SubWorkflow - Select) Selecting node", {
            count: evaluatedThoughts.length,
        });

        let bestThought: ThoughtEvaluation | undefined = undefined;
        if (evaluatedThoughts.length > 0) {
            // スコアでソート (降順)
            evaluatedThoughts.sort((a: ThoughtEvaluation, b: ThoughtEvaluation) => b.score - a.score);
            bestThought = evaluatedThoughts[0];
            
            logger.info("(SubWorkflow - Select) Selected node with highest score", { 
                selectedThought: bestThought.thought,
                score: bestThought.score,
                reasoning: bestThought.reasoning
            });
        } else {
            logger.warn("(SubWorkflow - Select) No thoughts to select from");
        }

        // 最終結果をログ出力
        logger.info("(SubWorkflow - Select) Final output", { selectedThought: bestThought });

        return { selectedThought: bestThought };
    },
});

// --- サブワークフローの構築 ---
processThoughtsWorkflow
    .step(evaluateThoughtsStep)
    .then(selectNodeStep, {
        variables: {
            evaluatedThoughts: { step: evaluateThoughtsStep, path: 'evaluatedThoughts' },
        }
    })
    .commit();

// ... コメントは省略 ...