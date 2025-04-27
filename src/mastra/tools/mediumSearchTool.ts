import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Web検索ツールのためのインターフェース (Medium検索でも利用)
interface BraveSearchResponse {
  web: {
    results: Array<{
      title: string;
      url: string;
      description: string;
      // Brave Search APIが返す可能性のある追加フィールド
      profile?: { name: string; url: string; img: string }; 
      page_age?: string;
    }>;
    total_results_estimation?: number;
  };
}

export const mediumSearchTool = createTool({
  id: 'medium-search',
  description: '指定されたクエリでMedium.com上の記事を検索します (Web検索経由)',
  inputSchema: z.object({
    query: z.string().describe('検索キーワードやタグ'),
    count: z.number().int().min(1).max(10).optional().default(5).describe('取得する結果数 (デフォルト5, 最大10)'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string().describe('記事タイトル'),
      url: z.string().describe('記事URL'),
      description: z.string().describe('記事の抜粋や説明'),
      // 追加情報 (取得できれば)
      authorName: z.string().optional().describe('著者名 (取得できた場合)'), 
      publishedDate: z.string().optional().describe('公開日 (取得できた場合)')
    })),
    totalResultsEstimation: z.number().optional().describe('推定合計結果数'),
  }),
  execute: async ({ context }) => {
    const { query, count = 5 } = context;
    
    const apiKey = process.env.BRAVE_API_KEY;
    
    if (!apiKey) {
      throw new Error('環境変数 BRAVE_API_KEY が設定されていません');
    }

    // count の上限を設定 (WebSearchToolと同様)
    const limitedCount = Math.min(count, 10); 

    // ユーザーのクエリの前に "site:medium.com " を追加
    const siteScopedQuery = `site:medium.com ${query}`;
    
    const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(siteScopedQuery)}&count=${limitedCount}`;
    console.log(`Executing Medium search via Brave: ${searchUrl}`);

    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Brave Search APIエラー (Medium Search): ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as BraveSearchResponse;

    if (!data.web || !data.web.results || data.web.results.length === 0) {
      return {
        results: [],
        totalResultsEstimation: 0
      };
    }

    // 結果を整形 (著者名や日付は取得できれば追加)
    const results = data.web.results.map(result => ({
        title: result.title,
        url: result.url,
        description: result.description,
        authorName: result.profile?.name, // profile情報があれば著者名を取得
        publishedDate: result.page_age // page_ageがあれば公開日として利用
    }));

    return {
      results: results,
      totalResultsEstimation: data.web.total_results_estimation
    };
  },
}); 