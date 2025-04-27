import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Buffer } from 'buffer';

const webSearchTool = createTool({
  id: "web-search",
  description: "\u6307\u5B9A\u3055\u308C\u305F\u30AF\u30A8\u30EA\u3067\u30A6\u30A7\u30D6\u691C\u7D22\u3092\u5B9F\u884C\u3057\u307E\u3059",
  inputSchema: z.object({
    query: z.string().describe("\u691C\u7D22\u30AF\u30A8\u30EA"),
    count: z.number().optional().describe("\u53D6\u5F97\u3059\u308B\u7D50\u679C\u6570 (\u30C7\u30D5\u30A9\u30EB\u30C85, \u6700\u592710)")
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string(),
      url: z.string(),
      description: z.string()
    })),
    totalResults: z.number().optional()
  }),
  execute: async ({ context }) => {
    const { query, count = 5 } = context;
    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) {
      throw new Error("\u74B0\u5883\u5909\u6570 BRAVE_API_KEY \u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093");
    }
    const limitedCount = Math.min(count, 10);
    const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limitedCount}`;
    const response = await fetch(searchUrl, {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey
      }
    });
    if (!response.ok) {
      throw new Error(`Brave Search API\u30A8\u30E9\u30FC: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.web || !data.web.results || data.web.results.length === 0) {
      return {
        results: [],
        totalResults: 0
      };
    }
    return {
      results: data.web.results.map((result) => ({
        title: result.title,
        url: result.url,
        description: result.description
      })),
      totalResults: data.web.total_results_estimation
    };
  }
});

const arxivSearchTool = createTool({
  id: "arxiv-search",
  description: "\u6307\u5B9A\u3055\u308C\u305F\u30AF\u30A8\u30EA\u3067arXiv\u4E0A\u306E\u5B66\u8853\u8AD6\u6587\u3092\u691C\u7D22\u3057\u307E\u3059",
  inputSchema: z.object({
    query: z.string().describe("\u691C\u7D22\u30AF\u30A8\u30EA"),
    count: z.number().optional().describe("\u53D6\u5F97\u3059\u308B\u7D50\u679C\u6570 (\u30C7\u30D5\u30A9\u30EB\u30C85, \u6700\u592710)")
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string(),
      url: z.string(),
      description: z.string()
    })),
    totalResults: z.number().optional()
  }),
  execute: async ({ context }) => {
    const { query, count = 5 } = context;
    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) {
      throw new Error("\u74B0\u5883\u5909\u6570 BRAVE_API_KEY \u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093");
    }
    const limitedCount = Math.min(count, 10);
    const siteScopedQuery = `site:arxiv.org ${query}`;
    const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(siteScopedQuery)}&count=${limitedCount}`;
    const response = await fetch(searchUrl, {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey
      }
    });
    if (!response.ok) {
      throw new Error(`Brave Search API\u30A8\u30E9\u30FC: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.web || !data.web.results || data.web.results.length === 0) {
      return {
        results: [],
        totalResults: 0
      };
    }
    return {
      results: data.web.results.map((result) => ({
        title: result.title,
        url: result.url,
        description: result.description
      })),
      // APIから返された結果の件数をtotalResultsとする
      totalResults: data.web.results.length
    };
  }
});

let cachedToken = null;
async function getRedditAccessToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.acquired_at + (cachedToken.expires_in - 60) * 1e3 > now) {
    return cachedToken.access_token;
  }
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const username = process.env.REDDIT_USERNAME;
  if (!clientId || !clientSecret || !username) {
    throw new Error("Reddit API credentials (REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME) are not set in environment variables.");
  }
  const tokenUrl = "https://www.reddit.com/api/v1/access_token";
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const userAgent = `MastraRedditTool/0.1 by ${username}`;
  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "User-Agent": userAgent,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials&scope=read"
      // Requesting read-only scope
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get Reddit access token: ${response.status} ${response.statusText} - ${errorText}`);
    }
    const tokenData = await response.json();
    cachedToken = { ...tokenData, acquired_at: now };
    console.log("Successfully obtained new Reddit access token.");
    return cachedToken.access_token;
  } catch (error) {
    console.error("Error fetching Reddit access token:", error);
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    throw new Error(`Error fetching Reddit access token: ${errorMessage}`);
  }
}
const redditSearchTool = createTool({
  id: "reddit-search",
  description: "\u30AD\u30FC\u30EF\u30FC\u30C9\u3084\u30AA\u30D7\u30B7\u30E7\u30F3\u306E\u30D5\u30A3\u30EB\u30BF\u3092\u4F7F\u3063\u3066Reddit\u306E\u6295\u7A3F\u3084\u30B3\u30E1\u30F3\u30C8\u3092\u691C\u7D22\u3057\u307E\u3059\u3002",
  inputSchema: z.object({
    query: z.string().describe('\u691C\u7D22\u30AD\u30FC\u30EF\u30FC\u30C9\uFF08\u4F8B: "\u5927\u898F\u6A21\u8A00\u8A9E\u30E2\u30C7\u30EB", "subreddit:MachineLearning best llms"\uFF09'),
    subreddit: z.string().optional().describe('\u691C\u7D22\u5BFE\u8C61\u3092\u7279\u5B9A\u306E\u30B5\u30D6\u30EC\u30C7\u30A3\u30C3\u30C8\u306B\u9650\u5B9A\u3057\u307E\u3059\uFF08\u4F8B: "programming", "MachineLearning"\uFF09\u3002"r/"\u306F\u542B\u3081\u306A\u3044\u3067\u304F\u3060\u3055\u3044\u3002'),
    // type: z.enum(['link', 'comment', 'sr']).optional().default('link'),
    sort: z.enum(["relevance", "hot", "top", "new", "comments"]).optional().default("relevance").describe("\u7D50\u679C\u306E\u4E26\u3073\u9806"),
    time: z.enum(["hour", "day", "week", "month", "year", "all"]).optional().default("all").describe("top\u30BD\u30FC\u30C8\u6642\u306E\u671F\u9593\u6307\u5B9A"),
    // Restore simple description
    limit: z.number().int().min(1).max(100).optional().default(10).describe("\u8FD4\u3059\u7D50\u679C\u306E\u6700\u5927\u6570\uFF081-100\uFF09\u3002\u30C7\u30D5\u30A9\u30EB\u30C8: 10")
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      id: z.string().describe("\u6295\u7A3F/\u30B3\u30E1\u30F3\u30C8ID"),
      title: z.string().optional().describe("\u6295\u7A3F\u30BF\u30A4\u30C8\u30EB\uFF08\u6295\u7A3F\u306E\u5834\u5408\u306E\u307F\u5B58\u5728\uFF09"),
      body: z.string().optional().describe("\u6295\u7A3F\u672C\u6587\u307E\u305F\u306F\u30B3\u30E1\u30F3\u30C8\u672C\u6587"),
      author: z.string().describe("\u6295\u7A3F\u8005\u540D"),
      subreddit: z.string().describe("\u30B5\u30D6\u30EC\u30C7\u30A3\u30C3\u30C8\u540D"),
      score: z.number().describe("\u6295\u7A3F/\u30B3\u30E1\u30F3\u30C8\u306E\u30B9\u30B3\u30A2"),
      num_comments: z.number().optional().describe("\u30B3\u30E1\u30F3\u30C8\u6570\uFF08\u6295\u7A3F\u306E\u5834\u5408\u306E\u307F\u5B58\u5728\uFF09"),
      created_utc: z.number().describe("\u4F5C\u6210\u65E5\u6642\uFF08Unix\u30BF\u30A4\u30E0\u30B9\u30BF\u30F3\u30D7\uFF09"),
      url: z.string().describe("\u6295\u7A3F/\u30B3\u30E1\u30F3\u30C8\u3078\u306E\u30D1\u30FC\u30DE\u30EA\u30F3\u30AF"),
      kind: z.string().describe("\u7A2E\u985E\uFF08t3: \u6295\u7A3F, t1: \u30B3\u30E1\u30F3\u30C8\uFF09")
    })).describe("Reddit\u304B\u3089\u306E\u691C\u7D22\u7D50\u679C\u30EA\u30B9\u30C8\u3002")
  }),
  execute: async ({ context }) => {
    const { query, subreddit, sort, time, limit } = context;
    const username = process.env.REDDIT_USERNAME;
    if (!username) {
      throw new Error("Reddit username (REDDIT_USERNAME) is not set in environment variables for User-Agent.");
    }
    const userAgent = `MastraRedditTool/0.1 by ${username}`;
    try {
      const accessToken = await getRedditAccessToken();
      const searchParams = new URLSearchParams({
        q: query,
        sort,
        t: time,
        limit: limit.toString(),
        // type: context.type || 'link', // Stick to default search which seems post-focused
        raw_json: "1"
        // Get raw JSON without HTML entities
      });
      let searchUrl;
      if (subreddit) {
        searchUrl = `https://oauth.reddit.com/r/${subreddit}/search?${searchParams.toString()}`;
        searchUrl += "&restrict_sr=1";
      } else {
        searchUrl = `https://oauth.reddit.com/search?${searchParams.toString()}`;
      }
      console.log(`Executing Reddit search: ${searchUrl}`);
      const response = await fetch(searchUrl, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "User-Agent": userAgent
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 429) {
          console.warn(`Reddit API rate limit likely exceeded. Status: ${response.status}`);
          throw new Error(`Reddit API rate limit likely exceeded. Please wait and try again.`);
        }
        throw new Error(`Reddit API search failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      const data = await response.json();
      if (!data?.data?.children || data.data.children.length === 0) {
        return { results: [] };
      }
      const results = data.data.children.map((item) => ({
        id: item.data.id,
        title: item.data.title,
        // Might be null for comments
        body: item.data.selftext || item.data.body,
        // Use selftext for posts, body for comments
        author: item.data.author,
        subreddit: item.data.subreddit,
        score: item.data.score,
        num_comments: item.data.num_comments,
        // Might be null for comments
        created_utc: item.data.created_utc,
        url: `https://www.reddit.com${item.data.permalink}`,
        // Construct full permalink
        kind: item.kind
        // Include kind (t3 or t1)
      }));
      return { results };
    } catch (error) {
      console.error("Error during Reddit search execution:", error);
      let errorMessage = "An unknown error occurred during Reddit search.";
      if (error instanceof Error) {
        errorMessage = `Reddit search failed: ${error.message}`;
      }
      throw new Error(errorMessage);
    }
  }
});

const youTubeSearchTool = createTool({
  id: "youtube-search",
  description: "\u30AD\u30FC\u30EF\u30FC\u30C9\u3084\u30AA\u30D7\u30B7\u30E7\u30F3\u306E\u30D5\u30A3\u30EB\u30BF\u3092\u4F7F\u3063\u3066YouTube\u52D5\u753B\u3092\u691C\u7D22\u3057\u307E\u3059\u3002",
  inputSchema: z.object({
    query: z.string().describe("\u691C\u7D22\u30AD\u30FC\u30EF\u30FC\u30C9"),
    maxResults: z.number().int().min(1).max(50).optional().default(5).describe("\u53D6\u5F97\u3059\u308B\u691C\u7D22\u7D50\u679C\u306E\u6700\u5927\u6570 (1-50)\u3002\u30C7\u30D5\u30A9\u30EB\u30C8: 5"),
    order: z.enum(["relevance", "date", "rating", "title", "viewCount"]).optional().default("relevance").describe("\u7D50\u679C\u306E\u4E26\u3073\u9806 (\u95A2\u9023\u5EA6\u3001\u65E5\u4ED8\u3001\u8A55\u4FA1\u3001\u30BF\u30A4\u30C8\u30EB\u3001\u518D\u751F\u56DE\u6570\u306A\u3069)"),
    videoDuration: z.enum(["any", "short", "medium", "long"]).optional().default("any").describe("\u52D5\u753B\u306E\u9577\u3055\u3067\u306E\u30D5\u30A3\u30EB\u30BF (any, short[4\u5206\u672A\u6E80], medium[4-20\u5206], long[20\u5206\u4EE5\u4E0A])"),
    eventType: z.enum(["completed", "live", "upcoming"]).optional().describe("\u30E9\u30A4\u30D6\u30A4\u30D9\u30F3\u30C8\u3067\u306E\u30D5\u30A3\u30EB\u30BF (\u5B8C\u4E86\u3001\u30E9\u30A4\u30D6\u914D\u4FE1\u4E2D\u3001\u8FD1\u65E5\u516C\u958B)"),
    channelId: z.string().optional().describe("\u7279\u5B9A\u306E\u30C1\u30E3\u30F3\u30CD\u30EBID\u5185\u306E\u52D5\u753B\u306E\u307F\u3092\u691C\u7D22"),
    publishedAfter: z.string().datetime({ message: "\u65E5\u4ED8\u306FISO 8601\u5F62\u5F0F (YYYY-MM-DDThh:mm:ssZ) \u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059" }).optional().describe("\u3053\u306E\u65E5\u6642\u4EE5\u964D\u306B\u516C\u958B\u3055\u308C\u305F\u52D5\u753B\u3092\u691C\u7D22 (ISO 8601\u5F62\u5F0F)"),
    publishedBefore: z.string().datetime({ message: "\u65E5\u4ED8\u306FISO 8601\u5F62\u5F0F (YYYY-MM-DDThh:mm:ssZ) \u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059" }).optional().describe("\u3053\u306E\u65E5\u6642\u4EE5\u524D\u306B\u516C\u958B\u3055\u308C\u305F\u52D5\u753B\u3092\u691C\u7D22 (ISO 8601\u5F62\u5F0F)"),
    regionCode: z.string().length(2).optional().describe("\u56FD\u30B3\u30FC\u30C9 (ISO 3166-1 alpha-2 \u4F8B: JP, US) \u3067\u7D50\u679C\u3092\u5730\u57DF\u306B\u6700\u9069\u5316"),
    relevanceLanguage: z.string().optional().describe("\u691C\u7D22\u30AF\u30A8\u30EA\u306E\u8A00\u8A9E\u30B3\u30FC\u30C9 (ISO 639-1 \u4F8B: ja, en) \u3067\u95A2\u9023\u6027\u3092\u6700\u9069\u5316"),
    videoCategoryId: z.string().optional().describe("\u7279\u5B9A\u306E\u52D5\u753B\u30AB\u30C6\u30B4\u30EAID\u3067\u30D5\u30A3\u30EB\u30BF (ID\u306F\u5225\u9014\u53D6\u5F97\u304C\u5FC5\u8981)"),
    videoLicense: z.enum(["any", "creativeCommon", "youtube"]).optional().describe("\u30E9\u30A4\u30BB\u30F3\u30B9\u7A2E\u985E\u3067\u30D5\u30A3\u30EB\u30BF (any, creativeCommon, youtube)"),
    safeSearch: z.enum(["moderate", "none", "strict"]).optional().describe("\u30BB\u30FC\u30D5\u30B5\u30FC\u30C1\u306E\u8A2D\u5B9A (moderate, none, strict)"),
    videoCaption: z.enum(["any", "closedCaption", "none"]).optional().describe("\u5B57\u5E55\u306E\u6709\u7121\u3067\u30D5\u30A3\u30EB\u30BF (any, closedCaption[\u3042\u308A], none[\u306A\u3057])"),
    videoDefinition: z.enum(["any", "high", "standard"]).optional().describe("\u753B\u8CEA\u3067\u30D5\u30A3\u30EB\u30BF (any, high[HD\u4EE5\u4E0A], standard)")
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      videoId: z.string().describe("\u52D5\u753BID"),
      title: z.string().describe("\u52D5\u753B\u30BF\u30A4\u30C8\u30EB"),
      description: z.string().describe("\u52D5\u753B\u8AAC\u660E\u6587"),
      channelTitle: z.string().describe("\u30C1\u30E3\u30F3\u30CD\u30EB\u540D"),
      publishedAt: z.string().describe("\u516C\u958B\u65E5\u6642 (ISO 8601\u5F62\u5F0F)"),
      url: z.string().describe("\u52D5\u753BURL"),
      thumbnailUrl: z.string().describe("\u30C7\u30D5\u30A9\u30EB\u30C8\u30B5\u30E0\u30CD\u30A4\u30EBURL")
    })).describe("YouTube\u304B\u3089\u306E\u52D5\u753B\u691C\u7D22\u7D50\u679C\u30EA\u30B9\u30C8\u3002")
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
      videoDefinition
    } = context;
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new Error("YouTube API\u30AD\u30FC (YOUTUBE_API_KEY) \u304C\u74B0\u5883\u5909\u6570\u306B\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002");
    }
    const searchParams = new URLSearchParams({
      part: "snippet",
      key: apiKey,
      q: query,
      type: "video",
      maxResults: maxResults.toString(),
      order,
      videoDuration
    });
    if (eventType) searchParams.append("eventType", eventType);
    if (channelId) searchParams.append("channelId", channelId);
    if (publishedAfter) searchParams.append("publishedAfter", publishedAfter);
    if (publishedBefore) searchParams.append("publishedBefore", publishedBefore);
    if (regionCode) searchParams.append("regionCode", regionCode);
    if (relevanceLanguage) searchParams.append("relevanceLanguage", relevanceLanguage);
    if (videoCategoryId) searchParams.append("videoCategoryId", videoCategoryId);
    if (videoLicense) searchParams.append("videoLicense", videoLicense);
    if (safeSearch) searchParams.append("safeSearch", safeSearch);
    if (videoCaption) searchParams.append("videoCaption", videoCaption);
    if (videoDefinition) searchParams.append("videoDefinition", videoDefinition);
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`;
    console.log(`Executing YouTube search: ${searchUrl}`);
    try {
      const response = await fetch(searchUrl);
      if (!response.ok) {
        let errorDetails = "Unknown error";
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
      const results = data.items.map((item) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        thumbnailUrl: item.snippet.thumbnails.default.url
      }));
      return { results };
    } catch (error) {
      console.error("Error during YouTube search execution:", error);
      let errorMessage = "An unknown error occurred during YouTube search.";
      if (error instanceof Error) {
        errorMessage = `YouTube search failed: ${error.message}`;
      }
      throw new Error(errorMessage);
    }
  }
});

const mediumSearchTool = createTool({
  id: "medium-search",
  description: "\u6307\u5B9A\u3055\u308C\u305F\u30AF\u30A8\u30EA\u3067Medium.com\u4E0A\u306E\u8A18\u4E8B\u3092\u691C\u7D22\u3057\u307E\u3059 (Web\u691C\u7D22\u7D4C\u7531)",
  inputSchema: z.object({
    query: z.string().describe("\u691C\u7D22\u30AD\u30FC\u30EF\u30FC\u30C9\u3084\u30BF\u30B0"),
    count: z.number().int().min(1).max(10).optional().default(5).describe("\u53D6\u5F97\u3059\u308B\u7D50\u679C\u6570 (\u30C7\u30D5\u30A9\u30EB\u30C85, \u6700\u592710)")
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string().describe("\u8A18\u4E8B\u30BF\u30A4\u30C8\u30EB"),
      url: z.string().describe("\u8A18\u4E8BURL"),
      description: z.string().describe("\u8A18\u4E8B\u306E\u629C\u7C8B\u3084\u8AAC\u660E"),
      // 追加情報 (取得できれば)
      authorName: z.string().optional().describe("\u8457\u8005\u540D (\u53D6\u5F97\u3067\u304D\u305F\u5834\u5408)"),
      publishedDate: z.string().optional().describe("\u516C\u958B\u65E5 (\u53D6\u5F97\u3067\u304D\u305F\u5834\u5408)")
    })),
    totalResultsEstimation: z.number().optional().describe("\u63A8\u5B9A\u5408\u8A08\u7D50\u679C\u6570")
  }),
  execute: async ({ context }) => {
    const { query, count = 5 } = context;
    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) {
      throw new Error("\u74B0\u5883\u5909\u6570 BRAVE_API_KEY \u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093");
    }
    const limitedCount = Math.min(count, 10);
    const siteScopedQuery = `site:medium.com ${query}`;
    const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(siteScopedQuery)}&count=${limitedCount}`;
    console.log(`Executing Medium search via Brave: ${searchUrl}`);
    const response = await fetch(searchUrl, {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey
      }
    });
    if (!response.ok) {
      throw new Error(`Brave Search API\u30A8\u30E9\u30FC (Medium Search): ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.web || !data.web.results || data.web.results.length === 0) {
      return {
        results: [],
        totalResultsEstimation: 0
      };
    }
    const results = data.web.results.map((result) => ({
      title: result.title,
      url: result.url,
      description: result.description,
      authorName: result.profile?.name,
      // profile情報があれば著者名を取得
      publishedDate: result.page_age
      // page_ageがあれば公開日として利用
    }));
    return {
      results,
      totalResultsEstimation: data.web.total_results_estimation
    };
  }
});

const noteSearchTool = createTool({
  id: "note-search",
  // IDを変更
  description: "\u6307\u5B9A\u3055\u308C\u305F\u30AF\u30A8\u30EA\u3067note.com\u4E0A\u306E\u8A18\u4E8B\u3092\u691C\u7D22\u3057\u307E\u3059 (Web\u691C\u7D22\u7D4C\u7531)",
  // 説明を変更
  inputSchema: z.object({
    query: z.string().describe("\u691C\u7D22\u30AD\u30FC\u30EF\u30FC\u30C9\u3084\u30BF\u30B0"),
    count: z.number().int().min(1).max(10).optional().default(5).describe("\u53D6\u5F97\u3059\u308B\u7D50\u679C\u6570 (\u30C7\u30D5\u30A9\u30EB\u30C85, \u6700\u592710)")
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string().describe("\u8A18\u4E8B\u30BF\u30A4\u30C8\u30EB"),
      url: z.string().describe("\u8A18\u4E8BURL"),
      description: z.string().describe("\u8A18\u4E8B\u306E\u629C\u7C8B\u3084\u8AAC\u660E"),
      authorName: z.string().optional().describe("\u8457\u8005\u540D (\u53D6\u5F97\u3067\u304D\u305F\u5834\u5408)"),
      publishedDate: z.string().optional().describe("\u516C\u958B\u65E5 (\u53D6\u5F97\u3067\u304D\u305F\u5834\u5408)")
    })),
    totalResultsEstimation: z.number().optional().describe("\u63A8\u5B9A\u5408\u8A08\u7D50\u679C\u6570")
  }),
  execute: async ({ context }) => {
    const { query, count = 5 } = context;
    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) {
      throw new Error("\u74B0\u5883\u5909\u6570 BRAVE_API_KEY \u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093");
    }
    const limitedCount = Math.min(count, 10);
    const siteScopedQuery = `site:note.com ${query}`;
    const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(siteScopedQuery)}&count=${limitedCount}`;
    console.log(`Executing Note search via Brave: ${searchUrl}`);
    const response = await fetch(searchUrl, {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey
      }
    });
    if (!response.ok) {
      throw new Error(`Brave Search API\u30A8\u30E9\u30FC (Note Search): ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.web || !data.web.results || data.web.results.length === 0) {
      return {
        results: [],
        totalResultsEstimation: 0
      };
    }
    const results = data.web.results.map((result) => ({
      title: result.title,
      url: result.url,
      description: result.description,
      authorName: result.profile?.name,
      publishedDate: result.page_age
    }));
    return {
      results,
      totalResultsEstimation: data.web.total_results_estimation
    };
  }
});

const weatherTool = createTool({
  id: "get-weather",
  description: "Get current weather for a location",
  inputSchema: z.object({
    location: z.string().describe("City name")
  }),
  outputSchema: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGust: z.number(),
    conditions: z.string(),
    location: z.string()
  }),
  execute: async ({ context }) => {
    return await getWeather(context.location);
  }
});
const getWeather = async (location) => {
  const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`;
  const geocodingResponse = await fetch(geocodingUrl);
  const geocodingData = await geocodingResponse.json();
  if (!geocodingData.results?.[0]) {
    throw new Error(`Location '${location}' not found`);
  }
  const { latitude, longitude, name } = geocodingData.results[0];
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code`;
  const response = await fetch(weatherUrl);
  const data = await response.json();
  return {
    temperature: data.current.temperature_2m,
    feelsLike: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    windGust: data.current.wind_gusts_10m,
    conditions: getWeatherCondition(data.current.weather_code),
    location: name
  };
};
function getWeatherCondition(code) {
  const conditions = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail"
  };
  return conditions[code] || "Unknown";
}

export { arxivSearchTool, mediumSearchTool, noteSearchTool, redditSearchTool, weatherTool, webSearchTool, youTubeSearchTool };
