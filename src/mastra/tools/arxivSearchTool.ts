import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getLogger } from '..';

// Tavily Search APIのレスポンス型
interface TavilySearchResponse {
  results: Array<{
    title: string;
    url: string;
    content: string;
  }>;
  answer?: string;
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
    const logger = getLogger();
    
    logger.info(`(arxivSearchTool) 検索クエリの実行: "${query}", 取得件数: ${count}`);
    
    const apiKey = process.env.TAVILY_API_KEY;
    
    if (!apiKey) {
      const errorMsg = '環境変数 TAVILY_API_KEY が設定されていません';
      logger.error(`(arxivSearchTool) API_KEY不足エラー: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // count の上限を設定
    const limitedCount = Math.min(count, 10);

    // ユーザーのクエリの前に "site:arxiv.org " を追加
    const siteScopedQuery = `arxiv ${query}`;
    
    try {
      logger.info(`(arxivSearchTool) Tavily Search APIリクエスト開始: "${siteScopedQuery}"`);
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: siteScopedQuery,
          max_results: limitedCount,
          search_depth: 'basic',
          include_answer: false,
          include_domains: ['arxiv.org']
        })
      });

      logger.info(`(arxivSearchTool) APIレスポンス受信: ステータスコード=${response.status}`);
      
      if (!response.ok) {
        const responseText = await response.text().catch(e => `テキスト取得失敗: ${e.message}`);
        const errorMsg = `Tavily Search APIエラー: ${response.status} ${response.statusText}. レスポンス: ${responseText}`;
        logger.error(`(arxivSearchTool) APIエラー: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      logger.info(`(arxivSearchTool) APIレスポンスのJSONパース開始`);
      const data = await response.json() as TavilySearchResponse;
      logger.info(`(arxivSearchTool) JSONパース完了`);

      if (!data.results || data.results.length === 0) {
        logger.info(`(arxivSearchTool) 検索結果なし: query="${siteScopedQuery}"`);
        return {
          results: [],
          totalResults: 0
        };
      }

      // arXiv関連の結果をフィルタリング（念のため）
      const arxivResults = data.results.filter(result => 
        result.url.includes('arxiv.org')
      );

      if (arxivResults.length === 0) {
        logger.info(`(arxivSearchTool) arXiv関連の検索結果なし: query="${siteScopedQuery}"`);
        return {
          results: [],
          totalResults: 0
        };
      }

      const results = arxivResults.map(result => ({
        title: result.title,
        url: result.url,
        description: result.content
      }));
      
      logger.info(`(arxivSearchTool) 検索成功: ${results.length}件の結果を取得`);
      
      return {
        results,
        totalResults: results.length
      };
    } catch (error) {
      // エラーの詳細情報を記録
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error(`(arxivSearchTool) 検索実行中のエラー: ${errorMessage}`);
      if (errorStack) {
        logger.error(`(arxivSearchTool) エラースタック: ${errorStack}`);
      }
      
      // 環境変数の状態をログに出力（API_KEYは一部マスク）
      const maskedApiKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'undefined';
      logger.error(`(arxivSearchTool) 環境変数状態: TAVILY_API_KEY=${maskedApiKey}`);
      
      throw error;
    }
  },
}); 