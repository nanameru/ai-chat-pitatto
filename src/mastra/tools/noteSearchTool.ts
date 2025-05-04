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

export const noteSearchTool = createTool({
  id: 'note-search',
  description: '指定されたクエリでnote.com上の記事を検索します',
  inputSchema: z.object({
    query: z.string().describe('検索キーワードやタグ'),
    count: z.number().int().min(1).max(10).optional().default(5).describe('取得する結果数 (デフォルト5, 最大10)'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string().describe('記事タイトル'),
      url: z.string().describe('記事URL'),
      description: z.string().describe('記事の抜粋や説明'),
      authorName: z.string().optional().describe('著者名 (取得できた場合)'), 
      publishedDate: z.string().optional().describe('公開日 (取得できた場合)')
    })),
    totalResultsEstimation: z.number().optional().describe('推定合計結果数'),
  }),
  execute: async ({ context }) => {
    const { query, count = 5 } = context;
    const logger = getLogger();
    
    logger.info(`(noteSearchTool) 検索クエリの実行: "${query}", 取得件数: ${count}`);
    
    const apiKey = process.env.TAVILY_API_KEY;
    
    if (!apiKey) {
      const errorMsg = '環境変数 TAVILY_API_KEY が設定されていません';
      logger.error(`(noteSearchTool) API_KEY不足エラー: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const limitedCount = Math.min(count, 10); 

    // 検索ドメインを指定
    const siteScopedQuery = `note ${query}`; 
    
    logger.info(`(noteSearchTool) Tavily Search APIリクエスト開始: "${siteScopedQuery}"`);
    
    try {
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
          include_domains: ['note.com']
        })
      });

      logger.info(`(noteSearchTool) APIレスポンス受信: ステータスコード=${response.status}`);
      
      if (!response.ok) {
        const responseText = await response.text().catch(e => `テキスト取得失敗: ${e.message}`);
        const errorMsg = `Tavily Search APIエラー: ${response.status} ${response.statusText}. レスポンス: ${responseText}`;
        logger.error(`(noteSearchTool) APIエラー: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      logger.info(`(noteSearchTool) APIレスポンスのJSONパース開始`);
      const data = await response.json() as TavilySearchResponse;
      logger.info(`(noteSearchTool) JSONパース完了`);

      if (!data.results || data.results.length === 0) {
        logger.info(`(noteSearchTool) 検索結果なし: query="${siteScopedQuery}"`);
        return {
          results: [],
          totalResultsEstimation: 0
        };
      }

      // note.com 関連の結果をフィルタリング（念のため）
      const noteResults = data.results.filter(result => 
        result.url.includes('note.com')
      );

      if (noteResults.length === 0) {
        logger.info(`(noteSearchTool) note関連の検索結果なし: query="${siteScopedQuery}"`);
        return {
          results: [],
          totalResultsEstimation: 0
        };
      }

      const results = noteResults.map(result => {
        // 著者名と公開日を抽出する処理（仮の実装）
        // Tavilyでは直接メタデータが取得できないため、単純な実装にする
        let authorName = undefined;
        let publishedDate = undefined;
        
        // URL から著者名を推測する（例: note.com/username/... の形式から）
        const urlMatch = result.url.match(/note\.com\/([^\/]+)/);
        if (urlMatch && urlMatch[1]) {
          authorName = urlMatch[1];
        }
        
        return {
          title: result.title,
          url: result.url,
          description: result.content,
          authorName,
          publishedDate
        };
      });
      
      logger.info(`(noteSearchTool) 検索成功: ${results.length}件の結果を取得`);
      
      return {
        results,
        totalResultsEstimation: results.length
      };
    } catch (error) {
      // エラーの詳細情報を記録
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error(`(noteSearchTool) 検索実行中のエラー: ${errorMessage}`);
      if (errorStack) {
        logger.error(`(noteSearchTool) エラースタック: ${errorStack}`);
      }
      
      // 環境変数の状態をログに出力（API_KEYは一部マスク）
      const maskedApiKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'undefined';
      logger.error(`(noteSearchTool) 環境変数状態: TAVILY_API_KEY=${maskedApiKey}`);
      
      throw error;
    }
  },
}); 