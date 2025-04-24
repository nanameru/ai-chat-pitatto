import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Web検索ツールのためのインターフェース
interface BraveSearchResponse {
  web: {
    results: Array<{
      title: string;
      url: string;
      description: string;
    }>;
    total_results_estimation?: number;
  };
}

export const webSearchTool = createTool({
  id: 'web-search',
  description: '指定されたクエリでウェブ検索を実行します',
  inputSchema: z.object({
    query: z.string().describe('検索クエリ'),
    count: z.number().optional().describe('取得する結果数 (デフォルト5, 最大10)'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string(),
      url: z.string(),
      description: z.string(),
    })),
    totalResults: z.number().optional(),
  }),
  execute: async ({ context }) => {
    const { query, count = 5 } = context;
    
    const apiKey = process.env.BRAVE_API_KEY;
    
    if (!apiKey) {
      throw new Error('環境変数 BRAVE_API_KEY が設定されていません');
    }

    const limitedCount = Math.min(count, 10);
    
    const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limitedCount}`;

    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Brave Search APIエラー: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as BraveSearchResponse;

    if (!data.web || !data.web.results || data.web.results.length === 0) {
      return {
        results: [],
        totalResults: 0
      };
    }

    return {
      results: data.web.results.map(result => ({
        title: result.title,
        url: result.url,
        description: result.description
      })),
      totalResults: data.web.total_results_estimation
    };
  },
}); 