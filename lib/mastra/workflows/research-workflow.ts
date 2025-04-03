import { Workflow, Step } from "@mastra/core/workflows";
import { z } from "zod";
import { deepResearchAgentV2, researchAgent, integrationAgent } from "../agents/deep-research-v2";
import { searchTool, analysisTool } from "../tools/index";

/**
 * 研究ワークフロー - 反復連鎖検索のプロセスを定義
 * 
 * このワークフローは、初期検索→分析→追加検索→結果統合の流れを定義し、
 * 情報が十分になるまで検索と分析を繰り返します。
 */

// ワークフローの定義
export const researchWorkflow = new Workflow({
  name: "research-workflow",
  triggerSchema: z.object({
    query: z.string().describe("ユーザーの質問"),
  }),
});

// 初期検索ステップ
const initialSearchStep = new Step({
  id: "initialSearch",
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: z.object({
    query: z.string(),
    results: z.array(z.object({
      title: z.string(),
      snippet: z.string(),
      url: z.string(),
    })),
    timestamp: z.string(),
  }),
  execute: async ({ context }) => {
    const query = context?.getStepResult<{ query: string }>("trigger")?.query || "";
    
    if (!query) {
      return { query: "", results: [], timestamp: new Date().toISOString() };
    }
    
    // nullチェックを追加
    if (!searchTool || !searchTool.execute) {
      return { query, results: [], timestamp: new Date().toISOString() };
    }
    
    const response = await searchTool.execute({
      context: { query },
    }) as { query: string; results: { title: string; snippet: string; url: string; }[]; timestamp: string; };
    
    return response;
  },
});

// 結果分析ステップ
const analysisStep = new Step({
  id: "analysisStep",
  outputSchema: z.object({
    originalQuery: z.string(),
    missingInformation: z.array(z.string()),
    followUpQueries: z.array(z.string()),
    analysisTimestamp: z.string(),
  }),
  execute: async ({ context }) => {
    const searchResults = context?.getStepResult("initialSearch") || { query: "", results: [] };
    
    if (!searchResults || !searchResults.query) {
      return { 
        originalQuery: "", 
        missingInformation: [], 
        followUpQueries: [], 
        analysisTimestamp: new Date().toISOString() 
      };
    }
    
    // nullチェックを追加
    if (!analysisTool || !analysisTool.execute) {
      return {
        originalQuery: searchResults.query,
        missingInformation: [],
        followUpQueries: [],
        analysisTimestamp: new Date().toISOString()
      };
    }
    
    const response = await analysisTool.execute({
      context: {
        query: searchResults.query,
        results: searchResults.results || [],
      },
    }) as { originalQuery: string; missingInformation: string[]; followUpQueries: string[]; analysisTimestamp: string; };
    
    return response;
  },
});

// 追加検索ステップ
const followUpSearchStep = new Step({
  id: "followUpSearch",
  outputSchema: z.object({
    additionalResults: z.array(z.object({
      query: z.string(),
      results: z.array(z.object({
        title: z.string(),
        snippet: z.string(),
        url: z.string(),
      })),
    })),
    iterationCount: z.number(),
    isInformationSufficient: z.boolean(),
  }),
  execute: async ({ context }) => {
    const analysis = context?.getStepResult("analysisStep");
    const previousIterations = context?.getStepResult("followUpSearch");
    const iterationCount = previousIterations?.iterationCount || 0;
    const additionalResults = [];
    
    // 最大反復回数のチェック
    if (iterationCount >= 15) {
      return { 
        additionalResults: previousIterations?.additionalResults || [],
        iterationCount: 15,
        isInformationSufficient: true // 最大反復回数に達したため強制終了
      };
    }
    
    const followUpQueries = analysis?.followUpQueries || [];
    for (const query of followUpQueries) {
      if (!query) continue;
      
      // nullチェックを追加
      if (!searchTool || !searchTool.execute) {
        additionalResults.push({
          query,
          results: [],
        });
        continue;
      }
      
      const response = await searchTool.execute({
        context: { query },
      }) as { query: string; results: { title: string; snippet: string; url: string; }[]; timestamp: string; };
      
      additionalResults.push({
        query,
        results: response.results,
      });
    }
    
    // 情報が十分かどうかを評価
    const evaluationPrompt = `
      以下の情報に基づいて、ユーザーの質問に十分に回答できるかどうかを評価してください：
      
      元の質問: ${analysis.originalQuery}
      不足していた情報: ${JSON.stringify(analysis.missingInformation)}
      追加で収集した情報: ${JSON.stringify(additionalResults)}
    `;
    
    // 型アサーションを使用して正しい型を指定
    const evaluationResponse = await researchAgent.generate(evaluationPrompt, {
      output: z.object({
        isInformationSufficient: z.boolean(),
        reasonForDecision: z.string(),
      }),
    }) as unknown as {
      text: string;
      object: {
        isInformationSufficient: boolean;
        reasonForDecision: string;
      };
    };
    
    // 情報が十分かどうかのデフォルト値を設定
    const isInformationSufficient = evaluationResponse?.object?.isInformationSufficient ?? true;
    
    return { 
      additionalResults: [...(previousIterations?.additionalResults || []), ...additionalResults],
      iterationCount: iterationCount + 1,
      isInformationSufficient
    };
  },
});

// 結果統合ステップ
const resultIntegrationStep = new Step({
  id: "resultIntegration",
  outputSchema: z.object({
    originalQuery: z.string(),
    initialResults: z.array(z.object({
      title: z.string(),
      snippet: z.string(),
      url: z.string(),
    })),
    additionalResults: z.array(z.object({
      query: z.string(),
      results: z.array(z.object({
        title: z.string(),
        snippet: z.string(),
        url: z.string(),
      })),
    })),
    summary: z.string(),
  }),
  execute: async ({ context }) => {
    const initialSearch = context?.getStepResult("initialSearch");
    const followUpSearch = context?.getStepResult("followUpSearch");
    
    const prompt = `
      以下の検索結果に基づいて、包括的な要約を作成してください：
      
      初期検索クエリ: ${initialSearch.query}
      初期検索結果: ${JSON.stringify(initialSearch.results)}
      
      追加検索結果: ${JSON.stringify(followUpSearch.additionalResults)}
    `;
    
    const response = await integrationAgent.generate(prompt) as { text: string };
    
    return {
      originalQuery: initialSearch.query,
      initialResults: initialSearch.results,
      additionalResults: followUpSearch.additionalResults,
      summary: response.text,
    };
  },
});

// ワークフローのステップを定義（反復処理を含む）
researchWorkflow
  .step(initialSearchStep)
  .then(analysisStep)
  .then(followUpSearchStep)
  .then(analysisStep, {
    when: { "followUpSearch.isInformationSufficient": false }
  })
  .then(followUpSearchStep, {
    when: { "followUpSearch.isInformationSufficient": false }
  })
  .then(resultIntegrationStep, {
    when: { "followUpSearch.isInformationSufficient": true }
  });

researchWorkflow.commit();
