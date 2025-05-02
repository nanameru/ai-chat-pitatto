// src/mastra/workflows/processThoughtsWorkflow.ts
import { z } from 'zod';
import { Workflow, Step, StepExecutionContext, WorkflowContext } from '@mastra/core/workflows';
import { thoughtEvaluatorAgent } from '../agents';
import { mastra } from '..';

// 評価結果スキーマ定義を追加（他のスキーマより先に定義）
export const thoughtEvaluationSchema = z.object({
  thought: z.string().describe("元の思考内容"),
  score: z.number().min(1).max(10).describe("評価スコア (1-10)"),
  reasoning: z.string().describe("評価理由"),
});

// ★ ThoughtEvaluation 型をエクスポート
export type ThoughtEvaluation = z.infer<typeof thoughtEvaluationSchema>;

// サブワークフローの出力スキーマを明示的に定義
export const processThoughtsOutputSchema = z.object({
  selectedThought: thoughtEvaluationSchema.optional().describe("選択された思考とその評価"),
});

// サブワークフローが受け取るデータ型
const triggerSchema = z.object({
  thoughts: z.array(z.string()).describe("生成された初期思考のリスト"),
  originalQuery: z.string().describe("元のユーザーからの質問"),
});

// evaluateThoughtsStep の input/output スキーマ定義
const evaluateThoughtsInputSchema = z.object({
  thoughts: z.array(z.string()).describe("評価する思考のリスト"),
  originalQuery: z.string().describe("元のユーザーからの質問"),
});
const evaluateThoughtsOutputSchema = z.object({
  evaluatedThoughts: z.array(thoughtEvaluationSchema).describe("評価された思考のリスト"),
});

// 評価対象の思考を評価するステップ
const evaluateThoughtsStep = new Step({
  id: 'evaluateThoughtsStep',
  description: '生成された思考を評価するステップ',
  inputSchema: evaluateThoughtsInputSchema,
  outputSchema: evaluateThoughtsOutputSchema,
  execute: async ({ context }: StepExecutionContext<typeof evaluateThoughtsInputSchema, any>) => {
    const logger = mastra.getLogger();

    logger.info("--- [DEBUG] evaluateThoughtsStep received input data ---");
    logger.info(`context.inputData: ${JSON.stringify(context.inputData, null, 2)}`);
    
    const thoughts = context.inputData.thoughts || [];
    const originalQuery = context.inputData.originalQuery || "";

    if (!thoughts || !Array.isArray(thoughts) || thoughts.length === 0) {
      logger.error("(SubWorkflow - Evaluate) No valid thoughts array found in input");
      return { evaluatedThoughts: [] };
    }

    logger.info(`(SubWorkflow - Evaluate) Evaluating ${thoughts.length} thoughts`);
    
    // 思考評価ロジック
    const evaluatedThoughts = [];
    for (const thought of thoughts) {
      try {
        const { text: responseText } = await thoughtEvaluatorAgent.generate(
          [
            {
              role: 'system',
              content: `あなたは思考評価エキスパートです。与えられた思考を評価し、1から10のスコアをつけてください。
              評価基準:
              - 元の質問に関連していること
              - 洞察力があること
              - 具体的であること
              - オリジナリティがあること`,
            },
            {
              role: 'user',
              content: `元の質問: "${originalQuery}"
              
              評価する思考: "${thought}"
              
              この思考を1から10のスケールで評価し、その理由を説明してください。
              JSONフォーマットで回答してください:
              {
                "thought": "思考の内容",
                "score": 評価スコア（数値1-10）,
                "reasoning": "評価理由の説明"
              }`,
            },
          ]
        );

        try {
          const jsonMatch = responseText?.match(/\{[\s\S]*\}/);
          const evaluationResult = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
          
          if (evaluationResult && typeof evaluationResult.score === 'number') {
            evaluatedThoughts.push({
              thought: thought,
              score: evaluationResult.score,
              reasoning: evaluationResult.reasoning || "",
            });
            logger.info(`(SubWorkflow - Evaluate) Evaluated thought: ${thought} with score ${evaluationResult.score}`);
          } else {
            logger.warn(`(SubWorkflow - Evaluate) Failed to parse evaluation result as JSON`);
            evaluatedThoughts.push({
              thought: thought,
              score: 5,
              reasoning: "評価結果のパースに失敗しました",
            });
          }
        } catch (e) {
          logger.error(`(SubWorkflow - Evaluate) Error parsing evaluation result: ${e}`);
          evaluatedThoughts.push({
            thought: thought,
            score: 5,
            reasoning: "評価結果のパースに失敗しました",
          });
        }
      } catch (e) {
        logger.error(`(SubWorkflow - Evaluate) Error evaluating thought: ${e}`);
      }
    }

    return { evaluatedThoughts };
  },
});

// selectNodeStep の input スキーマ定義
const selectNodeInputSchema = z.object({
  evaluatedThoughts: z.array(thoughtEvaluationSchema).describe("評価された思考のリスト"),
});

// 最も良い思考を選択するステップ
const selectNodeStep = new Step({
  id: 'selectNodeStep',
  description: '評価結果から最も良い思考を選択するステップ',
  inputSchema: selectNodeInputSchema,
  outputSchema: processThoughtsOutputSchema,
  execute: async ({ context }: StepExecutionContext<typeof selectNodeInputSchema, any>) => {
    const logger = mastra.getLogger();
    
    const evaluatedThoughts = context.inputData.evaluatedThoughts || [];
    logger.info(`(SubWorkflow - Select) Selecting node from ${evaluatedThoughts.length} evaluated thoughts`);
    
    if (!evaluatedThoughts || evaluatedThoughts.length === 0) {
      logger.warn("(SubWorkflow - Select) No thoughts to select from");
      return {};
    }
    
    // 最高スコアの思考を選択
    let bestThought = evaluatedThoughts[0];
    for (const thought of evaluatedThoughts) {
      if (thought.score > bestThought.score) {
        bestThought = thought;
      }
    }
    
    logger.info(`(SubWorkflow - Select) Final output`);
    return { selectedThought: bestThought };
  },
});

// プロセス思考サブワークフロー定義
export const processThoughtsWorkflow = new Workflow({
  name: 'processThoughtsWorkflow',
  triggerSchema: triggerSchema,
  mastra,
  
  // 結果スキーマとマッピングを追加
  result: {
    schema: processThoughtsOutputSchema,
    mapping: {
      selectedThought: { step: selectNodeStep, path: "selectedThought" }
    }
  }
})
.step(evaluateThoughtsStep)
.then(selectNodeStep)
.commit();

// ... コメントは省略 ...