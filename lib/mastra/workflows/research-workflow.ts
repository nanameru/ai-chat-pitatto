import { Workflow, Step } from "@mastra/core/workflows";
import { z } from "zod";
import { deepResearchAgent } from "../agents/deep-research-agent";

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
    const query = context?.getStepResult<{ query: string }>("trigger")?.query;
    
    const response = await deepResearchAgent.tools.searchTool.execute({
      context: { query },
    });
    
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
    const searchResults = context?.getStepResult("initialSearch");
    
    const response = await deepResearchAgent.tools.analysisTool.execute({
      context: {
        query: searchResults.query,
        results: searchResults.results,
      },
    });
    
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
    
    for (const query of analysis.followUpQueries) {
      const response = await deepResearchAgent.tools.searchTool.execute({
        context: { query },
      });
      
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
    
    const evaluationResponse = await deepResearchAgent.generate(evaluationPrompt, {
      output: z.object({
        isInformationSufficient: z.boolean(),
        reasonForDecision: z.string(),
      }),
    });
    
    return { 
      additionalResults: [...(previousIterations?.additionalResults || []), ...additionalResults],
      iterationCount: iterationCount + 1,
      isInformationSufficient: evaluationResponse.object.isInformationSufficient
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
    
    const response = await deepResearchAgent.generate(prompt);
    
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
    when: { "followUpSearch.isInformationSufficient": false },
    after: "followUpSearch"
  })
  .then(followUpSearchStep, {
    when: { "followUpSearch.isInformationSufficient": false },
    after: "analysisStep"
  })
  .then(resultIntegrationStep, {
    when: { "followUpSearch.isInformationSufficient": true },
    after: "followUpSearch"
  });

researchWorkflow.commit();
