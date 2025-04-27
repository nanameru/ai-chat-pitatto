import { OpenAI } from "openai";
import { tot } from "../../core/tot/tot";
import { totConfig } from "../../core/tot/totConfig";
import { generateThoughts, generateNextThoughts } from "../../core/tot/thought-tools";
import { ResearchPlan, ReasoningStep, ToTState } from "../../types/research";
import { beamSearch } from "../../core/tot/beamSearch";
import { ThoughtToolName, PlanningToolName } from "../../types/toolNames";

/**
 * 標準的なプランニングフェーズを実行する関数
 */
export async function executePlanningPhase(query: string): Promise<{
  researchPlan: ResearchPlan;
  reasoningSteps: ReasoningStep[];
}> {
  console.log(`[Planning Phase] プランニングフェーズを実行: クエリ=${query.substring(0, 50)}...`);
  
  const planningPrompt = `
クエリ "${query}" に関する研究計画を立ててください。

最初に ${ThoughtToolName.ThoughtGenerator} を使って、この研究テーマに関する様々な思考や視点を生成します。
次に ${PlanningToolName.ResearchPlanGenerator} を使って、それらの思考に基づいた詳細な研究計画を作成します。

研究計画には、主要トピック、サブトピック、効果的な検索クエリが含まれるようにしてください。
`;

  const reasoningSteps: ReasoningStep[] = [];
  
  // 思考生成ステップ
  const thoughtResult = await tot.executeTool(ThoughtToolName.ThoughtGenerator, {
    query,
    count: 5
  });
  
  reasoningSteps.push({
    toolName: ThoughtToolName.ThoughtGenerator,
    input: { query, count: 5 },
    output: thoughtResult.content
  });
  
  console.log(`[Planning Phase] 思考生成完了: ${thoughtResult.thoughts.length}件の思考`);
  
  // 研究計画生成ステップ
  const planResult = await tot.executeTool(PlanningToolName.ResearchPlanGenerator, {
    query,
    thoughts: thoughtResult.thoughts
  });
  
  reasoningSteps.push({
    toolName: PlanningToolName.ResearchPlanGenerator,
    input: { query, thoughts: thoughtResult.thoughts },
    output: formatOutput(planResult.plan)
  });
  
  console.log(`[Planning Phase] 研究計画生成完了: ${planResult.plan.mainTopics.length}件のメイントピック`);
  
  return {
    researchPlan: planResult.plan,
    reasoningSteps
  };
}

/**
 * 拡張プランニングフェーズを実行する関数 (ビームサーチを使用)
 */
export async function executeEnhancedPlanningPhase(query: string): Promise<{
  researchPlan: ResearchPlan;
  reasoningSteps: ReasoningStep[];
  totState: ToTState;
}> {
  console.log(`[Enhanced Planning] 拡張プランニングフェーズを実行: クエリ=${query.substring(0, 50)}...`);
  console.log(`[Enhanced Planning] 設定: ビーム幅=${totConfig.beamWidth}, 分岐係数=${totConfig.branchingFactor}, 最大深度=${totConfig.maxDepth}`);

  const planningPrompt = `
クエリ "${query}" に関する深い研究計画を立てるため、Tree of Thoughts (ToT) アプローチで複数の思考経路を探索します。

まず、${ThoughtToolName.ThoughtGenerator} を使って初期の複数の思考を生成し、それらを発展させていきます。
次に、最も価値の高い思考経路に基づいて、${PlanningToolName.ResearchPlanGenerator} で詳細な研究計画を生成します。

研究計画には、主要トピック、サブトピック、効果的な検索クエリが含まれるべきです。
`;

  const reasoningSteps: ReasoningStep[] = [];
  
  // 初期思考を生成
  console.log(`[Enhanced Planning] 初期思考を生成中...`);
  const initialThoughtsResult = await tot.executeTool(ThoughtToolName.ThoughtGenerator, {
    query,
    count: totConfig.branchingFactor
  });
  
  reasoningSteps.push({
    toolName: ThoughtToolName.ThoughtGenerator,
    input: { query, count: totConfig.branchingFactor },
    output: initialThoughtsResult.content
  });
  
  console.log(`[Enhanced Planning] 初期思考生成完了: ${initialThoughtsResult.thoughts.length}件の思考`);
  
  // 初期状態を設定
  const initialState: ToTState = {
    query,
    depth: 0,
    thoughts: initialThoughtsResult.thoughts,
    value: 0,
    history: [{
      depth: 0,
      thoughts: initialThoughtsResult.thoughts
    }]
  };
  
  // ビームサーチを実行
  console.log(`[Enhanced Planning] ビームサーチを実行中...`);
  const finalState = await beamSearch({
    initialState,
    generateNextStates: generateNextThoughts,
    evaluateState: async (state) => {
      // 単純な評価関数: 思考の数と深さに基づく評価
      return state.thoughts.length * (state.depth + 1);
    },
    beamWidth: totConfig.beamWidth,
    maxDepth: totConfig.maxDepth
  });
  
  console.log(`[Enhanced Planning] ビームサーチ完了: 最終深度=${finalState.depth}, 思考数=${finalState.thoughts.length}`);
  
  // ビームサーチの結果から研究計画を生成
  console.log(`[Enhanced Planning] 最終思考に基づいて研究計画を生成中...`);
  const planResult = await tot.executeTool(PlanningToolName.ResearchPlanGenerator, {
    query,
    thoughts: finalState.thoughts
  });
  
  reasoningSteps.push({
    toolName: PlanningToolName.ResearchPlanGenerator,
    input: { query, thoughts: finalState.thoughts },
    output: formatOutput(planResult.plan)
  });
  
  console.log(`[Enhanced Planning] 研究計画生成完了: ${planResult.plan.mainTopics.length}件のメイントピック`);
  
  return {
    researchPlan: planResult.plan,
    reasoningSteps,
    totState: finalState
  };
}

/**
 * 出力を整形するヘルパー関数
 */
function formatOutput(output: any): string {
  if (typeof output === 'string') {
    return output;
  }
  return JSON.stringify(output, null, 2);
} 