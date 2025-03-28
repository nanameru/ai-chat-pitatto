import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * 検索ツール - ウェブ検索を実行して結果を返す
 * 
 * このツールは、ユーザーの検索クエリに基づいてウェブ検索を実行し、
 * 検索結果を構造化されたデータとして返します。
 */
export const searchTool = createTool({
  id: "Web Search",
  inputSchema: z.object({
    query: z.string().describe("検索クエリ"),
  }),
  description: "ウェブ検索を実行して情報を取得します",
  execute: async ({ context: { query } }) => {
    console.log(`検索実行: ${query}`);
    
    // 実際の検索APIを呼び出す実装
    // 開発段階ではモックデータを返す
    const mockResults = [
      { title: `${query}に関する情報1`, snippet: `これは${query}についての情報です。`, url: 'https://example.com/1' },
      { title: `${query}に関する情報2`, snippet: `${query}の詳細な解説です。`, url: 'https://example.com/2' },
    ];
    
    return {
      query,
      results: mockResults,
      timestamp: new Date().toISOString(),
    };
  },
});
