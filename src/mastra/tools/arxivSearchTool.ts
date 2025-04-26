import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Web検索ツールのためのインターフェース (arXiv検索でも利用)
interface BraveSearchResponse {
  web: {
    results: Array<{
      title: string;
      url: string;
      description: string;
      page_age?: string; // Brave Search APIが返す可能性のある追加フィールド
    }>;
    total_results_estimation?: number;
  };
}

export const arxivSearchTool = createTool({
  id: 'arxiv-search',
  description: '指定されたクエリでarXiv上の学術論文を検索します',
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

    // count の上限を設定
    const limitedCount = Math.min(count, 10);

    // ユーザーのクエリの前に "site:arxiv.org " を追加
    const siteScopedQuery = `site:arxiv.org ${query}`;
    
    // 検索URLを構築
    const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(siteScopedQuery)}&count=${limitedCount}`;

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

    // 結果がない場合のハンドリングは維持
    if (!data.web || !data.web.results || data.web.results.length === 0) {
      return {
        results: [],
        totalResults: 0
      };
    }

    // フィルタリング処理を削除 (API側でドメイン指定済みのため)
    // const arxivResults = data.web.results.filter(result => 
    //   result.url.startsWith('https://arxiv.org/abs/')
    // );

    // APIから返された結果をそのまま使用
    return {
      results: data.web.results.map(result => ({
        title: result.title,
        url: result.url,
        description: result.description
      })),
      // APIから返された結果の件数をtotalResultsとする
      totalResults: data.web.results.length
    };
  },
}); 