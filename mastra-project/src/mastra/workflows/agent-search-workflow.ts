import { Step, Workflow } from "@mastra/core/workflows";
import { z } from "zod";
import { webSearchAgent } from "../agents";
import { webSearchTool } from "../tools";

// 型定義を追加
interface SearchResult {
  title: string;
  url: string;
  description: string;
}

// Step 1: 通常のWeb検索を実行するステップ
const initialSearchStep = new Step({
  id: "initialSearch",
  description: "Performs the initial web search based on the user query",
  execute: async ({ context }) => {
    console.log("Trigger data:", JSON.stringify(context, null, 2));
    
    // トリガーデータの取得方法を修正
    let query: string;
    
    if (context.triggerData && typeof context.triggerData.query === 'string') {
      query = context.triggerData.query;
    } else {
      // 型アサーションで回避
      const anyContext = context as any;
      if (anyContext.input && typeof anyContext.input.query === 'string') {
        query = anyContext.input.query;
      } else if (typeof anyContext.input === 'string') {
        query = anyContext.input;
      } else {
        throw new Error("Search query is required. Please provide a 'query' field in the input.");
      }
    }
    
    console.log(`Executing search for query: ${query}`);
    
    // Web検索ツールを使用して検索を実行
    try {
      // 存在チェックとnull合体演算子
      if (!webSearchTool || typeof webSearchTool.execute !== 'function') {
        throw new Error("Web search tool is not available");
      }
      
      // ツール実行
      const results = await webSearchTool.execute({
        query,
        count: 5
      } as any);
      
      const searchResults = results.results || [];
      console.log(`Search completed with ${searchResults.length} results`);
      
      return {
        query,
        results: searchResults,
        totalResults: results.totalResults || 0
      };
    } catch (error: unknown) {
      console.error("Search error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Web search failed: ${errorMessage}`);
    }
  }
});

// Step 2: Web検索エージェントに結果を分析させるステップ
const agentAnalysisStep = new Step({
  id: "agentAnalysis",
  description: "Analyzes search results using the Web Search Agent",
  execute: async ({ context }) => {
    console.log("AgentAnalysis step context:", Object.keys(context));
    
    const searchResults = context.getStepResult<{ 
      query: string, 
      results: SearchResult[],
      totalResults: number
    }>("initialSearch");
    
    if (!searchResults) {
      throw new Error("Search results not found. Make sure the initialSearch step was successful.");
    }
    
    if (!searchResults.results || searchResults.results.length === 0) {
      return {
        query: searchResults.query,
        searchResults: [],
        agentAnalysis: "No search results were found for your query.",
        followUpQueries: ["Try a more general search term"]
      };
    }
    
    // 検索結果の情報を整形
    const formattedResults = searchResults.results.map((result, index) => 
      `[${index + 1}] ${result.title}\n${result.url}\n${result.description}`
    ).join("\n\n");
    
    console.log(`Sending ${searchResults.results.length} results to agent for analysis`);
    
    // エージェントに送信するメッセージを作成
    const message = `I need a detailed analysis of the following search results for the query: "${searchResults.query}"\n\n${formattedResults}\n\nPlease provide a comprehensive summary, highlight the most relevant information, and suggest any follow-up queries.`;
    
    try {
      // Web検索エージェントに分析を依頼
      if (!webSearchAgent || typeof webSearchAgent.generate !== 'function') {
        throw new Error("Web search agent is not available");
      }
      
      // APIに合わせて正しい形式で呼び出し
      const response = await webSearchAgent.generate(
        [{ role: "user", content: message }]
      );
      
      console.log("Agent analysis completed");
      
      // レスポンスの型に合わせて適切に取得
      const analysisText = typeof response === 'string' 
        ? response 
        : (response as any).text || (response as any).content || String(response);
      
      return {
        query: searchResults.query,
        searchResults: searchResults.results,
        agentAnalysis: analysisText,
        followUpQueries: [] // エージェントの回答から抽出できるようにしてもよい
      };
    } catch (error: unknown) {
      console.error("Agent analysis error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Agent analysis failed: ${errorMessage}`);
    }
  }
});

// Step 3: 最終結果を整形するステップ
const formatResultStep = new Step({
  id: "formatResult",
  description: "Formats the final output with search results and agent analysis",
  execute: async ({ context }) => {
    console.log("FormatResult step context:", Object.keys(context));
    
    const analysisResult = context.getStepResult<{
      query: string,
      searchResults: SearchResult[],
      agentAnalysis: string,
      followUpQueries: string[]
    }>("agentAnalysis");
    
    if (!analysisResult) {
      throw new Error("Analysis results not found. Make sure the agentAnalysis step was successful.");
    }
    
    // 検索結果のURLリストを作成
    const sources = analysisResult.searchResults.map(result => result.url);
    
    return {
      query: analysisResult.query,
      analysis: analysisResult.agentAnalysis,
      sources,
      timestamp: new Date().toISOString()
    };
  }
});

// ワークフロー定義
export const agentSearchWorkflow = new Workflow({
  name: "agentSearchWorkflow",
  triggerSchema: z.object({
    query: z.string().describe("Search query to analyze"),
  }),
});

// ワークフローのステップを設定
agentSearchWorkflow
  .step(initialSearchStep)
  .step(agentAnalysisStep)
  .step(formatResultStep)
  .commit(); 