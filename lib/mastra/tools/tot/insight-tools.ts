/**
 * Tree of Thoughts (ToT) 洞察生成ツール
 * 
 * 分析に基づく洞察の生成と統合に関するツールを提供します。
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { nanoid } from "nanoid";
import { Insight, NarrativeStructure, Conclusion, IntegratedInsights } from "../../types/tot";
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

/**
 * 洞察生成ツール
 * 
 * 分析結果に基づいて重要な洞察を生成します。
 */
export const insightGenerator = createTool({
  id: "Insight Generator",
  inputSchema: z.object({
    informationAnalysis: z.object({
      interpretations: z.array(z.object({
        statement: z.string(),
        supportingEvidence: z.array(z.string()),
        counterEvidence: z.array(z.string()),
        confidenceScore: z.number()
      })),
      informationGaps: z.array(z.object({
        area: z.string(),
        description: z.string(),
        importance: z.enum(["high", "medium", "low"])
      })).optional()
    }).describe("情報分析結果"),
    originalQuery: z.string().describe("元のクエリ"),
    maxInsights: z.number().min(1).max(10).default(5).describe("生成する洞察の最大数"),
    selectedModelId: z.string().optional().describe("ユーザーが選択したモデルID (OpenAI API互換名)"),
  }),
  description: "分析結果に基づいて重要な洞察を生成します",
  execute: async ({ context: { informationAnalysis, originalQuery, maxInsights, selectedModelId } }) => {
    console.log(`[ToT] 洞察生成: クエリ=${originalQuery.substring(0, 50)}..., 解釈数=${informationAnalysis.interpretations.length}, モデルID=${selectedModelId || 'default (gpt-4o-mini)'}`);
    
    // Determine the model to use for insight generation
    const insightModelId = selectedModelId || "gpt-4o-mini";

    // Create the insight generation agent dynamically
    const insightGenerationAgent = new Agent({
      name: "Insight Generation Agent",
      instructions: `あなたは情報分析結果から重要な洞察を抽出・生成する専門家です。与えられた分析結果（解釈仮説、情報ギャップ）と元のクエリに基づいて、最大${maxInsights}個の重要な洞察を生成してください。各洞察にはタイトル、説明、証拠の強さ（strong, moderate, weak）、裏付けとなる事実、考えられる影響を含めてください。結果はJSON形式の配列 [{"title": "...", "description": "...", "evidenceStrength": "...", "supportingFacts": [...], "implications": [...]}, ...] で返してください。`,
      model: openai(insightModelId),
    });

    try {
      const analysisContext = JSON.stringify(informationAnalysis, null, 2);
      const prompt = `元のクエリ: "${originalQuery}"\n\n情報分析結果:\n${analysisContext}\n\n上記の情報分析結果に基づいて、最大${maxInsights}個の重要な洞察を生成してください。結果は指定されたJSON形式の配列で返してください。`;

      let insights: Insight[] = []; // Default empty array

      try {
        const generationResult = await insightGenerationAgent.generate(prompt);
        try {
          const parsedInsights = JSON.parse(generationResult.text);
          // Basic validation of the parsed structure
          if (Array.isArray(parsedInsights) && parsedInsights.every(item => item.title && item.description && item.evidenceStrength)) {
            insights = parsedInsights.slice(0, maxInsights).map(item => ({
              ...item,
              supportingFacts: item.supportingFacts || [], // Ensure array exists
              implications: item.implications || [],   // Ensure array exists
            }));
          } else {
             console.warn(`[ToT] 洞察生成JSON形式エラー: 予期しない形式です。 Response: ${generationResult.text}`);
          }
        } catch (parseError: unknown) {
          console.warn(`[ToT] 洞察生成JSONパースエラー: ${parseError instanceof Error ? parseError.message : String(parseError)}, Response: ${generationResult.text}`);
        }
      } catch (genError: unknown) {
        console.error(`[ToT] 洞察生成AI呼び出しエラー:`, genError);
        // Keep insights as empty array on generation error
      }
      
      return {
        insights,
        originalQuery,
        timestamp: new Date().toISOString()
      };
    } catch (error: unknown) {
      console.error(`[ToT] 洞察生成エラー:`, error);
      throw new Error(`洞察生成中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});

/**
 * ストーリー構築ツール
 * 
 * 洞察を中心に全体ストーリーを構築します。
 */
export const storyBuilder = createTool({
  id: "Story Builder",
  inputSchema: z.object({
    insights: z.array(z.object({
      title: z.string(),
      description: z.string(),
      evidenceStrength: z.enum(["strong", "moderate", "weak"]),
      supportingFacts: z.array(z.string())
    })).describe("生成された洞察"),
    originalQuery: z.string().describe("元のクエリ"),
    narrativeApproaches: z.array(z.string()).optional().describe("検討するナラティブアプローチ（オプション）"),
    selectedModelId: z.string().optional().describe("ユーザーが選択したモデルID (OpenAI API互換名)"),
  }),
  description: "洞察を中心に全体ストーリーを構築します",
  execute: async ({ context: { insights, originalQuery, narrativeApproaches, selectedModelId } }) => {
    console.log(`[ToT] ストーリー構築: クエリ=${originalQuery.substring(0, 50)}..., 洞察数=${insights.length}, モデルID=${selectedModelId || 'default (gpt-4o-mini)'}`);
    
    // Determine the model to use for story building
    const storyModelId = selectedModelId || "gpt-4o-mini";

    // Create the story building agent dynamically
    const storyBuildingAgent = new Agent({
      name: "Story Building Agent",
      instructions: `あなたは複数の洞察を論理的で説得力のあるストーリーにまとめる専門家です。与えられた洞察リストと元のクエリに基づいて、最適なナラティブ構造（アプローチ、主要セクション、流れの説明）を提案してください。検討可能なアプローチ: ${narrativeApproaches?.join(', ') || 'デフォルトのアプローチ'}。結果はJSON形式のオブジェクト {"approach": "...", "mainSections": [...], "flowDescription": "..."} で返してください。`,
      model: openai(storyModelId),
    });

    try {
      const insightsContext = JSON.stringify(insights, null, 2);
      const prompt = `元のクエリ: "${originalQuery}"\n\n生成された洞察:\n${insightsContext}\n\n上記洞察に基づいて、最適なナラティブ構造をJSON形式で提案してください。`;

      let narrativeStructure: NarrativeStructure = {
          approach: "不明",
          mainSections: ["概要", "洞察", "結論"], // Default structure
          flowDescription: "不明"
      }; // Default structure

      try {
        const generationResult = await storyBuildingAgent.generate(prompt);
        try {
          const parsedStructure = JSON.parse(generationResult.text);
          // Basic validation
          if (parsedStructure.approach && Array.isArray(parsedStructure.mainSections) && parsedStructure.flowDescription) {
            narrativeStructure = parsedStructure;
          } else {
            console.warn(`[ToT] ストーリー構造JSON形式エラー: 予期しない形式です。 Response: ${generationResult.text}`);
          }
        } catch (parseError: unknown) {
          console.warn(`[ToT] ストーリー構造JSONパースエラー: ${parseError instanceof Error ? parseError.message : String(parseError)}, Response: ${generationResult.text}`);
        }
      } catch (genError: unknown) {
        console.error(`[ToT] ストーリー構築AI呼び出しエラー:`, genError);
        // Keep default structure on generation error
      }
      
      return {
        narrativeStructure,
        originalQuery,
        approaches: narrativeApproaches || [],
        selectedApproach: narrativeStructure.approach,
        timestamp: new Date().toISOString()
      };
    } catch (error: unknown) {
      console.error(`[ToT] ストーリー構築エラー:`, error);
      throw new Error(`ストーリー構築中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});

/**
 * 結論形成ツール
 * 
 * 証拠に基づく結論を形成します。
 */
export const conclusionFormer = createTool({
  id: "Conclusion Former",
  inputSchema: z.object({
    insights: z.array(z.object({
      title: z.string(),
      description: z.string(),
      evidenceStrength: z.enum(["strong", "moderate", "weak"]),
      supportingFacts: z.array(z.string())
    })).describe("生成された洞察"),
    narrativeStructure: z.object({
      approach: z.string(),
      mainSections: z.array(z.string())
    }).describe("ナラティブ構造"),
    originalQuery: z.string().describe("元のクエリ"),
    maxConclusions: z.number().min(1).max(10).default(3).describe("生成する結論の最大数"),
    selectedModelId: z.string().optional().describe("ユーザーが選択したモデルID (OpenAI API互換名)"),
  }),
  description: "証拠に基づく結論を形成します",
  execute: async ({ context: { insights, narrativeStructure, originalQuery, maxConclusions, selectedModelId } }) => {
    console.log(`[ToT] 結論形成: クエリ=${originalQuery.substring(0, 50)}..., 洞察数=${insights.length}, モデルID=${selectedModelId || 'default (gpt-4o)'}`);
    
    // Determine the model to use for conclusion forming (using gpt-4o as default for higher reasoning)
    const conclusionModelId = selectedModelId || "gpt-4o";

    // Create the conclusion forming agent dynamically
    const conclusionFormingAgent = new Agent({
      name: "Conclusion Forming Agent",
      instructions: `あなたは洞察とナラティブ構造に基づいて、証拠に裏打ちされた結論を形成する専門家です。与えられた洞察リスト、ナラティブ構造、元のクエリに基づいて、最大${maxConclusions}個の主要な結論を生成してください。各結論には、結論の記述、確信度（high, medium, low）、裏付けとなる証拠、および制限事項を含めてください。結果はJSON形式の配列 [{"statement": "...", "confidenceLevel": "...", "supportingEvidence": [...], "limitations": [...]}, ...] で返してください。`,
      model: openai(conclusionModelId),
    });

    try {
      const insightsContext = JSON.stringify(insights, null, 2);
      const structureContext = JSON.stringify(narrativeStructure, null, 2);
      const prompt = `元のクエリ: "${originalQuery}"\n\n洞察リスト:\n${insightsContext}\n\nナラティブ構造:\n${structureContext}\n\n上記の情報に基づいて、最大${maxConclusions}個の主要な結論をJSON形式の配列で生成してください。`;

      let conclusions: Conclusion[] = []; // Default empty array

      try {
        const generationResult = await conclusionFormingAgent.generate(prompt);
        try {
          const parsedConclusions = JSON.parse(generationResult.text);
          // Basic validation
          if (Array.isArray(parsedConclusions) && parsedConclusions.every(item => item.statement && item.confidenceLevel)) {
            conclusions = parsedConclusions.slice(0, maxConclusions).map(item => ({
              ...item,
              supportingEvidence: item.supportingEvidence || [], // Ensure array exists
              limitations: item.limitations || [],       // Ensure array exists
            }));
          } else {
            console.warn(`[ToT] 結論生成JSON形式エラー: 予期しない形式です。 Response: ${generationResult.text}`);
          }
        } catch (parseError: unknown) {
          console.warn(`[ToT] 結論生成JSONパースエラー: ${parseError instanceof Error ? parseError.message : String(parseError)}, Response: ${generationResult.text}`);
        }
      } catch (genError: unknown) {
        console.error(`[ToT] 結論生成AI呼び出しエラー:`, genError);
        // Keep conclusions as empty array on generation error
      }
      
      // 統合された洞察を構築
      const integratedInsights: IntegratedInsights = {
        keyInsights: insights,
        narrativeStructure,
        conclusions
      };
      
      return {
        integratedInsights,
        originalQuery,
        timestamp: new Date().toISOString()
      };
    } catch (error: unknown) {
      console.error(`[ToT] 結論形成エラー:`, error);
      throw new Error(`結論形成中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});
