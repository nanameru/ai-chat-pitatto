/**
 * Tree of Thoughts (ToT) リサーチ計画ツール
 * 
 * リサーチ計画の生成と最適化に関するツールを提供します。
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { ResearchPlan, ResearchQuery } from "../../types/tot";
// Add imports for AI Agent
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
// Fix the import path
import { searchTool as webSearchTool } from "../search-tool";
// エラーハンドリングユーティリティをインポート
import { handleJsonParseFailure, withAIModelBackoff, reportError } from "../../utils/errorHandling";

/**
 * リサーチ計画生成ツール
 * 
 * 選択された思考経路からリサーチ計画を生成します。
 */
export const researchPlanGenerator = createTool({
  id: "Research Plan Generator",
  inputSchema: z.object({
    selectedThought: z.object({
      id: z.string(),
      content: z.string(),
      score: z.number().optional()
    }).describe("選択された思考経路"),
    query: z.string().describe("元のクエリ"),
    maxSubtopics: z.number().min(1).max(10).default(5).describe("生成するサブトピックの最大数"),
    maxQueries: z.number().min(1).max(20).default(10).describe("生成する検索クエリの最大数"),
    selectedModelId: z.string().optional().describe("ユーザーが選択したモデルID (OpenAI API互換名)"),
  }),
  outputSchema: z.object({
    researchPlan: z.object({
      approach: z.string(),
      description: z.string(),
      subtopics: z.array(z.string()),
      queries: z.array(z.object({
        query: z.string(),
        purpose: z.string(),
        queryType: z.enum(["general", "specific", "technical"]),
        priority: z.number()
      }))
    }).describe("生成されたリサーチ計画"),
    originalQuery: z.string().describe("元のクエリ"),
    timestamp: z.string().describe("タイムスタンプ"),
    isFallback: z.boolean().optional().describe("フォールバックプランかどうか")
  }),
  description: "選択された思考経路からリサーチ計画を生成します",
  execute: async ({ context: { selectedThought, query, maxSubtopics, maxQueries, selectedModelId } }) => {
    console.log(`[ToT] リサーチ計画生成: クエリ=${query.substring(0, 50)}...`);
    
    try {
      // Determine the model to use
      const modelIdToUse = selectedModelId || "gpt-4o-mini"; // Default to gpt-4o-mini if not provided
      
      // Create the planning agent
      const planningAgent = new Agent({
        name: "Research Plan Generator Agent",
        instructions: `あなたはリサーチ計画を作成する専門家です。ユーザーの選択した思考経路と元のクエリに基づいて、効果的なリサーチ計画を作成してください。
        1. サブトピック: ユーザーのクエリを詳しく調査するための具体的なサブトピックを生成してください。（最大${maxSubtopics}個）
        2. 検索クエリ: それぞれのサブトピックと全体の調査に効果的な検索クエリを生成してください。（最大${maxQueries}個）
        3. クエリ属性: 各検索クエリに目的(purpose)、種類(queryType: "general", "specific", "technical")、優先度(priority)を設定してください。
        4. アプローチ: 全体的な調査アプローチを1文で簡潔に説明してください。
        
        結果は以下のJSON形式で返してください:
        {
          "approach": "簡潔な調査アプローチの説明",
          "subtopics": ["サブトピック1", "サブトピック2", ...],
          "queries": [
            {
              "query": "検索クエリ1",
              "purpose": "このクエリの目的",
              "queryType": "general/specific/technical",
              "priority": 1
            },
            ...
          ]
        }`,
        model: openai(modelIdToUse),
      });
      
      // Generate research plan using the agent
      const prompt = `元のクエリ: "${query}"
選択された思考経路:
${selectedThought.content}

以上の情報に基づいて、効果的なリサーチ計画を作成してください。サブトピック数は最大${maxSubtopics}個、検索クエリ数は最大${maxQueries}個としてください。`;

      // AIモデル呼び出しを指数バックオフで実行
      const planResult = await withAIModelBackoff(() => 
        planningAgent.generate(prompt)
      );
      
      let researchPlan: ResearchPlan;
      let isFallback = false;
      
      try {
        // Try to parse the JSON response
        const parsedPlan = JSON.parse(planResult.text);
        
        // Validate and ensure all required fields are present
        researchPlan = {
          approach: parsedPlan.approach || selectedThought.content.split('\n')[0] || "総合的調査アプローチ",
          description: selectedThought.content,
          subtopics: Array.isArray(parsedPlan.subtopics) ? parsedPlan.subtopics.slice(0, maxSubtopics) : [],
          queries: Array.isArray(parsedPlan.queries) ? 
            parsedPlan.queries
              .slice(0, maxQueries)
              .map((q: any) => {
                // queryTypeを正しい型に制限する
                let typedQueryType: "general" | "specific" | "technical" = "general";
                if (q.queryType === "general" || q.queryType === "specific" || q.queryType === "technical") {
                  typedQueryType = q.queryType;
                }
                
                const result: ResearchQuery = {
                  query: q.query || query,
                  purpose: q.purpose || "情報収集",
                  queryType: typedQueryType,
                  priority: typeof q.priority === 'number' ? q.priority : 1
                };
                return result;
              }) as ResearchQuery[] : []
        };
      } catch (parseError) {
        // 新しいエラーハンドリングユーティリティを使用
        const fallbackResult = handleJsonParseFailure(parseError, planResult.text, {
          query,
          selectedThoughtId: selectedThought.id,
          modelId: modelIdToUse,
          tool: "researchPlanGenerator"
        });
        
        // Fallback to a minimal default plan if parsing fails
        // This ensures the tool doesn't fail completely
        isFallback = true;
        researchPlan = {
          approach: selectedThought.content.split('\n')[0] || "総合的調査アプローチ",
          description: selectedThought.content,
          subtopics: [`${query}の基本概念`, `${query}の実用例`, `${query}の最新動向`].slice(0, maxSubtopics),
          queries: [
            {
              query: query,
              purpose: "基本情報収集",
              queryType: "general" as const,
              priority: 1
            },
            {
              query: `${query} 実用例`,
              purpose: "実用例の調査",
              queryType: "specific" as const,
              priority: 2
            },
            {
              query: `${query} 最新動向`,
              purpose: "最新情報の収集",
              queryType: "specific" as const,
              priority: 3
            }
          ].slice(0, maxQueries)
        };
      }
      
      // outputSchemaを使用して返り値を検証
      return {
        researchPlan,
        originalQuery: query,
        timestamp: new Date().toISOString(),
        isFallback
      };
    } catch (error: unknown) {
      // エラー報告を追加
      reportError('research_plan_generator_error', error, {
        query,
        selectedThoughtId: selectedThought.id
      });
      
      console.error(`[ToT] リサーチ計画生成エラー:`, error);
      throw new Error(`リサーチ計画生成中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});

/**
 * クエリ最適化ツール
 * 
 * 検索クエリを各ツールの特性に合わせて最適化します。
 */
export const queryOptimizer = createTool({
  id: "Query Optimizer",
  inputSchema: z.object({
    queries: z.array(z.object({
      query: z.string(),
      purpose: z.string(),
      queryType: z.enum(["general", "specific", "technical"]),
      priority: z.number().optional()
    })).describe("最適化する検索クエリのリスト"),
    targetTool: z.string().default("web_search").describe("対象ツール（例: web_search, scholar_search）"),
  }),
  outputSchema: z.object({
    optimizedQueries: z.array(z.object({
      query: z.string(),
      purpose: z.string(), 
      queryType: z.enum(["general", "specific", "technical"]),
      priority: z.number().optional(),
      originalQuery: z.string()
    })).describe("最適化された検索クエリのリスト"),
    targetTool: z.string().describe("最適化対象のツール名"),
    timestamp: z.string().describe("タイムスタンプ")
  }),
  description: "検索クエリを各ツールの特性に合わせて最適化します",
  execute: async ({ context: { queries, targetTool } }) => {
    console.log(`[ToT] クエリ最適化: ツール=${targetTool}, クエリ数=${queries.length}`);
    
    try {
      // ツールごとの最適化ルールを定義
      const optimizationRules: { [key: string]: (query: string, queryType: ResearchQuery["queryType"]) => string } = {
        "web_search": (query, queryType) => {
          // Web検索向けの最適化
          if (queryType === "general") {
            return query; // 一般クエリはそのまま
          } else if (queryType === "specific") {
            return `${query} detailed information`; // 特定クエリは詳細情報を追加
          } else if (queryType === "technical") {
            return `${query} technical documentation guide`; // 技術クエリはドキュメントを追加
          }
          return query;
        },
        "scholar_search": (query, queryType) => {
          // 学術検索向けの最適化
          return `${query} research paper academic`;
        },
        "news_search": (query, queryType) => {
          // ニュース検索向けの最適化
          return `${query} latest news recent developments`;
        }
      };
      
      // デフォルトの最適化ルール
      const defaultOptimizer = (query: string, queryType: ResearchQuery["queryType"]) => query;
      
      // 対象ツールの最適化ルールを取得
      const optimizer = optimizationRules[targetTool] || defaultOptimizer;
      
      // クエリを最適化
      const optimizedQueries = queries.map(queryItem => {
        const optimizedQuery = optimizer(queryItem.query, queryItem.queryType);
        return {
          ...queryItem,
          originalQuery: queryItem.query,
          query: optimizedQuery
        };
      });
      
      // outputSchemaを使用して返り値を検証
      return {
        optimizedQueries,
        targetTool,
        timestamp: new Date().toISOString()
      };
    } catch (error: unknown) {
      console.error(`[ToT] クエリ最適化エラー:`, error);
      throw new Error(`クエリ最適化中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});

/**
 * 並列検索実行ツール
 * 
 * 複数の検索クエリを並列実行します。
 * 注: このツールは実際の検索ツールを呼び出すラッパーです。
 */
export const parallelSearchExecutor = createTool({
  id: "Parallel Search Executor",
  inputSchema: z.object({
    queries: z.array(z.object({
      query: z.string(),
      purpose: z.string(),
      queryType: z.enum(["general", "specific", "technical"]),
      priority: z.number().optional()
    })).describe("実行する検索クエリのリスト"),
    maxParallel: z.number().min(1).max(10).default(3).describe("同時実行する最大クエリ数"),
    searchTool: z.string().default("searchTool").describe("使用する検索ツールの名前"),
  }),
  outputSchema: z.object({
    searchResults: z.array(z.object({
      query: z.string().describe("実行されたクエリ"),
      purpose: z.string().describe("クエリの目的"),
      results: z.array(z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
        date: z.string().optional()
      })).describe("検索結果のリスト"),
      timestamp: z.string().describe("検索実行時間")
    })).describe("すべてのクエリの検索結果"),
    totalQueries: z.number().describe("総クエリ数"),
    executedQueries: z.number().describe("実行されたクエリ数"),
    searchTool: z.string().describe("使用した検索ツール名"),
    timestamp: z.string().describe("タイムスタンプ")
  }),
  description: "複数の検索クエリを並列実行します",
  execute: async ({ context: { queries, maxParallel, searchTool } }) => {
    console.log(`[ToT] 並列検索実行: クエリ数=${queries.length}, 最大並列数=${maxParallel}`);
    
    try {
      // クエリを優先度順にソート
      const sortedQueries = [...queries].sort((a, b) => {
        const aPriority = a.priority ?? Number.MAX_SAFE_INTEGER;
        const bPriority = b.priority ?? Number.MAX_SAFE_INTEGER;
        return aPriority - bPriority;
      });
      
      // バッチサイズを決定（最大並列数）
      const batchSize = Math.min(maxParallel, sortedQueries.length);
      
      // 検索結果のコンテナ
      const searchResults = [];
      
      // バッチ処理で並列検索を実行
      for (let i = 0; i < sortedQueries.length; i += batchSize) {
        const batch = sortedQueries.slice(i, i + batchSize);
        
        // 各バッチのクエリを並列実行
        const batchPromises = batch.map(async (queryItem) => {
          try {
            // 検索を実行
            // webSearchTool が未定義の場合はエラーをスローする
            if (!webSearchTool || typeof webSearchTool.execute !== 'function') {
              throw new Error("検索ツールが見つかりません");
            }
            
            // Webでこのクエリを検索して結果を取得
            const searchResult = await webSearchTool.execute({
              context: { query: queryItem.query },
              container: {} as any  // 暫定対応: 型エラー回避
            });
            
            // 型アサーションを使用して結果の型を明示
            const result = searchResult as { results: Array<{ title: string; url: string; snippet: string; date?: string }> };
            
            // 結果を整形
            return {
              query: queryItem.query,
              purpose: queryItem.purpose,
              results: result.results,
              timestamp: new Date().toISOString()
            };
          } catch (error) {
            console.error(`[ToT] クエリ実行エラー (${queryItem.query}):`, error);
            
            // エラー時はフォールバックの結果を返す
            return {
              query: queryItem.query,
              purpose: queryItem.purpose,
              results: [
                {
                  title: `${queryItem.query}に関する情報（検索エラー）`,
                  url: `https://example.com/error?q=${encodeURIComponent(queryItem.query)}`,
                  snippet: `検索中にエラーが発生しました。後でもう一度試してください。`,
                  date: new Date().toISOString().split('T')[0]
                }
              ],
              timestamp: new Date().toISOString()
            };
          }
        });
        
        // バッチの実行を待機して結果を収集
        const batchResults = await Promise.all(batchPromises);
        searchResults.push(...batchResults);
      }
      
      // outputSchemaを使用して返り値を検証
      return {
        searchResults,
        totalQueries: queries.length,
        executedQueries: searchResults.length,
        searchTool,
        timestamp: new Date().toISOString()
      };
    } catch (error: unknown) {
      console.error(`[ToT] 並列検索実行エラー:`, error);
      throw new Error(`並列検索実行中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});
