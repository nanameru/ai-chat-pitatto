import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// --- Tool Definition ---
export const youTubeSearchTool = createTool({
  id: 'youtube-search',
  description: 'キーワードやオプションのフィルタを使ってYouTube動画を検索します。',
  inputSchema: z.object({
    query: z.string().describe('検索キーワード'),
    maxResults: z.number().int().min(1).max(50).optional().default(5).describe('取得する検索結果の最大数 (1-50)。デフォルト: 5'),
    order: z.enum(['relevance', 'date', 'rating', 'title', 'viewCount']).optional().default('relevance').describe('結果の並び順 (関連度、日付、評価、タイトル、再生回数など)'),
    videoDuration: z.enum(['any', 'short', 'medium', 'long']).optional().default('any').describe('動画の長さでのフィルタ (any, short[4分未満], medium[4-20分], long[20分以上])'),
    eventType: z.enum(['completed', 'live', 'upcoming']).optional().describe('ライブイベントでのフィルタ (完了、ライブ配信中、近日公開)'),
    channelId: z.string().optional().describe('特定のチャンネルID内の動画のみを検索'),
    publishedAfter: z.string().datetime({ message: "日付はISO 8601形式 (YYYY-MM-DDThh:mm:ssZ) である必要があります" }).optional().describe('この日時以降に公開された動画を検索 (ISO 8601形式)'),
    publishedBefore: z.string().datetime({ message: "日付はISO 8601形式 (YYYY-MM-DDThh:mm:ssZ) である必要があります" }).optional().describe('この日時以前に公開された動画を検索 (ISO 8601形式)'),
    regionCode: z.string().length(2).optional().describe('国コード (ISO 3166-1 alpha-2 例: JP, US) で結果を地域に最適化'),
    relevanceLanguage: z.string().optional().describe('検索クエリの言語コード (ISO 639-1 例: ja, en) で関連性を最適化'),
    videoCategoryId: z.string().optional().describe('特定の動画カテゴリIDでフィルタ (IDは別途取得が必要)'),
    videoLicense: z.enum(['any', 'creativeCommon', 'youtube']).optional().describe('ライセンス種類でフィルタ (any, creativeCommon, youtube)'),
    safeSearch: z.enum(['moderate', 'none', 'strict']).optional().describe('セーフサーチの設定 (moderate, none, strict)'),
    videoCaption: z.enum(['any', 'closedCaption', 'none']).optional().describe('字幕の有無でフィルタ (any, closedCaption[あり], none[なし])'),
    videoDefinition: z.enum(['any', 'high', 'standard']).optional().describe('画質でフィルタ (any, high[HD以上], standard)'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      videoId: z.string().describe('動画ID'),
      title: z.string().describe('動画タイトル'),
      description: z.string().describe('動画説明文'),
      channelTitle: z.string().describe('チャンネル名'),
      publishedAt: z.string().describe('公開日時 (ISO 8601形式)'),
      url: z.string().describe('動画URL'),
      thumbnailUrl: z.string().describe('デフォルトサムネイルURL'),
    })).describe('YouTubeからの動画検索結果リスト。'),
  }),
  execute: async ({ context }) => {
    const {
      query,
      maxResults,
      order,
      videoDuration,
      eventType,
      channelId,
      publishedAfter,
      publishedBefore,
      regionCode,
      relevanceLanguage,
      videoCategoryId,
      videoLicense,
      safeSearch,
      videoCaption,
      videoDefinition,
    } = context;
    
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      throw new Error('YouTube APIキー (YOUTUBE_API_KEY) が環境変数に設定されていません。');
    }

    const searchParams = new URLSearchParams({
      part: 'snippet',
      key: apiKey,
      q: query,
      type: 'video',
      maxResults: maxResults.toString(),
      order: order,
      videoDuration: videoDuration,
    });

    if (eventType) searchParams.append('eventType', eventType);
    if (channelId) searchParams.append('channelId', channelId);
    if (publishedAfter) searchParams.append('publishedAfter', publishedAfter);
    if (publishedBefore) searchParams.append('publishedBefore', publishedBefore);
    if (regionCode) searchParams.append('regionCode', regionCode);
    if (relevanceLanguage) searchParams.append('relevanceLanguage', relevanceLanguage);
    if (videoCategoryId) searchParams.append('videoCategoryId', videoCategoryId);
    if (videoLicense) searchParams.append('videoLicense', videoLicense);
    if (safeSearch) searchParams.append('safeSearch', safeSearch);
    if (videoCaption) searchParams.append('videoCaption', videoCaption);
    if (videoDefinition) searchParams.append('videoDefinition', videoDefinition);

    const searchUrl = `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`;
    console.log(`Executing YouTube search: ${searchUrl}`);

    try {
      const response = await fetch(searchUrl);

      if (!response.ok) {
        let errorDetails = 'Unknown error';
        try {
            const errorData = await response.json();
            errorDetails = errorData?.error?.message || JSON.stringify(errorData);
        } catch (e) {
            errorDetails = await response.text();
        }
        throw new Error(`YouTube API search failed: ${response.status} ${response.statusText} - ${errorDetails}`);
      }

      const data = await response.json();

      if (!data?.items || data.items.length === 0) {
        return { results: [] };
      }

      const results = data.items.map((item: any) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        thumbnailUrl: item.snippet.thumbnails.default.url,
      }));

      return { results };

    } catch (error) {
      console.error('Error during YouTube search execution:', error);
      let errorMessage = 'An unknown error occurred during YouTube search.';
      if (error instanceof Error) {
          errorMessage = `YouTube search failed: ${error.message}`;
      }
      throw new Error(errorMessage);
    }
  },
}); 