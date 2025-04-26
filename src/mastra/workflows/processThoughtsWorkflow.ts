// src/mastra/workflows/processThoughtsWorkflow.ts
import { z } from 'zod';
import { Workflow, Step, StepExecutionContext } from '@mastra/core/workflows';
// import { evaluateThoughtsAgent, selectNodeAgent } from '../agents'; // 将来的に使うAgent

// サブワークフローが受け取るデータ型 (メインワークフローから渡される)
const triggerSchema = z.object({
  thoughts: z.array(z.string()).describe("生成された初期思考のリスト"),
});

// サブワークフローの定義
export const processThoughtsWorkflow = new Workflow({
  name: 'processThoughtsSubWorkflow', // サブワークフロー固有の名前
  triggerSchema,
  // description: '初期思考を評価し、次のアクションを選択するサブワークフロー', // オプション
});

// --- サブワークフロー内のステップ定義 ---

// 例: 思考を評価するステップ (プレースホルダー)
const evaluateThoughtsStep = new Step({
    id: 'evaluateThoughtsStep',
    description: '生成された初期思考を評価する',
    // inputSchema は triggerSchema と同じ想定だが、明示的に定義しても良い
    inputSchema: triggerSchema,
    outputSchema: z.object({ // 例: 評価結果
        evaluation: z.string(),
    }),
    execute: async ({ context }: StepExecutionContext<typeof triggerSchema>) => {
        const thoughts = context.triggerData.thoughts;
        console.log("(SubWorkflow) Received thoughts for evaluation:", thoughts);
        // TODO: 思考評価Agent呼び出しなどのロジックを実装
        const evaluationResult = `Evaluated ${thoughts.length} thoughts. First thought: ${thoughts[0]}`;
        console.log("(SubWorkflow) Evaluation result:", evaluationResult);
        return { evaluation: evaluationResult };
    },
});

// 例: 次に進むノードを選択するステップ (プレースホルダー)
const selectNodeStep = new Step({
    id: 'selectNodeStep',
    description: '評価に基づき、次に探索する思考ノードを選択する',
    // inputSchema: evaluateThoughtsStep の outputSchema を受け取る想定
    inputSchema: z.object({ evaluation: z.string() }),
    outputSchema: z.object({ // 例: 選択されたノード
        selectedNode: z.string(),
    }),
    execute: async ({ context }: StepExecutionContext<{ evaluation: string }>) => {
        const evaluation = context.inputData.evaluation;
        console.log("(SubWorkflow) Received evaluation for node selection:", evaluation);
        // TODO: ノード選択Agent呼び出しなどのロジックを実装
        const selectedNode = `Selected node based on evaluation: ${evaluation}`;
        console.log("(SubWorkflow) Selected node:", selectedNode);
        return { selectedNode: selectedNode };
    },
});


// --- サブワークフローの構築 ---
processThoughtsWorkflow
    // サブワークフローの最初のステップとして evaluateThoughtsStep を設定
    // triggerData がそのまま inputData として渡される
    .step(evaluateThoughtsStep)
    // evaluateThoughtsStep の後に selectNodeStep を実行
    .then(selectNodeStep, {
        variables: {
            // evaluateThoughtsStep の出力を selectNodeStep の入力にマッピング
            evaluation: { step: evaluateThoughtsStep, path: 'evaluation' }
        }
    })
    // 必要に応じてさらにステップを繋げる
    .commit();

// 重要: このサブワークフローを Mastra インスタンスに登録する必要があります。
// 通常は src/mastra/index.ts などで行いますが、
// 動的ワークフローのようにメインワークフローに mastra インスタンスを
// 注入していれば、明示的な登録なしで呼び出せる可能性もあります。
// 一旦、メインワークフロー側でインポートして呼び出す形で進めます。 