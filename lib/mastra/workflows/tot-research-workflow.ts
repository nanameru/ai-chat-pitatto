/**
 * Tree of Thoughts (ToT) 研究ワークフロー
 * 
 * 構造化された思考プロセスを使用して、深い調査と分析を行うワークフロー。
 * 研究計画の生成、情報収集、情報評価、洞察生成、レポート生成の各段階を体系的に実行します。
 */

import { Step, Workflow } from "@mastra/core/workflows";
import { z } from "zod";

// ToT Research Agent関数のインポート
import {
  executePlanningPhase,
  executeGatheringPhase,
  executeAnalysisPhase,
  executeInsightPhase,
  executeReportPhase
} from "../agents/tot-research";

// Define Zod schema for planning step output data (matching outputSchema)
const planningOutputDataSchema = z.object({
  researchPlan: z.object({
    selectedThought: z.string(),
    subtopics: z.array(z.string()),
    optimizedQueries: z.array(z.object({
      query: z.string(),
      purpose: z.string()
    }))
  }),
  originalQuery: z.string()
});
type PlanningOutputData = z.infer<typeof planningOutputDataSchema>;

/**
 * 研究計画生成ステップ
 * 
 * 複数の思考経路を生成し、最も有望な経路を選択して詳細な研究計画を作成します。
 */
const planningStep = new Step({
  id: "planningStep",
  inputSchema: z.object({
    query: z.string().describe("ユーザーのクエリ"),
    clarificationResponse: z.string().optional().describe("明確化レスポンス（オプション）")
  }),
  outputSchema: planningOutputDataSchema, // Use the defined schema
  execute: async ({ context }) => {
    // トリガーからクエリを取得
    const triggerResult = context?.getStepResult<{
      query: string;
      clarificationResponse?: string;
    }>("trigger");
    
    if (!triggerResult || !triggerResult.query) {
      throw new Error("トリガーからクエリを取得できませんでした");
    }
    const { query } = triggerResult; // clarificationResponse handled internally
    
    console.log(`[ToT Workflow] 計画ステップ実行: クエリ=${query.substring(0, 50)}...`);
    
    // 計画フェーズを実行
    const result = await executePlanningPhase(query);
    
    try {
      if (!result || typeof result.text !== 'string') {
        throw new Error('executePlanningPhase did not return a valid text result.');
      }
      const parsedJson = JSON.parse(result.text);
      const validationResult = planningOutputDataSchema.safeParse(parsedJson);

      if (!validationResult.success) {
        console.error("[ToT Workflow] 計画ステップ Zod バリデーションエラー:", validationResult.error.errors, "Parsed JSON:", parsedJson);
        throw new Error(`計画フェーズの結果バリデーションに失敗しました: ${validationResult.error.message}`);
      }

      // Return the validated data which matches the outputSchema
      return validationResult.data;

    } catch (error: unknown) {
      const responseText = typeof result?.text === 'string' ? result.text : '(Invalid response text)';
      console.error("[ToT Workflow] 計画ステップ実行/パースエラー:", error, "Response Text:", responseText);
      throw new Error(`計画フェーズの実行または結果パースに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});

// Define Zod schema for gathering step output data
const gatheringOutputDataSchema = z.object({
  collectedInformation: z.array(z.object({
    query: z.string(),
    purpose: z.string(),
    results: z.array(z.object({
      title: z.string().optional(),
      url: z.string().optional(),
      snippet: z.string().optional(),
      date: z.string().optional()
    }))
  })),
  originalQuery: z.string()
});
type GatheringOutputData = z.infer<typeof gatheringOutputDataSchema>;

/**
 * 情報収集ステップ
 * 
 * 最適化されたクエリを使用して並列検索を実行し、幅広い情報を収集します。
 */
const gatheringStep = new Step({
  id: "gatheringStep",
  outputSchema: gatheringOutputDataSchema, // Use the defined schema
  execute: async ({ context }) => {
    // 前のステップから研究計画を取得
    const planResult = context?.getStepResult<PlanningOutputData>("planningStep"); // Use type from previous step
    
    if (!planResult || !planResult.researchPlan) {
      throw new Error("研究計画が見つかりません");
    }
    
    const { researchPlan, originalQuery } = planResult;
    
    console.log(`[ToT Workflow] 情報収集ステップ実行: クエリ=${originalQuery.substring(0, 50)}...`);
    
    // 情報収集フェーズを実行
    const result = await executeGatheringPhase(researchPlan, originalQuery);
    
    try {
      if (!result || typeof result.text !== 'string') {
        throw new Error('executeGatheringPhase did not return a valid text result.');
      }
      const parsedJson = JSON.parse(result.text);

      // Allow parsing if the root is the array, or if it's under a key
      let dataToValidate: any;
      if (Array.isArray(parsedJson)) {
         dataToValidate = { collectedInformation: parsedJson, originalQuery };
      } else if (parsedJson && Array.isArray(parsedJson.collectedInformation)) {
         dataToValidate = { ...parsedJson, originalQuery }; // Spread potential other fields? Be careful.
      } else {
         throw new Error("収集結果のJSON形式が不正です: ルート配列または collectedInformation キーが見つかりません");
      }

      const validationResult = gatheringOutputDataSchema.safeParse(dataToValidate);

      if (!validationResult.success) {
        console.error("[ToT Workflow] 情報収集ステップ Zod バリデーションエラー:", validationResult.error.errors, "Parsed JSON:", dataToValidate);
        throw new Error(`情報収集フェーズの結果バリデーションに失敗しました: ${validationResult.error.message}`);
      }

      return validationResult.data;

    } catch (error: unknown) {
      const responseText = typeof result?.text === 'string' ? result.text : '(Invalid response text)';
      console.error("[ToT Workflow] 情報収集ステップ実行/パースエラー:", error, "Response Text:", responseText);
      throw new Error(`情報収集フェーズの実行または結果パースに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});

// Define Zod schema for analysis step output data
const analysisOutputDataSchema = z.object({
    informationAnalysis: z.object({
      informationEvaluation: z.object({
        highReliabilitySources: z.array(z.string()),
        mediumReliabilitySources: z.array(z.string()),
        lowReliabilitySources: z.array(z.string())
      }),
      interpretations: z.array(z.object({
        statement: z.string(),
        supportingEvidence: z.array(z.string()),
        counterEvidence: z.array(z.string()),
        confidenceScore: z.number()
      })),
      informationGaps: z.array(z.object({
        area: z.string(),
        description: z.string(),
        importance: z.enum(["high", "medium", "low"]),
        additionalQuery: z.string().optional()
      }))
    }),
  evaluatedSources: z.array(z.object({
    title: z.string(),
    url: z.string(),
    snippet: z.string(),
    reliability: z.enum(["high", "medium", "low"]),
    relevance: z.number(), 
    purpose: z.string().optional(),
    date: z.string().optional()
  })), 
    originalQuery: z.string()
});
type AnalysisOutputData = z.infer<typeof analysisOutputDataSchema>;

/**
 * 情報分析ステップ
 * 
 * 収集した情報の信頼性と関連性を評価し、複数の解釈仮説を生成し、情報ギャップを特定します。
 * また、評価済みの情報ソースリストも返します。
 */
const analysisStep = new Step({
  id: "analysisStep",
  outputSchema: analysisOutputDataSchema, // Use the defined schema
  execute: async ({ context }) => {
    // 前のステップから収集情報を取得
    const gatheringResult = context?.getStepResult<GatheringOutputData>("gatheringStep"); // Use type from previous step
    
    if (!gatheringResult || !gatheringResult.collectedInformation) {
      throw new Error("収集情報が見つかりません");
    }
    
    // Get selectedModelId from trigger context if available
    const triggerResult = context?.getStepResult<{
      query: string;
      clarificationResponse?: string;
      selectedModelId?: string;
    }>("trigger");
    const selectedModelId = triggerResult?.selectedModelId; // Pass this if needed later
    
    const { collectedInformation, originalQuery } = gatheringResult; // Correctly get originalQuery
    
    console.log(`[ToT Workflow] 情報分析ステップ実行: クエリ=${originalQuery.substring(0, 50)}..., モデルID=${selectedModelId || 'default'}`);
    
    // 情報分析フェーズを実行 (assuming executeAnalysisPhase takes collectedInformation and originalQuery)
    // selectedModelId passing is still deferred
    const result = await executeAnalysisPhase(collectedInformation, originalQuery);
    
    try {
      if (!result || typeof result.text !== 'string') {
        throw new Error('executeAnalysisPhase did not return a valid text result.');
      }
      const parsedJson = JSON.parse(result.text);
      
      // Ensure originalQuery is included for validation if not present in AI result
      const dataToValidate = { 
          ...parsedJson, 
          originalQuery: parsedJson.originalQuery || originalQuery // Use query from context if missing
      };

      const validationResult = analysisOutputDataSchema.safeParse(dataToValidate);

      if (!validationResult.success) {
        console.error("[ToT Workflow] 情報分析ステップ Zod バリデーションエラー:", validationResult.error.errors, "Parsed JSON:", dataToValidate);
        throw new Error(`情報分析フェーズの結果バリデーションに失敗しました: ${validationResult.error.message}`);
      }

      return validationResult.data;

    } catch (error: unknown) {
      const responseText = typeof result?.text === 'string' ? result.text : '(Invalid response text)';
      console.error("[ToT Workflow] 情報分析ステップ実行/パースエラー:", error, "Response Text:", responseText);
      throw new Error(`情報分析フェーズの実行または結果パースに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});

// Define Zod schema for additional gathering step output data
const additionalGatheringOutputDataSchema = z.object({
  additionalInformation: z.array(z.object({
    query: z.string(),
    purpose: z.string(),
    results: z.array(z.object({
      title: z.string().optional(),
      url: z.string().optional(),
      snippet: z.string().optional(),
      date: z.string().optional(),
    }))
  })),
  originalQuery: z.string()
});
type AdditionalGatheringOutputData = z.infer<typeof additionalGatheringOutputDataSchema>;

/**
 * 追加情報収集ステップ（条件付き）
 * 
 * 情報ギャップが特定された場合に、追加の情報収集を行います。
 */
const additionalGatheringStep = new Step({
  id: "additionalGatheringStep",
  outputSchema: additionalGatheringOutputDataSchema, // Use the defined schema
  execute: async ({ context }) => {
    // 前のステップから情報分析結果を取得
    const analysisResult = context?.getStepResult<AnalysisOutputData>("analysisStep"); // Use type from previous step
    
    if (!analysisResult || !analysisResult.informationAnalysis) {
      throw new Error("情報分析結果が見つかりません");
    }
    
    const { informationAnalysis, originalQuery } = analysisResult;
    
    // 重要度の高い情報ギャップのみを抽出
    const highImportanceGaps = informationAnalysis.informationGaps?.filter( // Add optional chaining
      gap => gap.importance === "high" && gap.additionalQuery
    ) || []; // Default to empty array if gaps don't exist
    
    if (highImportanceGaps.length === 0) {
      console.log(`[ToT Workflow] 追加情報収集スキップ: 重要な情報ギャップなし`);
      // Return data matching the schema for the skipped case
      return {
        additionalInformation: [],
        originalQuery
      };
    }
    
    console.log(`[ToT Workflow] 追加情報収集ステップ実行: ギャップ数=${highImportanceGaps.length}`);
    
    // 追加クエリを構築
    const additionalQueries = highImportanceGaps.map(gap => ({
      query: gap.additionalQuery!,
      purpose: `${gap.area}に関する情報を収集する`
    }));
    
    // 追加の研究計画を構築 (minimal structure for executeGatheringPhase)
    const additionalResearchPlan = {
      optimizedQueries: additionalQueries
      // Other fields like selectedThought, subtopics might be needed depending on executeGatheringPhase requirements
    };
    
    // 追加情報収集フェーズを実行
    const result = await executeGatheringPhase(additionalResearchPlan, originalQuery);
    
    try {
       if (!result || typeof result.text !== 'string') {
         throw new Error('executeGatheringPhase (additional) did not return a valid text result.');
       }
       const parsedJson = JSON.parse(result.text);
       
       // Allow parsing if the root is the array, or if it's under a key
       let dataToValidate: any;
       if (Array.isArray(parsedJson)) {
          dataToValidate = { additionalInformation: parsedJson, originalQuery };
       } else if (parsedJson && Array.isArray(parsedJson.additionalInformation)) {
          dataToValidate = { ...parsedJson, originalQuery };
       } else if (parsedJson && Array.isArray(parsedJson.collectedInformation)) { // Allow 'collectedInformation' key too
          dataToValidate = { additionalInformation: parsedJson.collectedInformation, originalQuery };
       } else {
          throw new Error("追加収集結果のJSON形式が不正です: ルート配列または additionalInformation/collectedInformation キーが見つかりません");
       }

       const validationResult = additionalGatheringOutputDataSchema.safeParse(dataToValidate);

       if (!validationResult.success) {
         console.error("[ToT Workflow] 追加情報収集ステップ Zod バリデーションエラー:", validationResult.error.errors, "Parsed JSON:", dataToValidate);
         throw new Error(`追加情報収集フェーズの結果バリデーションに失敗しました: ${validationResult.error.message}`);
       }

       return validationResult.data;

     } catch (error: unknown) {
       const responseText = typeof result?.text === 'string' ? result.text : '(Invalid response text)';
       console.error("[ToT Workflow] 追加情報収集ステップ実行/パースエラー:", error, "Response Text:", responseText);
       throw new Error(`追加情報収集フェーズの実行または結果パースに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
     }
  }
});

// Define Zod schema for insight step output data
const insightOutputDataSchema = z.object({
    integratedInsights: z.object({
      keyInsights: z.array(z.object({
        title: z.string(),
        description: z.string(),
        evidenceStrength: z.enum(["strong", "moderate", "weak"]),
      supportingFacts: z.array(z.string()),
      implications: z.array(z.string()).optional() // Ensure implications are optional if not always present
      })),
      narrativeStructure: z.object({
        approach: z.string(),
        mainSections: z.array(z.string()),
        flowDescription: z.string()
      }),
      conclusions: z.array(z.object({
        statement: z.string(),
        confidenceLevel: z.enum(["high", "medium", "low"]),
        supportingEvidence: z.array(z.string()),
        limitations: z.array(z.string())
      }))
    }),
    originalQuery: z.string()
});
type InsightOutputData = z.infer<typeof insightOutputDataSchema>;

/**
 * 洞察生成ステップ
 * 
 * 分析に基づいて重要な洞察を生成し、洞察を中心に全体ストーリーを構築し、証拠に基づく結論を形成します。
 */
const insightStep = new Step({
  id: "insightStep",
  outputSchema: insightOutputDataSchema, // Use the defined schema
  execute: async ({ context }) => {
    // 前のステップから情報分析結果を取得
    const analysisResult = context?.getStepResult<AnalysisOutputData>("analysisStep");
    
    if (!analysisResult || !analysisResult.informationAnalysis) {
     throw new Error("分析結果が見つかりません (洞察ステップ)");
    }
    const { informationAnalysis, originalQuery } = analysisResult;
    
    // 追加情報収集結果を取得（存在する場合）
    const additionalGatheringResult = context?.getStepResult<AdditionalGatheringOutputData>("additionalGatheringStep");
    
    // TODO: Implement proper integration of additionalInformation into enhancedAnalysis
    let enhancedAnalysis = informationAnalysis; // Placeholder
    if (additionalGatheringResult && additionalGatheringResult.additionalInformation.length > 0) {
      console.log(`[ToT Workflow] 追加情報を統合: 項目数=${additionalGatheringResult.additionalInformation.length}`);
      // enhancedAnalysis = integrateInformation(informationAnalysis, additionalGatheringResult.additionalInformation); 
    }
    

    // Get selectedModelId from trigger context if available
    const triggerResult = context?.getStepResult<{
      query: string;
      selectedModelId?: string;
    }>("trigger");
    const selectedModelId = triggerResult?.selectedModelId; // Pass this if needed later

    console.log(`[ToT Workflow] 洞察生成ステップ実行: クエリ=${originalQuery.substring(0, 50)}..., モデルID=${selectedModelId || 'default'}`);
    
    // 洞察生成フェーズを実行 (assuming executeInsightPhase takes enhancedAnalysis and originalQuery)
    // selectedModelId passing is still deferred
    const result = await executeInsightPhase(enhancedAnalysis, originalQuery);
    
    try {
       if (!result || typeof result.text !== 'string') {
         throw new Error('executeInsightPhase did not return a valid text result.');
       }
       const parsedJson = JSON.parse(result.text);

       // Allow parsing if the root is the object, or if it's under a key
       let dataToValidate: any;
       if (parsedJson && parsedJson.keyInsights && parsedJson.narrativeStructure && parsedJson.conclusions) {
          dataToValidate = { integratedInsights: parsedJson, originalQuery };
       } else if (parsedJson && parsedJson.integratedInsights) {
          dataToValidate = { ...parsedJson, originalQuery };
       } else {
          throw new Error("洞察結果のJSON形式が不正です: ルートオブジェクトまたは integratedInsights キーの構造が不正です");
       }

       const validationResult = insightOutputDataSchema.safeParse(dataToValidate);

       if (!validationResult.success) {
         console.error("[ToT Workflow] 洞察生成ステップ Zod バリデーションエラー:", validationResult.error.errors, "Parsed JSON:", dataToValidate);
         throw new Error(`洞察生成フェーズの結果バリデーションに失敗しました: ${validationResult.error.message}`);
       }
       
       return validationResult.data;

     } catch (error: unknown) {
       const responseText = typeof result?.text === 'string' ? result.text : '(Invalid response text)';
       console.error("[ToT Workflow] 洞察生成ステップ実行/パースエラー:", error, "Response Text:", responseText);
       throw new Error(`洞察生成フェーズの実行または結果パースに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
     }
  }
});

// Define Zod schema for report step output data
const reportOutputDataSchema = z.object({
    finalReport: z.object({
      title: z.string(),
      summary: z.string(),
      sections: z.array(z.object({
        title: z.string(),
        content: z.string(),
        subsections: z.array(z.object({
          title: z.string(),
          content: z.string()
        })).optional()
      })),
      sources: z.array(z.object({
        title: z.string(),
        url: z.string(),
        accessedDate: z.string(),
      reliability: z.enum(["high", "medium", "low"]).optional()
      })),
      generatedAt: z.string()
    }),
    reportText: z.string(),
    formatType: z.enum(["markdown", "html", "text"]),
    originalQuery: z.string()
});
type ReportOutputData = z.infer<typeof reportOutputDataSchema>;

/**
 * レポート生成ステップ
 * 
 * 統合された洞察から構造化レポートを生成し、レポートを最適化します。
 */
const reportStep = new Step({
  id: "reportStep",
  outputSchema: reportOutputDataSchema, // Use the defined schema
  execute: async ({ context }) => {
    // 前のステップから統合洞察を取得
    const insightResult = context?.getStepResult<InsightOutputData>("insightStep"); // Use type from previous step
    
    if (!insightResult || !insightResult.integratedInsights) {
      throw new Error("統合洞察が見つかりません");
    }
    
    // Fetch evaluatedSources from analysisStep result
    const analysisStepResult = context?.getStepResult<AnalysisOutputData>("analysisStep"); // Use type
    
    const { integratedInsights, originalQuery } = insightResult;
    const evaluatedSources = analysisStepResult?.evaluatedSources || []; // Use evaluatedSources from analysis step

    // Get selectedModelId from trigger context if available
    const triggerResult = context?.getStepResult<{
      query: string;
      selectedModelId?: string;
    }>("trigger");
    const selectedModelId = triggerResult?.selectedModelId; // Pass this if needed later

    console.log(`[ToT Workflow] レポート生成ステップ実行: クエリ=${originalQuery.substring(0, 50)}..., モデルID=${selectedModelId || 'default'}`);
    
    // レポート生成フェーズを実行 (assuming executeReportPhase takes integratedInsights, originalQuery, evaluatedSources)
    // selectedModelId passing is still deferred
    const result = await executeReportPhase(integratedInsights, originalQuery, evaluatedSources);
    
    try {
       if (!result || typeof result.text !== 'string') {
          throw new Error('executeReportPhase did not return a valid text result.');
       }
       const parsedJson = JSON.parse(result.text);

       // Ensure originalQuery is included for validation
       const dataToValidate = { 
           ...parsedJson, 
           originalQuery: parsedJson.originalQuery || originalQuery 
       };

       const validationResult = reportOutputDataSchema.safeParse(dataToValidate);

       if (!validationResult.success) {
         console.error("[ToT Workflow] レポート生成ステップ Zod バリデーションエラー:", validationResult.error.errors, "Parsed JSON:", dataToValidate);
         throw new Error(`レポート生成フェーズの結果バリデーションに失敗しました: ${validationResult.error.message}`);
       }

       return validationResult.data;

     } catch (error: unknown) {
       const responseText = typeof result?.text === 'string' ? result.text : '(Invalid response text)';
       console.error("[ToT Workflow] レポート生成ステップ実行/パースエラー:", error, "Response Text:", responseText);
       throw new Error(`レポート生成フェーズの実行または結果パースに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
     }
  }
});

/**
 * ToT研究ワークフロー
 * 
 * 研究計画の生成、情報収集、情報評価、洞察生成、レポート生成の各段階を体系的に実行するワークフロー。
 */
export const totResearchWorkflow = new Workflow({
  name: "tot-research-workflow",
  triggerSchema: z.object({
    query: z.string().describe("ユーザーのクエリ"),
    clarificationResponse: z.string().optional().describe("明確化レスポンス（オプション）"),
    selectedModelId: z.string().optional().describe("ユーザーが選択したモデルID") // Add to trigger schema
  }),
});

// ワークフローのステップを定義
totResearchWorkflow
  .step(planningStep)
  .then(gatheringStep)
  .then(analysisStep)
  .then(additionalGatheringStep, {
    when: { "analysisStep.informationAnalysis.informationGaps": (gaps: any) => 
      gaps && gaps.some((gap: any) => gap.importance === "high" && gap.additionalQuery)
    }
  })
  .then(insightStep)
  .then(reportStep);

// ワークフローをコミット
totResearchWorkflow.commit();

