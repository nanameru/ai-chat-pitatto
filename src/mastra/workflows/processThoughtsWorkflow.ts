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

// 評価結果スキーマ定義を追加
export const thoughtEvaluationSchema = z.object({
  thought: z.string().describe("元の思考内容"),
  score: z.number().min(1).max(10).describe("評価スコア (1-10)"),
  reasoning: z.string().describe("評価理由"),
});
export const evaluateThoughtsOutputSchema = z.object({
  evaluatedThoughts: z.array(thoughtEvaluationSchema).describe("評価された思考のリスト"),
});
export type ThoughtEvaluation = z.infer<typeof thoughtEvaluationSchema>;

// サブワークフローの定義
export const processThoughtsWorkflow = new Workflow({
  name: 'processThoughtsSubWorkflow', // サブワークフロー固有の名前
  triggerSchema,
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
        const thoughts = context.triggerData.thoughts; 
        const originalQuery = context.triggerData.originalQuery;

        logger.info("(SubWorkflow - Evaluate) Evaluating thoughts", { count: thoughts.length, originalQuery });

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
    outputSchema: z.object({
        selectedThought: thoughtEvaluationSchema.optional().describe("選択された思考とその評価"),
    }),
    execute: async ({ context }: StepExecutionContext<typeof evaluateThoughtsOutputSchema>) => {
        const logger = mastra.getLogger();
        const { evaluatedThoughts } = context.inputData;
        logger.info("(SubWorkflow - Select) Selecting node", {
            count: evaluatedThoughts.length,
        });

        let bestThought: ThoughtEvaluation | undefined = undefined;
        if (evaluatedThoughts.length > 0) {
            evaluatedThoughts.sort((a: ThoughtEvaluation, b: ThoughtEvaluation) => b.score - a.score);
            bestThought = evaluatedThoughts[0];
        }

        logger.info("(SubWorkflow - Select) Selected node", { 
             selectedThought: bestThought?.thought,
             score: bestThought?.score,
        });

        // ★ デバッグログ追加: 返却する bestThought の内容を確認
        logger.info("--- [DEBUG] selectNodeStep returning --- ", { selectedThought: bestThought });

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