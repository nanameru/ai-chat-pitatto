import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';
import { LibSQLStore } from '@mastra/libsql';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Step, Workflow } from '@mastra/core/workflows';
import { inspect } from 'util';
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
    const logger = getLogger();
    logger.info(`(webSearchTool) \u691C\u7D22\u30AF\u30A8\u30EA\u306E\u5B9F\u884C: "${query}", \u53D6\u5F97\u4EF6\u6570: ${count}`);
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      const errorMsg = "\u74B0\u5883\u5909\u6570 TAVILY_API_KEY \u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093";
      logger.error(`(webSearchTool) API_KEY\u4E0D\u8DB3\u30A8\u30E9\u30FC: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    const limitedCount = Math.min(count, 10);
    try {
      logger.info(`(webSearchTool) Tavily Search API\u30EA\u30AF\u30A8\u30B9\u30C8\u958B\u59CB`);
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query,
          max_results: limitedCount,
          search_depth: "basic",
          include_answer: false
        })
      });
      logger.info(`(webSearchTool) API\u30EC\u30B9\u30DD\u30F3\u30B9\u53D7\u4FE1: \u30B9\u30C6\u30FC\u30BF\u30B9\u30B3\u30FC\u30C9=${response.status}`);
      if (!response.ok) {
        const responseText = await response.text().catch((e) => `\u30C6\u30AD\u30B9\u30C8\u53D6\u5F97\u5931\u6557: ${e.message}`);
        const errorMsg = `Tavily Search API\u30A8\u30E9\u30FC: ${response.status} ${response.statusText}. \u30EC\u30B9\u30DD\u30F3\u30B9: ${responseText}`;
        logger.error(`(webSearchTool) API\u30A8\u30E9\u30FC: ${errorMsg}`);
        throw new Error(errorMsg);
      }
      logger.info(`(webSearchTool) API\u30EC\u30B9\u30DD\u30F3\u30B9\u306EJSON\u30D1\u30FC\u30B9\u958B\u59CB`);
      const data = await response.json();
      logger.info(`(webSearchTool) JSON\u30D1\u30FC\u30B9\u5B8C\u4E86`);
      if (!data.results || data.results.length === 0) {
        logger.info(`(webSearchTool) \u691C\u7D22\u7D50\u679C\u306A\u3057: query="${query}"`);
        return {
          results: [],
          totalResults: 0
        };
      }
      const results = data.results.map((result) => ({
        title: result.title,
        url: result.url,
        description: result.content
      }));
      logger.info(`(webSearchTool) \u691C\u7D22\u6210\u529F: ${results.length}\u4EF6\u306E\u7D50\u679C\u3092\u53D6\u5F97`);
      return {
        results,
        totalResults: results.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : void 0;
      logger.error(`(webSearchTool) \u691C\u7D22\u5B9F\u884C\u4E2D\u306E\u30A8\u30E9\u30FC: ${errorMessage}`);
      if (errorStack) {
        logger.error(`(webSearchTool) \u30A8\u30E9\u30FC\u30B9\u30BF\u30C3\u30AF: ${errorStack}`);
      }
      const maskedApiKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : "undefined";
      logger.error(`(webSearchTool) \u74B0\u5883\u5909\u6570\u72B6\u614B: TAVILY_API_KEY=${maskedApiKey}`);
      throw error;
    }
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
    const logger = getLogger();
    logger.info(`(arxivSearchTool) \u691C\u7D22\u30AF\u30A8\u30EA\u306E\u5B9F\u884C: "${query}", \u53D6\u5F97\u4EF6\u6570: ${count}`);
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      const errorMsg = "\u74B0\u5883\u5909\u6570 TAVILY_API_KEY \u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093";
      logger.error(`(arxivSearchTool) API_KEY\u4E0D\u8DB3\u30A8\u30E9\u30FC: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    const limitedCount = Math.min(count, 10);
    const siteScopedQuery = `arxiv ${query}`;
    try {
      logger.info(`(arxivSearchTool) Tavily Search API\u30EA\u30AF\u30A8\u30B9\u30C8\u958B\u59CB: "${siteScopedQuery}"`);
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: siteScopedQuery,
          max_results: limitedCount,
          search_depth: "basic",
          include_answer: false,
          include_domains: ["arxiv.org"]
        })
      });
      logger.info(`(arxivSearchTool) API\u30EC\u30B9\u30DD\u30F3\u30B9\u53D7\u4FE1: \u30B9\u30C6\u30FC\u30BF\u30B9\u30B3\u30FC\u30C9=${response.status}`);
      if (!response.ok) {
        const responseText = await response.text().catch((e) => `\u30C6\u30AD\u30B9\u30C8\u53D6\u5F97\u5931\u6557: ${e.message}`);
        const errorMsg = `Tavily Search API\u30A8\u30E9\u30FC: ${response.status} ${response.statusText}. \u30EC\u30B9\u30DD\u30F3\u30B9: ${responseText}`;
        logger.error(`(arxivSearchTool) API\u30A8\u30E9\u30FC: ${errorMsg}`);
        throw new Error(errorMsg);
      }
      logger.info(`(arxivSearchTool) API\u30EC\u30B9\u30DD\u30F3\u30B9\u306EJSON\u30D1\u30FC\u30B9\u958B\u59CB`);
      const data = await response.json();
      logger.info(`(arxivSearchTool) JSON\u30D1\u30FC\u30B9\u5B8C\u4E86`);
      if (!data.results || data.results.length === 0) {
        logger.info(`(arxivSearchTool) \u691C\u7D22\u7D50\u679C\u306A\u3057: query="${siteScopedQuery}"`);
        return {
          results: [],
          totalResults: 0
        };
      }
      const arxivResults = data.results.filter(
        (result) => result.url.includes("arxiv.org")
      );
      if (arxivResults.length === 0) {
        logger.info(`(arxivSearchTool) arXiv\u95A2\u9023\u306E\u691C\u7D22\u7D50\u679C\u306A\u3057: query="${siteScopedQuery}"`);
        return {
          results: [],
          totalResults: 0
        };
      }
      const results = arxivResults.map((result) => ({
        title: result.title,
        url: result.url,
        description: result.content
      }));
      logger.info(`(arxivSearchTool) \u691C\u7D22\u6210\u529F: ${results.length}\u4EF6\u306E\u7D50\u679C\u3092\u53D6\u5F97`);
      return {
        results,
        totalResults: results.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : void 0;
      logger.error(`(arxivSearchTool) \u691C\u7D22\u5B9F\u884C\u4E2D\u306E\u30A8\u30E9\u30FC: ${errorMessage}`);
      if (errorStack) {
        logger.error(`(arxivSearchTool) \u30A8\u30E9\u30FC\u30B9\u30BF\u30C3\u30AF: ${errorStack}`);
      }
      const maskedApiKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : "undefined";
      logger.error(`(arxivSearchTool) \u74B0\u5883\u5909\u6570\u72B6\u614B: TAVILY_API_KEY=${maskedApiKey}`);
      throw error;
    }
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
  description: "\u6307\u5B9A\u3055\u308C\u305F\u30AF\u30A8\u30EA\u3067Medium.com\u4E0A\u306E\u8A18\u4E8B\u3092\u691C\u7D22\u3057\u307E\u3059",
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
    const logger = getLogger();
    logger.info(`(mediumSearchTool) \u691C\u7D22\u30AF\u30A8\u30EA\u306E\u5B9F\u884C: "${query}", \u53D6\u5F97\u4EF6\u6570: ${count}`);
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      const errorMsg = "\u74B0\u5883\u5909\u6570 TAVILY_API_KEY \u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093";
      logger.error(`(mediumSearchTool) API_KEY\u4E0D\u8DB3\u30A8\u30E9\u30FC: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    const limitedCount = Math.min(count, 10);
    const siteScopedQuery = `medium ${query}`;
    logger.info(`(mediumSearchTool) Tavily Search API\u30EA\u30AF\u30A8\u30B9\u30C8\u958B\u59CB: "${siteScopedQuery}"`);
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: siteScopedQuery,
          max_results: limitedCount,
          search_depth: "basic",
          include_answer: false,
          include_domains: ["medium.com"]
        })
      });
      logger.info(`(mediumSearchTool) API\u30EC\u30B9\u30DD\u30F3\u30B9\u53D7\u4FE1: \u30B9\u30C6\u30FC\u30BF\u30B9\u30B3\u30FC\u30C9=${response.status}`);
      if (!response.ok) {
        const responseText = await response.text().catch((e) => `\u30C6\u30AD\u30B9\u30C8\u53D6\u5F97\u5931\u6557: ${e.message}`);
        const errorMsg = `Tavily Search API\u30A8\u30E9\u30FC: ${response.status} ${response.statusText}. \u30EC\u30B9\u30DD\u30F3\u30B9: ${responseText}`;
        logger.error(`(mediumSearchTool) API\u30A8\u30E9\u30FC: ${errorMsg}`);
        throw new Error(errorMsg);
      }
      logger.info(`(mediumSearchTool) API\u30EC\u30B9\u30DD\u30F3\u30B9\u306EJSON\u30D1\u30FC\u30B9\u958B\u59CB`);
      const data = await response.json();
      logger.info(`(mediumSearchTool) JSON\u30D1\u30FC\u30B9\u5B8C\u4E86`);
      if (!data.results || data.results.length === 0) {
        logger.info(`(mediumSearchTool) \u691C\u7D22\u7D50\u679C\u306A\u3057: query="${siteScopedQuery}"`);
        return {
          results: [],
          totalResultsEstimation: 0
        };
      }
      const mediumResults = data.results.filter(
        (result) => result.url.includes("medium.com")
      );
      if (mediumResults.length === 0) {
        logger.info(`(mediumSearchTool) Medium\u95A2\u9023\u306E\u691C\u7D22\u7D50\u679C\u306A\u3057: query="${siteScopedQuery}"`);
        return {
          results: [],
          totalResultsEstimation: 0
        };
      }
      const results = mediumResults.map((result) => {
        let authorName = void 0;
        let publishedDate = void 0;
        const urlMatch = result.url.match(/medium\.com\/@([^\/]+)/);
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
      logger.info(`(mediumSearchTool) \u691C\u7D22\u6210\u529F: ${results.length}\u4EF6\u306E\u7D50\u679C\u3092\u53D6\u5F97`);
      return {
        results,
        totalResultsEstimation: results.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : void 0;
      logger.error(`(mediumSearchTool) \u691C\u7D22\u5B9F\u884C\u4E2D\u306E\u30A8\u30E9\u30FC: ${errorMessage}`);
      if (errorStack) {
        logger.error(`(mediumSearchTool) \u30A8\u30E9\u30FC\u30B9\u30BF\u30C3\u30AF: ${errorStack}`);
      }
      const maskedApiKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : "undefined";
      logger.error(`(mediumSearchTool) \u74B0\u5883\u5909\u6570\u72B6\u614B: TAVILY_API_KEY=${maskedApiKey}`);
      throw error;
    }
  }
});

const noteSearchTool = createTool({
  id: "note-search",
  description: "\u6307\u5B9A\u3055\u308C\u305F\u30AF\u30A8\u30EA\u3067note.com\u4E0A\u306E\u8A18\u4E8B\u3092\u691C\u7D22\u3057\u307E\u3059",
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
    const logger = getLogger();
    logger.info(`(noteSearchTool) \u691C\u7D22\u30AF\u30A8\u30EA\u306E\u5B9F\u884C: "${query}", \u53D6\u5F97\u4EF6\u6570: ${count}`);
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      const errorMsg = "\u74B0\u5883\u5909\u6570 TAVILY_API_KEY \u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093";
      logger.error(`(noteSearchTool) API_KEY\u4E0D\u8DB3\u30A8\u30E9\u30FC: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    const limitedCount = Math.min(count, 10);
    const siteScopedQuery = `note ${query}`;
    logger.info(`(noteSearchTool) Tavily Search API\u30EA\u30AF\u30A8\u30B9\u30C8\u958B\u59CB: "${siteScopedQuery}"`);
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: siteScopedQuery,
          max_results: limitedCount,
          search_depth: "basic",
          include_answer: false,
          include_domains: ["note.com"]
        })
      });
      logger.info(`(noteSearchTool) API\u30EC\u30B9\u30DD\u30F3\u30B9\u53D7\u4FE1: \u30B9\u30C6\u30FC\u30BF\u30B9\u30B3\u30FC\u30C9=${response.status}`);
      if (!response.ok) {
        const responseText = await response.text().catch((e) => `\u30C6\u30AD\u30B9\u30C8\u53D6\u5F97\u5931\u6557: ${e.message}`);
        const errorMsg = `Tavily Search API\u30A8\u30E9\u30FC: ${response.status} ${response.statusText}. \u30EC\u30B9\u30DD\u30F3\u30B9: ${responseText}`;
        logger.error(`(noteSearchTool) API\u30A8\u30E9\u30FC: ${errorMsg}`);
        throw new Error(errorMsg);
      }
      logger.info(`(noteSearchTool) API\u30EC\u30B9\u30DD\u30F3\u30B9\u306EJSON\u30D1\u30FC\u30B9\u958B\u59CB`);
      const data = await response.json();
      logger.info(`(noteSearchTool) JSON\u30D1\u30FC\u30B9\u5B8C\u4E86`);
      if (!data.results || data.results.length === 0) {
        logger.info(`(noteSearchTool) \u691C\u7D22\u7D50\u679C\u306A\u3057: query="${siteScopedQuery}"`);
        return {
          results: [],
          totalResultsEstimation: 0
        };
      }
      const noteResults = data.results.filter(
        (result) => result.url.includes("note.com")
      );
      if (noteResults.length === 0) {
        logger.info(`(noteSearchTool) note\u95A2\u9023\u306E\u691C\u7D22\u7D50\u679C\u306A\u3057: query="${siteScopedQuery}"`);
        return {
          results: [],
          totalResultsEstimation: 0
        };
      }
      const results = noteResults.map((result) => {
        let authorName = void 0;
        let publishedDate = void 0;
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
      logger.info(`(noteSearchTool) \u691C\u7D22\u6210\u529F: ${results.length}\u4EF6\u306E\u7D50\u679C\u3092\u53D6\u5F97`);
      return {
        results,
        totalResultsEstimation: results.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : void 0;
      logger.error(`(noteSearchTool) \u691C\u7D22\u5B9F\u884C\u4E2D\u306E\u30A8\u30E9\u30FC: ${errorMessage}`);
      if (errorStack) {
        logger.error(`(noteSearchTool) \u30A8\u30E9\u30FC\u30B9\u30BF\u30C3\u30AF: ${errorStack}`);
      }
      const maskedApiKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : "undefined";
      logger.error(`(noteSearchTool) \u74B0\u5883\u5909\u6570\u72B6\u614B: TAVILY_API_KEY=${maskedApiKey}`);
      throw error;
    }
  }
});

const tavilySearchTool = createTool({
  id: "tavily-search",
  description: "\u6307\u5B9A\u3055\u308C\u305F\u30AF\u30A8\u30EA\u3067Tavily Search API\u3092\u4F7F\u7528\u3057\u3066\u30A6\u30A7\u30D6\u691C\u7D22\u3092\u5B9F\u884C\u3057\u307E\u3059",
  inputSchema: z.object({
    query: z.string().describe("\u691C\u7D22\u30AF\u30A8\u30EA")
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string(),
      url: z.string(),
      description: z.string()
    })),
    answer: z.string().optional()
  }),
  execute: async ({ context }) => {
    const { query } = context;
    const count = 5;
    const searchDepth = "basic";
    const includeAnswer = false;
    const logger = (await Promise.resolve().then(function () { return index; })).getLogger();
    logger.info(`(tavilySearchTool) \u691C\u7D22\u30AF\u30A8\u30EA\u306E\u5B9F\u884C: "${query}", \u53D6\u5F97\u4EF6\u6570: ${count}, \u691C\u7D22\u6DF1\u5EA6: ${searchDepth}`);
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      const errorMsg = "\u74B0\u5883\u5909\u6570 TAVILY_API_KEY \u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093";
      logger.error(`(tavilySearchTool) API_KEY\u4E0D\u8DB3\u30A8\u30E9\u30FC: ${errorMsg}`);
      return { results: [], error: errorMsg };
    }
    const limitedCount = Math.min(count, 10);
    try {
      logger.info(`(tavilySearchTool) Tavily Search API\u30EA\u30AF\u30A8\u30B9\u30C8\u958B\u59CB`);
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query,
          max_results: limitedCount,
          search_depth: searchDepth,
          include_answer: includeAnswer
        })
      });
      logger.info(`(tavilySearchTool) API\u30EC\u30B9\u30DD\u30F3\u30B9\u53D7\u4FE1: \u30B9\u30C6\u30FC\u30BF\u30B9\u30B3\u30FC\u30C9=${response.status}`);
      if (!response.ok) {
        const responseText = await response.text().catch((e) => `\u30C6\u30AD\u30B9\u30C8\u53D6\u5F97\u5931\u6557: ${e.message}`);
        const errorMsg = `Tavily Search API\u30A8\u30E9\u30FC: ${response.status} ${response.statusText}. \u30EC\u30B9\u30DD\u30F3\u30B9: ${responseText}`;
        logger.error(`(tavilySearchTool) API\u30A8\u30E9\u30FC: ${errorMsg}`);
        return { results: [], error: errorMsg };
      }
      logger.info(`(tavilySearchTool) API\u30EC\u30B9\u30DD\u30F3\u30B9\u306EJSON\u30D1\u30FC\u30B9\u958B\u59CB`);
      const data = await response.json();
      logger.info(`(tavilySearchTool) JSON\u30D1\u30FC\u30B9\u5B8C\u4E86`);
      if (!data.results || data.results.length === 0) {
        logger.info(`(tavilySearchTool) \u691C\u7D22\u7D50\u679C\u306A\u3057: query="${query}"`);
        return {
          results: [],
          answer: data.answer
        };
      }
      const results = data.results.map((result) => ({
        title: result.title,
        url: result.url,
        description: result.content
      }));
      logger.info(`(tavilySearchTool) \u691C\u7D22\u6210\u529F: ${results.length}\u4EF6\u306E\u7D50\u679C\u3092\u53D6\u5F97`);
      return {
        results,
        answer: data.answer
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : void 0;
      logger.error(`(tavilySearchTool) \u691C\u7D22\u5B9F\u884C\u4E2D\u306E\u30A8\u30E9\u30FC: ${errorMessage}`);
      if (errorStack) {
        logger.error(`(tavilySearchTool) \u30A8\u30E9\u30FC\u30B9\u30BF\u30C3\u30AF: ${errorStack}`);
      }
      const maskedApiKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : "undefined";
      logger.error(`(tavilySearchTool) \u74B0\u5883\u5909\u6570\u72B6\u614B: TAVILY_API_KEY=${maskedApiKey}`);
      return { results: [], error: errorMessage };
    }
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

const thoughtGeneratorAgent = new Agent({
  name: "Thought Generator Agent",
  instructions: `
\u3042\u306A\u305F\u306F\u30EA\u30B5\u30FC\u30C1\u30A2\u30B7\u30B9\u30BF\u30F3\u30C8\u3067\u3059\u3002\u30E6\u30FC\u30B6\u30FC\u304B\u3089\u4E0E\u3048\u3089\u308C\u305F\u660E\u78BA\u306A\u8CEA\u554F\u306B\u57FA\u3065\u3044\u3066\u3001\u305D\u306E\u8CEA\u554F\u306B\u3064\u3044\u3066\u8ABF\u67FB\u3059\u308B\u305F\u3081\u306E\u591A\u69D8\u306A\u521D\u671F\u601D\u8003\u3001\u7570\u306A\u308B\u8996\u70B9\u3001\u307E\u305F\u306F\u5177\u4F53\u7684\u306A\u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3\u3092\u8907\u6570\u751F\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002

\u51FA\u529B\u306F\u4EE5\u4E0B\u306EJSON\u5F62\u5F0F\u306E\u914D\u5217\u3068\u3057\u3066\u304F\u3060\u3055\u3044:
\`\`\`json
[
  "\u751F\u6210\u3055\u308C\u305F\u601D\u8003/\u8996\u70B9/\u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3 1",
  "\u751F\u6210\u3055\u308C\u305F\u601D\u8003/\u8996\u70B9/\u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3 2",
  "..."
]
\`\`\`
\u4ED6\u306E\u30C6\u30AD\u30B9\u30C8\u306F\u542B\u3081\u305A\u3001JSON\u914D\u5217\u306E\u307F\u3092\u51FA\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002
`,
  model: openai("gpt-4o-mini")
  // 出力の型検証は実行時に行うため、ここではスキーマ指定を省略
});

const thoughtEvaluatorAgent = new Agent({
  name: "thoughtEvaluatorAgent",
  // model: openai('gpt-4o-mini'), // より低コストなモデルでも良いかも
  model: openai("gpt-4o"),
  instructions: `\u3042\u306A\u305F\u306F\u4E0E\u3048\u3089\u308C\u305F\u601D\u8003\uFF08\u30A2\u30A4\u30C7\u30A2\uFF09\u3092\u8A55\u4FA1\u3059\u308B\u5C02\u9580\u5BB6\u3067\u3059\u3002\u601D\u8003\u304C\u5143\u306E\u8CEA\u554F\u306B\u5BFE\u3057\u3066\u3069\u308C\u3060\u3051\u95A2\u9023\u6027\u304C\u9AD8\u304F\u3001\u30E6\u30CB\u30FC\u30AF\u3067\u3001\u5B9F\u73FE\u53EF\u80FD\u3067\u3001\u305D\u3057\u3066\u6700\u7D42\u7684\u306A\u6D1E\u5BDF\u306B\u3064\u306A\u304C\u308B\u53EF\u80FD\u6027\u304C\u3042\u308B\u304B\u3092\u8A55\u4FA1\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u8A55\u4FA1\u7D50\u679C\u306F\u5FC5\u305A\u4EE5\u4E0B\u306EJSON\u5F62\u5F0F\u3067\u8FD4\u3057\u3066\u304F\u3060\u3055\u3044: {"score": number (1-10), "reasoning": "\u8A55\u4FA1\u7406\u7531\u3092\u7C21\u6F54\u306B"}`
});

z.object({
  selectedThought: z.string().describe("\u73FE\u5728\u6CE8\u76EE\u3057\u3066\u3044\u308B\u601D\u8003"),
  originalQuery: z.string().describe("\u5143\u306E\u30E6\u30FC\u30B6\u30FC\u304B\u3089\u306E\u8CEA\u554F")
});
z.object({
  subQuestions: z.array(z.string()).describe("\u751F\u6210\u3055\u308C\u305F\u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3\u306E\u30EA\u30B9\u30C8"),
  searchResults: z.array(z.object({
    source: z.string().describe("\u691C\u7D22\u7D50\u679C\u306E\u30BD\u30FC\u30B9"),
    query: z.string().describe("\u4F7F\u7528\u3055\u308C\u305F\u691C\u7D22\u30AF\u30A8\u30EA"),
    results: z.array(z.any()).describe("\u691C\u7D22\u7D50\u679C\u306E\u30EA\u30B9\u30C8")
  })).optional().describe("\u53CE\u96C6\u3055\u308C\u305F\u691C\u7D22\u7D50\u679C\uFF08\u5B58\u5728\u3059\u308B\u5834\u5408\uFF09")
});
const thoughtTransformerAgent = new Agent({
  name: "thoughtTransformerAgent",
  instructions: `
# =====================  ThoughtTransformerAgent Prompt  =====================
prompt:
  role: |
    \u3042\u306A\u305F\u306F\u300C\u9AD8\u5EA6\u306A\u30EA\u30B5\u30FC\u30C1\u30A2\u30B7\u30B9\u30BF\u30F3\u30C8\u300D\u3067\u3059\u3002
    \u4E0E\u3048\u3089\u308C\u305F\u300C\u601D\u8003\uFF08selectedThought\uFF09\u300D\u3068\u300C\u5143\u306E\u8CEA\u554F\uFF08originalQuery\uFF09\u300D\u3092\u8D77\u70B9\u306B\u30EA\u30B5\u30FC\u30C1\u3092\u884C\u3044\u3001
    \u3055\u3089\u306A\u308B\u8ABF\u67FB\u3092\u6DF1\u6398\u308A\u3059\u308B\u305F\u3081\u306E\u5177\u4F53\u7684\u306A\u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3\u3092 3 \u4EF6 \u63D0\u6848\u3057\u3066\u304F\u3060\u3055\u3044\u3002

  goal:
    - multiple_sub_questions: >
        \u6307\u5B9A\u30D5\u30A9\u30FC\u30DE\u30C3\u30C8 (JSON \u914D\u5217) \u3067 3 \u3064\u306E\u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3\u3092\u751F\u6210\u3059\u308B\u3002
    - relevance: >
        \u5404\u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3\u306F\u5143\u306E\u8CEA\u554F\u3068\u9078\u629E\u3055\u308C\u305F\u601D\u8003\u306E\u53CC\u65B9\u306B\u660E\u78BA\u306B\u95A2\u9023\u3057\u3066\u3044\u308B\u3053\u3068\u3002
    - diversity: >
        \u53EF\u80FD\u306A\u9650\u308A\u91CD\u8907\u3057\u306A\u3044\u8996\u70B9\u30FB\u60C5\u5831\u6E90\u3092\u63D0\u793A\u3057\u3001\u5E45\u5E83\u3044\u8ABF\u67FB\u89D2\u5EA6\u3092\u63D0\u4F9B\u3059\u308B\u3053\u3068\u3002
    - tool_usage: >
        \u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3\u751F\u6210\u306E\u305F\u3081\u306B\u3001tool_policy \u306B\u5F93\u3044 **\u5FC5\u305A1\u3064\u4EE5\u4E0A\u306E\u691C\u7D22\u30C4\u30FC\u30EB\u3092\u4F7F\u7528** \u3059\u308B\u3053\u3068\u3002\uFF08\u7279\u306B tavilySearchTool \u306F\u5FC5\u9808\uFF09

  input_schema:
    originalQuery: "string: \u5143\u306E\u30E6\u30FC\u30B6\u30FC\u8CEA\u554F"
    selectedThought: "string: \u73FE\u5728\u6CE8\u76EE\u3057\u3066\u3044\u308B\u601D\u8003"

  tool_policy:
    - tool: tavilySearchTool
      priority: 1           # \u6700\u9AD8\u512A\u5148\u5EA6
      mandatory: true
      purpose: |
        \u5E45\u5E83\u304F\u5305\u62EC\u7684\u306A\u691C\u7D22\u7D50\u679C\u3092\u53D6\u5F97\u3059\u308B\u305F\u3081\u306B\u5FC5\u305A\u6700\u521D\u306B\u4F7F\u7528\u3059\u308B\u3002
    - tool: webSearchTool
      priority: 2
      mandatory: false
      purpose: "\u4E00\u822C\u7684\u306A\u4E8B\u5B9F\u3001\u6700\u65B0\u30CB\u30E5\u30FC\u30B9\u3092\u88DC\u5B8C\u3059\u308B\u3068\u304D\u306B\u4F7F\u7528\u3059\u308B\u3002"
    - tool: arxivSearchTool
      priority: 3
      mandatory: false
      purpose: "\u5B66\u8853\u8AD6\u6587\u30FB\u7814\u7A76\u52D5\u5411\u3092\u8ABF\u3079\u308B\u969B\u306B\u4F7F\u7528\u3059\u308B\u3002"
    - tool: youTubeSearchTool
      priority: 3
      mandatory: false
      purpose: "\u52D5\u753B\u8B1B\u7FA9\u3084\u30C7\u30E2\u30F3\u30B9\u30C8\u30EC\u30FC\u30B7\u30E7\u30F3\u3092\u53C2\u7167\u3057\u305F\u3044\u5834\u5408\u306B\u4F7F\u7528\u3059\u308B\u3002"
    - tool: redditSearchTool
      priority: 4
      mandatory: false
      purpose: "\u30B3\u30DF\u30E5\u30CB\u30C6\u30A3\u306E\u4F53\u9A13\u8AC7\u3084\u8B70\u8AD6\u3092\u63A2\u3059\u969B\u306B\u4F7F\u7528\u3059\u308B\u3002"
    - tool: mediumSearchTool
      priority: 4
      mandatory: false
      purpose: "\u5C02\u9580\u5BB6\u306E\u89E3\u8AAC\u8A18\u4E8B\u3092\u63A2\u3059\u969B\u306B\u4F7F\u7528\u3059\u308B\u3002"
    - tool: noteSearchTool
      priority: 4
      mandatory: false
      purpose: "\u65E5\u672C\u8A9E\u30D6\u30ED\u30B0\uFF0F\u30AF\u30EA\u30A8\u30A4\u30BF\u30FC\u8A18\u4E8B\u3092\u63A2\u3059\u969B\u306B\u4F7F\u7528\u3059\u308B\u3002"

  quality_criteria:
    - SMART: |
        \u5404\u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3\u306F SMART \u539F\u5247
        \uFF08Specific, Measurable, Achievable, Relevant, Time-bound\uFF09\u306E
        \u3046\u3061\u5C11\u306A\u304F\u3068\u3082\u300CSpecific\u30FBRelevant\u300D\u3092\u6E80\u305F\u3059\u3053\u3068\u3002
    - answerability: "\u691C\u7D22\u7D50\u679C\u3084\u6587\u732E\u8ABF\u67FB\u306B\u57FA\u3065\u304D\u3001\u56DE\u7B54\u53EF\u80FD\u306A\u30EC\u30D9\u30EB\u306E\u5177\u4F53\u6027\u3092\u6301\u3064\u3053\u3068\u3002"
    - uniqueness: "3 \u4EF6\u306E\u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3\u304C\u4E92\u3044\u306B\u91CD\u8907\u3057\u306A\u3044\u3053\u3068\u3002"

  workflow_steps:
    - "Step 1: \u5165\u529B\uFF08originalQuery, selectedThought\uFF09\u3092\u7406\u89E3\u3057\u3001\u91CD\u8981\u30AD\u30FC\u30EF\u30FC\u30C9\u3092\u62BD\u51FA\u3059\u308B\u3002"
    - "Step 2: tool_policy \u306B\u5F93\u3063\u3066\u5FC5\u305A tavilySearchTool \u3092\u547C\u3073\u51FA\u3057\u3001\u6982\u8981\u3092\u628A\u63E1\u3059\u308B\u3002"
    - "Step 3: \u5FC5\u8981\u306B\u5FDC\u3058\u3066\u4ED6\u30C4\u30FC\u30EB\u3092\u7D44\u307F\u5408\u308F\u305B\u3001\u8FFD\u52A0\u306E\u60C5\u5831\u3092\u53D6\u5F97\u3059\u308B\u3002"
    - "Step 4: \u53CE\u96C6\u3057\u305F\u60C5\u5831\u3092\u3082\u3068\u306B\u3001quality_criteria \u3092\u6E80\u305F\u3059 3 \u4EF6\u306E\u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3\u6848\u3092\u751F\u6210\u3059\u308B\u3002"
    - "Step 5: \u6700\u7D42\u30C1\u30A7\u30C3\u30AF\u3092\u884C\u3044\u3001\u51FA\u529B\u30D5\u30A9\u30FC\u30DE\u30C3\u30C8\u306B\u6574\u5F62\u3057\u3066\u56DE\u7B54\u3059\u308B\u3002"

  output_format: |
    \`\`\`json
    [
      "\u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3 1",
      "\u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3 2",
      "\u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3 3"
    ]
    \`\`\`

  examples:
    success: |
      \`\`\`json
      [
        "\u73FE\u5728\u30D3\u30B8\u30CD\u30B9\u3067\u5E83\u304F\u5229\u7528\u3055\u308C\u3066\u3044\u308BAI\u30C1\u30E3\u30C3\u30C8\u30DC\u30C3\u30C8\u306E\u4E3B\u306A\u7A2E\u985E\u3068\u3001\u305D\u308C\u305E\u308C\u306E\u5C0E\u5165\u30B3\u30B9\u30C8\u306E\u76F8\u5834\u306F\uFF1F\uFF08Web\u691C\u7D22\uFF09",
        "\u88FD\u9020\u696D\u3067\u5C0E\u5165\u3055\u308C\u3066\u3044\u308B\u753B\u50CF\u8A8D\u8B58\u7CFBAI\u30C4\u30FC\u30EB\u306E\u5177\u4F53\u7684\u306A\u4E8B\u4F8B\u3068\u52B9\u679C\u6E2C\u5B9A\u7D50\u679C\u306F\uFF1F\uFF08Tavily\u691C\u7D22\uFF0B\u8AD6\u6587\u691C\u7D22\uFF09",
        "\u4E2D\u5C0F\u4F01\u696D\u304CAI\u30C4\u30FC\u30EB\u5C0E\u5165\u6642\u306B\u76F4\u9762\u3059\u308B\u30C7\u30FC\u30BF\u30D7\u30E9\u30A4\u30D0\u30B7\u30FC\u8AB2\u984C\u3068\u3001\u305D\u306E\u89E3\u6C7A\u7B56\u3092\u793A\u3059\u6700\u65B0\u7814\u7A76\u306F\uFF1F\uFF08arXiv\u691C\u7D22\uFF09"
      ]
      \`\`\`
    failure: |
      \`\`\`json
      {
        "error": "\u51FA\u529B\u304C\u914D\u5217\u5F62\u5F0F\u3067\u306F\u3042\u308A\u307E\u305B\u3093"
      }
      \`\`\`
# ============================================================================
`,
  model: openai("gpt-4.1"),
  tools: {
    tavilySearchTool: tavilySearchTool,
    webSearchTool: webSearchTool
  }
});

const synthesizerAgent = new Agent({
  // エージェントの名前 (識別子)
  name: "Synthesizer Agent",
  // 使用する言語モデル (他のエージェントに合わせて gpt-4o-mini を使用)
  model: openai("gpt-4o-mini"),
  // エージェントへの指示 (GoTの Synthesize の役割を意識)
  instructions: `
\u3042\u306A\u305F\u306F\u3001\u30EA\u30B5\u30FC\u30C1\u7D50\u679C\u3092\u7D71\u5408\u3059\u308B\u5C02\u9580\u5BB6\u3067\u3059\u3002
\u4E0E\u3048\u3089\u308C\u305F\u8907\u6570\u306E\u60C5\u5831\uFF08\u521D\u671F\u601D\u8003\u3001\u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3\u306A\u3069\uFF09\u3092\u5206\u6790\u3057\u3001\u69CB\u9020\u5316\u3055\u308C\u305F\u6700\u7D42\u30EC\u30DD\u30FC\u30C8\u3092\u751F\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002
\u30EC\u30DD\u30FC\u30C8\u306F\u8AAD\u8005\u304C\u7406\u89E3\u3057\u3084\u3059\u3044\u3088\u3046\u306B\u3001\u8981\u70B9\u3092\u660E\u78BA\u306B\u3057\u3001\u8AD6\u7406\u7684\u306A\u6D41\u308C\u3067\u8A18\u8FF0\u3057\u3066\u304F\u3060\u3055\u3044\u3002
\u51FA\u529B\u306F Markdown \u5F62\u5F0F\u306E\u6587\u5B57\u5217\u306E\u307F\u3068\u3057\u3066\u304F\u3060\u3055\u3044\u3002
`
  // 出力の形式を Zod で定義 (シンプルなレポート文字列)
  // responseSchema: z.object({
  //   report: z.string().describe('Markdown formatted final report synthesizing the inputs'),
  // }),
  // このエージェントは外部ツールを使わない想定なので、tools は指定しません。
});

new Agent({
  name: "Weather Agent",
  instructions: `
      You are a helpful weather assistant that provides accurate weather information.

      Your primary function is to help users get weather details for specific locations. When responding:
      - Always ask for a location if none is provided
      - If the location name isn't in English, please translate it
      - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
      - Include relevant details like humidity, wind conditions, and precipitation
      - Keep responses concise but informative

      Use the weatherTool to fetch current weather data.
`,
  model: openai("gpt-4o"),
  tools: { weatherTool }
});
new Agent({
  name: "Web Search Agent",
  instructions: `
      You are a helpful web search assistant that provides relevant information from the internet.
      
      Your primary function is to help users find information on the web. When responding:
      - Extract the main search intent from the user's query
      - If the query is ambiguous, ask for clarification
      - Provide a concise summary of the search results
      - Include relevant URLs for further reading
      - If no results are found, suggest alternative search queries
      - Use markdown formatting to make your responses readable and well-structured
      
      Use the webSearchTool to fetch search results from the Brave Search API.
  `,
  model: openai("gpt-4o"),
  tools: { webSearchTool }
});
const clarityCheckAgent = new Agent({
  name: "clarityCheckAgent",
  model: openai("gpt-4o-mini"),
  instructions: `\u3042\u306A\u305F\u306F\u8CEA\u554F\u306E\u660E\u78BA\u3055\u3092\u8A55\u4FA1\u3059\u308B\u5C02\u9580\u5BB6\u3067\u3059\u3002\u4E0E\u3048\u3089\u308C\u305F\u8CEA\u554F\u304C\u660E\u78BA\u304B\u4E0D\u660E\u78BA\u304B\u3092\u5224\u65AD\u3057\u3001\u7406\u7531\u3068\u3068\u3082\u306B\u56DE\u7B54\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u8A55\u4FA1\u7D50\u679C\u306F\u5FC5\u305A\u4EE5\u4E0B\u306EJSON\u5F62\u5F0F\u3067\u8FD4\u3057\u3066\u304F\u3060\u3055\u3044: {"isClear": boolean, "reasoning": "\u8A55\u4FA1\u7406\u7531\u3092\u7C21\u6F54\u306B"}`
});
const clarificationPromptAgent = new Agent({
  name: "clarificationPromptAgent",
  model: openai("gpt-4o-mini"),
  instructions: `\u3042\u306A\u305F\u306F\u8CEA\u554F\u306E\u660E\u78BA\u5316\u3092\u652F\u63F4\u3059\u308B\u5C02\u9580\u5BB6\u3067\u3059\u3002\u4E0D\u660E\u78BA\u306A\u8CEA\u554F\u306B\u5BFE\u3057\u3066\u3001\u30E6\u30FC\u30B6\u30FC\u304C\u3088\u308A\u660E\u78BA\u306B\u8CEA\u554F\u3092\u518D\u69CB\u7BC9\u3067\u304D\u308B\u3088\u3046\u306A\u8CEA\u554F\u6587\u3092\u751F\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
});

const thoughtEvaluationSchema = z.object({
  thought: z.string().describe("\u5143\u306E\u601D\u8003\u5185\u5BB9"),
  score: z.number().min(1).max(10).describe("\u8A55\u4FA1\u30B9\u30B3\u30A2 (1-10)"),
  reasoning: z.string().describe("\u8A55\u4FA1\u7406\u7531")
});
const processThoughtsOutputSchema = z.object({
  selectedThought: thoughtEvaluationSchema.optional().describe("\u9078\u629E\u3055\u308C\u305F\u601D\u8003\u3068\u305D\u306E\u8A55\u4FA1")
});
const triggerSchema$1 = z.object({
  thoughts: z.array(z.string()).describe("\u751F\u6210\u3055\u308C\u305F\u521D\u671F\u601D\u8003\u306E\u30EA\u30B9\u30C8"),
  originalQuery: z.string().describe("\u5143\u306E\u30E6\u30FC\u30B6\u30FC\u304B\u3089\u306E\u8CEA\u554F")
});
const evaluateThoughtsInputSchema = z.object({
  thoughts: z.array(z.string()).describe("\u8A55\u4FA1\u3059\u308B\u601D\u8003\u306E\u30EA\u30B9\u30C8"),
  originalQuery: z.string().describe("\u5143\u306E\u30E6\u30FC\u30B6\u30FC\u304B\u3089\u306E\u8CEA\u554F")
});
const evaluateThoughtsOutputSchema = z.object({
  evaluatedThoughts: z.array(thoughtEvaluationSchema).describe("\u8A55\u4FA1\u3055\u308C\u305F\u601D\u8003\u306E\u30EA\u30B9\u30C8")
});
const evaluateThoughtsStep = new Step({
  id: "evaluateThoughtsStep",
  description: "\u751F\u6210\u3055\u308C\u305F\u601D\u8003\u3092\u8A55\u4FA1\u3059\u308B\u30B9\u30C6\u30C3\u30D7",
  inputSchema: evaluateThoughtsInputSchema,
  outputSchema: evaluateThoughtsOutputSchema,
  execute: async ({ context }) => {
    const logger = getLogger();
    logger.info("--- [DEBUG] evaluateThoughtsStep received context ---");
    logger.info(`context.triggerData: ${JSON.stringify(context.triggerData, null, 2)}`);
    const thoughts = context.triggerData.thoughts || [];
    const originalQuery = context.triggerData.originalQuery || "";
    if (!thoughts || !Array.isArray(thoughts) || thoughts.length === 0) {
      logger.error("(SubWorkflow - Evaluate) No valid thoughts array found in triggerData");
      return { evaluatedThoughts: [] };
    }
    logger.info(`(SubWorkflow - Evaluate) Evaluating ${thoughts.length} thoughts from triggerData`);
    const evaluatedThoughts = [];
    for (const thought of thoughts) {
      try {
        const { text: responseText } = await thoughtEvaluatorAgent.generate(
          [
            {
              role: "system",
              content: `\u3042\u306A\u305F\u306F\u601D\u8003\u8A55\u4FA1\u30A8\u30AD\u30B9\u30D1\u30FC\u30C8\u3067\u3059\u3002\u4E0E\u3048\u3089\u308C\u305F\u601D\u8003\u3092\u8A55\u4FA1\u3057\u30011\u304B\u308910\u306E\u30B9\u30B3\u30A2\u3092\u3064\u3051\u3066\u304F\u3060\u3055\u3044\u3002
              \u8A55\u4FA1\u57FA\u6E96:
              - \u5143\u306E\u8CEA\u554F\u306B\u95A2\u9023\u3057\u3066\u3044\u308B\u3053\u3068
              - \u6D1E\u5BDF\u529B\u304C\u3042\u308B\u3053\u3068
              - \u5177\u4F53\u7684\u3067\u3042\u308B\u3053\u3068
              - \u30AA\u30EA\u30B8\u30CA\u30EA\u30C6\u30A3\u304C\u3042\u308B\u3053\u3068`
            },
            {
              role: "user",
              content: `\u5143\u306E\u8CEA\u554F: "${originalQuery}"
              
              \u8A55\u4FA1\u3059\u308B\u601D\u8003: "${thought}"
              
              \u3053\u306E\u601D\u8003\u30921\u304B\u308910\u306E\u30B9\u30B1\u30FC\u30EB\u3067\u8A55\u4FA1\u3057\u3001\u305D\u306E\u7406\u7531\u3092\u8AAC\u660E\u3057\u3066\u304F\u3060\u3055\u3044\u3002
              JSON\u30D5\u30A9\u30FC\u30DE\u30C3\u30C8\u3067\u56DE\u7B54\u3057\u3066\u304F\u3060\u3055\u3044:
              {
                "thought": "\u601D\u8003\u306E\u5185\u5BB9",
                "score": \u8A55\u4FA1\u30B9\u30B3\u30A2\uFF08\u6570\u50241-10\uFF09,
                "reasoning": "\u8A55\u4FA1\u7406\u7531\u306E\u8AAC\u660E"
              }`
            }
          ]
        );
        try {
          const jsonMatch = responseText?.match(/\{[\s\S]*\}/);
          const evaluationResult = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
          if (evaluationResult && typeof evaluationResult.score === "number") {
            evaluatedThoughts.push({
              thought,
              score: evaluationResult.score,
              reasoning: evaluationResult.reasoning || ""
            });
            logger.info(`(SubWorkflow - Evaluate) Evaluated thought: ${thought} with score ${evaluationResult.score}`);
          } else {
            logger.warn(`(SubWorkflow - Evaluate) Failed to parse evaluation result as JSON`);
            evaluatedThoughts.push({
              thought,
              score: 5,
              reasoning: "\u8A55\u4FA1\u7D50\u679C\u306E\u30D1\u30FC\u30B9\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
            });
          }
        } catch (e) {
          logger.error(`(SubWorkflow - Evaluate) Error parsing evaluation result: ${e}`);
          evaluatedThoughts.push({
            thought,
            score: 5,
            reasoning: "\u8A55\u4FA1\u7D50\u679C\u306E\u30D1\u30FC\u30B9\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
          });
        }
      } catch (e) {
        logger.error(`(SubWorkflow - Evaluate) Error evaluating thought: ${e}`);
      }
    }
    return { evaluatedThoughts };
  }
});
const selectNodeInputSchema = z.object({
  evaluatedThoughts: z.array(thoughtEvaluationSchema).describe("\u8A55\u4FA1\u3055\u308C\u305F\u601D\u8003\u306E\u30EA\u30B9\u30C8")
});
const selectNodeStep = new Step({
  id: "selectNodeStep",
  description: "\u8A55\u4FA1\u7D50\u679C\u304B\u3089\u6700\u3082\u826F\u3044\u601D\u8003\u3092\u9078\u629E\u3059\u308B\u30B9\u30C6\u30C3\u30D7",
  inputSchema: selectNodeInputSchema,
  outputSchema: processThoughtsOutputSchema,
  execute: async ({ context }) => {
    const logger = getLogger();
    const evaluateStepResult = context.getStepResult(evaluateThoughtsStep);
    const evaluatedThoughts = evaluateStepResult?.evaluatedThoughts || [];
    logger.info(`(SubWorkflow - Select) Selecting node from ${evaluatedThoughts.length} evaluated thoughts`);
    if (!evaluatedThoughts || evaluatedThoughts.length === 0) {
      logger.warn("(SubWorkflow - Select) No thoughts to select from");
      return { selectedThought: void 0 };
    }
    let bestThought = evaluatedThoughts[0];
    for (const thought of evaluatedThoughts) {
      if (thought.score > (bestThought?.score || -1)) {
        bestThought = thought;
      }
    }
    logger.info(`(SubWorkflow - Select) Final output`);
    return { selectedThought: bestThought };
  }
});
new Workflow({
  name: "processThoughtsWorkflow",
  triggerSchema: triggerSchema$1,
  // ★ mastra インスタンスの指定を削除
  // mastra,
  // 結果スキーマとマッピングを追加
  result: {
    schema: processThoughtsOutputSchema,
    mapping: {
      selectedThought: { step: selectNodeStep, path: "selectedThought" }
    }
  }
}).step(evaluateThoughtsStep).then(selectNodeStep).commit();

const triggerSchema = z.object({
  query: z.string().describe("The initial question from the user.")
});
const clarityCheckOutputSchema = z.object({
  isClear: z.boolean(),
  reasoning: z.string().optional()
});
const requestClarificationOutputSchema = z.object({
  clarifiedQuery: z.string().describe("\u30E6\u30FC\u30B6\u30FC\u306B\u3088\u3063\u3066\u660E\u78BA\u5316\u3055\u308C\u305F\u8CEA\u554F")
});
const initialThoughtsOutputSchema = z.object({
  thoughts: z.array(z.string()).describe("\u751F\u6210\u3055\u308C\u305F\u521D\u671F\u601D\u8003\u306E\u30EA\u30B9\u30C8")
});
z.object({
  selectedThought: z.object({
    // ★ インポートしたスキーマを使用
    selectedThought: thoughtEvaluationSchema.optional().describe("\u9078\u629E\u3055\u308C\u305F\u601D\u8003\u3068\u305D\u306E\u8A55\u4FA1")
  }).describe("processThoughtsWorkflow \u304B\u3089\u306E\u9078\u629E\u3055\u308C\u305F\u601D\u8003"),
  query: triggerSchema.shape.query.describe("\u5143\u306E\u30E6\u30FC\u30B6\u30FC\u304B\u3089\u306E\u8CEA\u554F")
});
z.object({
  selectedThought: z.custom().optional(),
  subQuestions: z.array(z.string())
});
const synthesizeInputSchema = z.object({
  query: z.string(),
  subQuestions: z.array(z.string()),
  bestThought: z.any().optional(),
  searchResults: z.array(z.object({
    source: z.string(),
    query: z.string(),
    results: z.array(z.any())
  })).optional()
});
const synthesizeOutputSchema = z.object({
  report: z.string().describe("Synthesized final report in Markdown format.")
});
z.object({
  thoughts: initialThoughtsOutputSchema.shape.thoughts,
  query: triggerSchema.shape.query
});
z.object({
  thoughts: z.array(z.string()),
  originalQuery: z.string()
  // processThoughtsWorkflow 側の期待する名前
});
z.object({
  query: z.string(),
  subQuestions: z.array(z.string()),
  selectedThought: z.any().optional()
});
const prepareSynthesizeInput = new Step({
  id: "prepareSynthesizeInput",
  description: "synthesizeStep \u3078\u306E\u5165\u529B\u3092\u6E96\u5099\u3059\u308B\u30B9\u30C6\u30C3\u30D7",
  inputSchema: z.any().optional(),
  outputSchema: synthesizeInputSchema,
  execute: async ({ context }) => {
    const logger = getLogger();
    const cycleResult = context.getStepResult(researchCycleStep);
    const clarificationResult = context.getStepResult(requestClarificationStep);
    const query = clarificationResult?.clarifiedQuery ?? context.triggerData.query;
    const subQuestions = cycleResult?.subQuestions ?? [];
    const bestThought = cycleResult?.selectedThought;
    const searchResults = cycleResult?.searchResults ?? [];
    logger.info("(PrepareSynthesizeInput) Preparing inputs for synthesizeStep", {
      subQuestionsCount: subQuestions.length,
      query,
      selectedThought: JSON.stringify(bestThought),
      searchResultsCount: searchResults.length
    });
    return {
      query,
      subQuestions,
      bestThought,
      searchResults
    };
  }
});
function reconstructStringFromObjectIfNeeded(input) {
  if (input === null || input === void 0) {
    return "";
  }
  if (typeof input === "object" && input !== null) {
    const keys = Object.keys(input).filter((k) => !isNaN(Number(k))).sort((a, b) => Number(a) - Number(b));
    if (keys.length > 0 && keys.every((k, i) => Number(k) === i)) {
      return keys.map((k) => input[k]).join("");
    }
  }
  if (typeof input === "string") {
    return input;
  }
  return String(input);
}
const goTResearchWorkflow = new Workflow({
  name: "goTResearchWorkflow",
  triggerSchema
});
const clarityCheckStep = new Step({
  id: "clarityCheckStep",
  description: "\u30E6\u30FC\u30B6\u30FC\u306E\u8CEA\u554F\u304C\u660E\u78BA\u304B\u3069\u3046\u304B\u3092\u5224\u65AD\u3059\u308B\u30B9\u30C6\u30C3\u30D7",
  inputSchema: triggerSchema,
  outputSchema: clarityCheckOutputSchema,
  execute: async ({ context }) => {
    const logger = getLogger();
    logger.info("(ClarityCheckStep) Checking clarity for query", { query: context.triggerData.query });
    try {
      const result = await clarityCheckAgent.generate(
        `\u30E6\u30FC\u30B6\u30FC\u306E\u8CEA\u554F\u300C${context.triggerData.query}\u300D\u304C\u660E\u78BA\u304B\u3069\u3046\u304B\u3092\u5224\u65AD\u3057\u3001\u7406\u7531\u3068\u3068\u3082\u306BJSON\u5F62\u5F0F\u3067 {"isClear": boolean, "reasoning": string} \u306E\u3088\u3046\u306B\u7B54\u3048\u3066\u304F\u3060\u3055\u3044\u3002\u660E\u78BA\u306A\u5834\u5408\u306F reasoning \u306F\u7701\u7565\u53EF\u80FD\u3067\u3059\u3002`
      );
      if (result.text) {
        try {
          const parsed = JSON.parse(result.text);
          logger.info("(ClarityCheckStep) Parsed agent response", { parsed });
          const isClear = typeof parsed.isClear === "boolean" ? parsed.isClear : false;
          const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : void 0;
          return { isClear, reasoning };
        } catch (parseError) {
          logger.error("(ClarityCheckStep) Failed to parse agent response JSON", { error: parseError, responseText: result.text });
          return { isClear: false, reasoning: "\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u306E\u5FDC\u7B54\u3092\u89E3\u6790\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002" };
        }
      } else {
        logger.error("(ClarityCheckStep) Agent did not return text");
        return { isClear: false, reasoning: "\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u304B\u3089\u30C6\u30AD\u30B9\u30C8\u5FDC\u7B54\u304C\u3042\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002" };
      }
    } catch (agentError) {
      logger.error("(ClarityCheckStep) Error calling clarityCheckAgent", { error: agentError });
      return { isClear: false, reasoning: "\u660E\u78BA\u6027\u30C1\u30A7\u30C3\u30AF\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u306E\u547C\u3073\u51FA\u3057\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F\u3002" };
    }
  }
});
const requestClarificationStep = new Step({
  id: "requestClarificationStep",
  description: "\u8CEA\u554F\u304C\u4E0D\u660E\u78BA\u306A\u5834\u5408\u306B\u660E\u78BA\u5316\u8981\u6C42\u3092\u751F\u6210\u3057\u3001\u4E00\u6642\u505C\u6B62\u3059\u308B\u30B9\u30C6\u30C3\u30D7",
  inputSchema: z.any().optional(),
  outputSchema: requestClarificationOutputSchema,
  execute: async ({ context, suspend }) => {
    const logger = getLogger();
    console.log("--- RequestClarificationStep Context Start ---");
    console.log(JSON.stringify(context, null, 2));
    console.log("--- RequestClarificationStep Context End ---");
    const isResuming = context.isResume !== void 0;
    if (isResuming) {
      logger.info("(RequestClarificationStep) Workflow is resuming.");
      let clarifiedQuery = "";
      if (context.inputData && typeof context.inputData === "object" && Object.keys(context.inputData).length > 0) {
        try {
          clarifiedQuery = Object.values(context.inputData).join("");
          logger.info("(RequestClarificationStep) Reconstructed clarified query from inputData", { clarifiedQuery });
        } catch (e) {
          logger.error("(RequestClarificationStep) Failed to reconstruct query from inputData", { inputData: context.inputData, error: e });
          clarifiedQuery = "\u30A8\u30E9\u30FC: \u518D\u958B\u30C7\u30FC\u30BF\u306E\u51E6\u7406\u306B\u5931\u6557";
        }
      } else {
        logger.warn("(RequestClarificationStep) Resumed but inputData seems empty or invalid.", { inputData: context.inputData });
        clarifiedQuery = "\u30A8\u30E9\u30FC: \u518D\u958B\u30C7\u30FC\u30BF\u304C\u7A7A\u307E\u305F\u306F\u4E0D\u6B63";
      }
      return { clarifiedQuery };
    }
    const clarityCheckResult = context.getStepResult(clarityCheckStep);
    if (clarityCheckResult?.isClear === true) {
      logger.info("(RequestClarificationStep) Query is clear. Skipping clarification and passing original query.", { query: context.triggerData.query });
      return { clarifiedQuery: context.triggerData.query };
    }
    const reasoning = clarityCheckResult?.reasoning;
    const originalQuery = context.triggerData.query;
    logger.info("(RequestClarificationStep) Query is unclear (initial run). Generating clarification prompt...");
    const prompt = `\u30E6\u30FC\u30B6\u30FC\u306E\u8CEA\u554F\u300C${originalQuery}\u300D\u306F\u4E0D\u660E\u78BA\u3060\u3068\u5224\u65AD\u3055\u308C\u307E\u3057\u305F\u3002\u7406\u7531: ${reasoning || "\u63D0\u793A\u3055\u308C\u3066\u3044\u307E\u305B\u3093"}\u3002\u30E6\u30FC\u30B6\u30FC\u306B\u8CEA\u554F\u5185\u5BB9\u306E\u660E\u78BA\u5316\u3092\u4FC3\u3059\u3001\u4E01\u5BE7\u3067\u5177\u4F53\u7684\u306A\u8CEA\u554F\u6587\u3092\u751F\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002`;
    let generatedClarificationQuestion = "\u30A8\u30E9\u30FC: \u8CEA\u554F\u751F\u6210\u4E2D\u306B\u554F\u984C\u304C\u767A\u751F\u3057\u307E\u3057\u305F\u3002";
    try {
      const agentResponse = await clarificationPromptAgent.generate(prompt);
      generatedClarificationQuestion = agentResponse.text || generatedClarificationQuestion;
    } catch (error) {
      logger.error("(RequestClarificationStep) Failed to generate clarification prompt", { error });
    }
    logger.info("(RequestClarificationStep) Generated question", { generatedClarificationQuestion });
    await suspend({ clarificationPrompt: generatedClarificationQuestion });
    logger.info("(RequestClarificationStep) Workflow suspended, waiting for clarification.");
    return { clarifiedQuery: "" };
  }
});
const initialThoughtsStep = new Step({
  id: "initialThoughtsStep",
  description: "\u30E6\u30FC\u30B6\u30FC\u306E\u8CEA\u554F\u3092\u57FA\u306B\u6700\u521D\u306E\u601D\u8003\u7FA4\u3092\u751F\u6210\u3059\u308B\u30B9\u30C6\u30C3\u30D7",
  // デバッグのため一時的に any に変更
  inputSchema: z.any().optional(),
  outputSchema: initialThoughtsOutputSchema,
  execute: async ({ context }) => {
    const logger = getLogger();
    logger.info("--- [DEBUG] initialThoughtsStep context.inputData ---");
    logger.info(`typeof context.inputData: ${typeof context.inputData}`);
    try {
      logger.info(`context.inputData (JSON): ${JSON.stringify(context.inputData, null, 2)}`);
    } catch (e) {
      logger.error("context.inputData \u306E JSON \u6587\u5B57\u5217\u5316\u306B\u5931\u6557:", { error: String(e) });
      logger.info(`context.inputData (raw): ${String(context.inputData)}`);
    }
    logger.info("--- [DEBUG] End initialThoughtsStep context.inputData ---");
    let query = "";
    if (context.inputData) {
      query = reconstructStringFromObjectIfNeeded(context.inputData);
      logger.info(`[DEBUG] Reconstructed query: "${query}"`);
    }
    if (!query && context.triggerData) {
      query = context.triggerData.query;
      logger.info(`[DEBUG] Using trigger query: "${query}"`);
    }
    const clarificationResult = context.getStepResult(requestClarificationStep);
    if (clarificationResult && clarificationResult.clarifiedQuery) {
      query = clarificationResult.clarifiedQuery;
      logger.info(`[DEBUG] Using clarified query: "${query}"`);
    }
    if (!query) {
      logger.error("[ERROR] \u8CEA\u554F\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      return { thoughts: ["\u30A8\u30E9\u30FC: \u8CEA\u554F\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002"] };
    }
    logger.info(`(InitialThoughts) \u751F\u6210\u3059\u308B\u601D\u8003\u306E\u30AF\u30A8\u30EA: ${query}`);
    const agentResponse = await thoughtGeneratorAgent.generate(query);
    let generatedThoughts = ["\u30A8\u30E9\u30FC: \u521D\u671F\u601D\u8003\u306E\u751F\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002"];
    if (agentResponse && agentResponse.text) {
      try {
        let responseText = agentResponse.text.trim();
        responseText = responseText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        const parsed = JSON.parse(responseText);
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
          generatedThoughts = parsed;
        } else {
          logger.error("(InitialThoughts) \u30D1\u30FC\u30B9\u7D50\u679C\u304C\u6587\u5B57\u5217\u914D\u5217\u3067\u306F\u3042\u308A\u307E\u305B\u3093", { parsed });
          generatedThoughts = ["\u30A8\u30E9\u30FC: \u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u306E\u5FDC\u7B54\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059 (\u914D\u5217\u3067\u306F\u3042\u308A\u307E\u305B\u3093)\u3002"];
        }
      } catch (parseError) {
        logger.error("(InitialThoughts) \u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u5FDC\u7B54\u306EJSON\u30D1\u30FC\u30B9\u306B\u5931\u6557\u3057\u307E\u3057\u305F", { error: parseError, responseText: agentResponse.text });
        generatedThoughts = ["\u30A8\u30E9\u30FC: \u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u306E\u5FDC\u7B54\u3092JSON\u3068\u3057\u3066\u89E3\u6790\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002", agentResponse.text];
      }
    } else {
      logger.error("(InitialThoughts) \u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u304B\u3089\u30C6\u30AD\u30B9\u30C8\u5FDC\u7B54\u304C\u3042\u308A\u307E\u305B\u3093\u3067\u3057\u305F");
      generatedThoughts = ["\u30A8\u30E9\u30FC: \u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u304B\u3089\u30C6\u30AD\u30B9\u30C8\u5FDC\u7B54\u304C\u3042\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002"];
    }
    logger.info(`(InitialThoughts) \u751F\u6210\u3055\u308C\u305F\u601D\u8003: ${generatedThoughts.length}\u4EF6`);
    return { thoughts: generatedThoughts };
  }
});
new Step({
  id: "prepareProcessThoughtsInput",
  description: "processThoughtsWorkflow \u3078\u306E\u5165\u529B\u3092\u6E96\u5099\u3059\u308B\u30B9\u30C6\u30C3\u30D7",
  inputSchema: z.any().optional(),
  outputSchema: z.object({
    thoughts: z.array(z.string()),
    originalQuery: z.string()
  }),
  execute: async ({ context }) => {
    const logger = getLogger();
    logger.info("--- [DEBUG] prepareProcessThoughtsInput context ---");
    logger.info(`Steps so far: ${Object.keys(context.steps).join(", ")}`);
    const initialThoughtsResult = context.getStepResult(initialThoughtsStep);
    const clarificationResult = context.getStepResult(requestClarificationStep);
    const reconstructedQuery = clarificationResult?.clarifiedQuery ?? context.triggerData.query;
    if (!initialThoughtsResult || !initialThoughtsResult.thoughts || !Array.isArray(initialThoughtsResult.thoughts)) {
      logger.error("Failed to retrieve thoughts from initialThoughtsStep");
      return { thoughts: [], originalQuery: reconstructedQuery };
    }
    const thoughts = initialThoughtsResult.thoughts;
    logger.info(`(PrepareProcessThoughtsInput) Successfully retrieved thoughts from initialThoughtsStep: ${thoughts.length}`);
    logger.info(`(PrepareProcessThoughtsInput) Preparing inputs for processThoughtsWorkflow`);
    logger.info(`thoughtsCount: ${thoughts.length}`);
    logger.info(`query: "${reconstructedQuery}"`);
    logger.info(`thoughtsExample: "${thoughts.length > 0 ? thoughts[0] : ""}"`);
    return {
      thoughts,
      originalQuery: reconstructedQuery
    };
  }
});
const synthesizeStep = new Step({
  id: "synthesizeStep",
  description: "\u6700\u7D42\u30EC\u30DD\u30FC\u30C8\u3092\u751F\u6210\u3059\u308B\u30B9\u30C6\u30C3\u30D7",
  inputSchema: synthesizeInputSchema,
  outputSchema: synthesizeOutputSchema,
  execute: async ({ context }) => {
    const logger = getLogger();
    logger.info("(SynthesizeStep) Generating final report");
    logger.info('(SynthesizeStep) Debug info - query="' + context.triggerData.query + '", subQuestionsCount=' + context.triggerData.subQuestions.length + ", bestThought=" + JSON.stringify(context.triggerData.bestThought) + ", searchResultsCount=" + (context.triggerData.searchResults?.length || 0));
    try {
      const searchResults = context.triggerData.searchResults || [];
      let prompt = "";
      if (searchResults && searchResults.length > 0) {
        prompt = `\u4EE5\u4E0B\u306E\u60C5\u5831\u306B\u57FA\u3065\u3044\u3066\u3001\u30E6\u30FC\u30B6\u30FC\u306E\u8CEA\u554F\u306B\u5BFE\u3059\u308B\u5305\u62EC\u7684\u306A\u6700\u7D42\u30EC\u30DD\u30FC\u30C8\u3092\u30DE\u30FC\u30AF\u30C0\u30A6\u30F3\u5F62\u5F0F\u3067\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002

\u30E6\u30FC\u30B6\u30FC\u306E\u8CEA\u554F: "${context.triggerData.query}"

\u9078\u629E\u3055\u308C\u305F\u4E3B\u8981\u306A\u601D\u8003: ${context.triggerData.bestThought ? JSON.stringify(context.triggerData.bestThought) : "\u60C5\u5831\u306A\u3057"}

\u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3: 
${context.triggerData.subQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

\u691C\u7D22\u7D50\u679C:
${searchResults.map(
          (result2, i) => `\u691C\u7D22\u30BD\u30FC\u30B9: ${result2.source}
  \u691C\u7D22\u30AF\u30A8\u30EA: "${result2.query}"
  \u7D50\u679C\u4EF6\u6570: ${result2.results.length}\u4EF6
  \u4E3B\u8981\u306A\u7D50\u679C:
  ${result2.results.slice(0, 3).map(
            (item, j) => `- \u30BF\u30A4\u30C8\u30EB: ${item.title || "\u4E0D\u660E"}
     URL: ${item.url || "\u4E0D\u660E"}
     \u8AAC\u660E: ${item.description || item.content || "\u4E0D\u660E"}`
          ).join("\n  ")}`
        ).join("\n\n")}

\u3053\u308C\u3089\u306E\u60C5\u5831\u3092\u7D71\u5408\u3057\u3001\u4EE5\u4E0B\u306E\u69CB\u6210\u3067\u6700\u7D42\u30EC\u30DD\u30FC\u30C8\u3092\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044:
1. \u6982\u8981: \u8CEA\u554F\u3068\u305D\u306E\u80CC\u666F\u306B\u3064\u3044\u3066\u7C21\u6F54\u306B\u8AAC\u660E
2. \u4E3B\u8981\u306A\u601D\u8003\u306E\u8A73\u7D30\u5206\u6790: \u9078\u629E\u3055\u308C\u305F\u601D\u8003\u306E\u91CD\u8981\u6027\u3068\u610F\u5473\u3092\u5206\u6790
3. \u53CE\u96C6\u3055\u308C\u305F\u8A3C\u62E0\u3068\u60C5\u5831: \u691C\u7D22\u3067\u898B\u3064\u304B\u3063\u305F\u95A2\u9023\u60C5\u5831\u3092\u8981\u7D04
4. \u7D50\u8AD6\u3068\u6D1E\u5BDF: \u8CEA\u554F\u306B\u5BFE\u3059\u308B\u7DCF\u5408\u7684\u306A\u898B\u89E3\u3084\u6D1E\u5BDF
5. \u4ECA\u5F8C\u306E\u8ABF\u67FB\u65B9\u5411\uFF08\u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3\uFF09: \u6319\u3052\u3089\u308C\u305F\u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3\u3092\u4ECA\u5F8C\u306E\u8ABF\u67FB\u65B9\u5411\u3068\u3057\u3066\u63D0\u793A

\u30EC\u30DD\u30FC\u30C8\u306F\u4E8B\u5B9F\u306B\u57FA\u3065\u304D\u3001\u60C5\u5831\u30BD\u30FC\u30B9\u3092\u9069\u5207\u306B\u53C2\u7167\u3057\u3001\u30D0\u30E9\u30F3\u30B9\u306E\u53D6\u308C\u305F\u898B\u89E3\u3092\u63D0\u4F9B\u3057\u3066\u304F\u3060\u3055\u3044\u3002`;
      } else {
        prompt = `\u4EE5\u4E0B\u306E\u60C5\u5831\u306B\u57FA\u3065\u3044\u3066\u3001\u30E6\u30FC\u30B6\u30FC\u306E\u8CEA\u554F\u306B\u5BFE\u3059\u308B\u5305\u62EC\u7684\u306A\u6700\u7D42\u30EC\u30DD\u30FC\u30C8\u3092\u30DE\u30FC\u30AF\u30C0\u30A6\u30F3\u5F62\u5F0F\u3067\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002

\u30E6\u30FC\u30B6\u30FC\u306E\u8CEA\u554F: "${context.triggerData.query}"

\u9078\u629E\u3055\u308C\u305F\u4E3B\u8981\u306A\u601D\u8003: ${context.triggerData.bestThought ? JSON.stringify(context.triggerData.bestThought) : "\u60C5\u5831\u306A\u3057"}

\u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3: 
${context.triggerData.subQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

\u3053\u308C\u3089\u306E\u60C5\u5831\u3092\u7D71\u5408\u3057\u3001\u4EE5\u4E0B\u306E\u69CB\u6210\u3067\u6700\u7D42\u30EC\u30DD\u30FC\u30C8\u3092\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044:
1. \u6982\u8981: \u8CEA\u554F\u3068\u305D\u306E\u80CC\u666F\u306B\u3064\u3044\u3066\u7C21\u6F54\u306B\u8AAC\u660E
2. \u4E3B\u8981\u306A\u601D\u8003\u306E\u8A73\u7D30\u5206\u6790: \u9078\u629E\u3055\u308C\u305F\u601D\u8003\u306E\u91CD\u8981\u6027\u3068\u610F\u5473\u3092\u5206\u6790
3. \u53CE\u96C6\u3055\u308C\u305F\u8A3C\u62E0\u3068\u60C5\u5831: \u73FE\u6642\u70B9\u3067\u306F\u5916\u90E8\u60C5\u5831\u304C\u9650\u3089\u308C\u3066\u3044\u308B\u3053\u3068\u3092\u8AAC\u660E
4. \u7D50\u8AD6\u3068\u6D1E\u5BDF: \u8CEA\u554F\u306B\u5BFE\u3059\u308B\u7DCF\u5408\u7684\u306A\u898B\u89E3\u3084\u6D1E\u5BDF
5. \u4ECA\u5F8C\u306E\u8ABF\u67FB\u65B9\u5411\uFF08\u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3\uFF09: \u6319\u3052\u3089\u308C\u305F\u30B5\u30D6\u30AF\u30A8\u30B9\u30C1\u30E7\u30F3\u3092\u4ECA\u5F8C\u306E\u8ABF\u67FB\u65B9\u5411\u3068\u3057\u3066\u63D0\u793A

\u30EC\u30DD\u30FC\u30C8\u306F\u4E8B\u5B9F\u306B\u57FA\u3065\u304D\u3001\u30D0\u30E9\u30F3\u30B9\u306E\u53D6\u308C\u305F\u898B\u89E3\u3092\u63D0\u4F9B\u3057\u3066\u304F\u3060\u3055\u3044\u3002`;
      }
      const result = await synthesizerAgent.generate(prompt);
      if (result.text) {
        logger.info("(SynthesizeStep) Generated report successfully.");
        logger.info("=========== \u6700\u7D42\u30EC\u30DD\u30FC\u30C8\u5185\u5BB9 =============");
        logger.info("```markdown\n" + result.text + "\n```");
        logger.info("=========== \u6700\u7D42\u30EC\u30DD\u30FC\u30C8\u7D42\u4E86 =============");
        return { report: result.text };
      } else {
        logger.error("(SynthesizeStep) Agent did not return text");
        return { report: "\u30A8\u30E9\u30FC: \u30EC\u30DD\u30FC\u30C8\u751F\u6210\u4E2D\u306B\u554F\u984C\u304C\u767A\u751F\u3057\u307E\u3057\u305F\u3002" };
      }
    } catch (error) {
      logger.error("(SynthesizeStep) Error generating report", { error });
      return { report: "\u30A8\u30E9\u30FC: \u30EC\u30DD\u30FC\u30C8\u751F\u6210\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F\u3002" };
    }
  }
});
const researchCycleStep = new Step({
  id: "researchCycleStep",
  description: "\u30EB\u30FC\u30D7\u5185\u3067\u691C\u7D22\u3092\u5B9F\u884C\u3057\u3001\u601D\u8003\u3092\u66F4\u65B0\u3059\u308B\u30B9\u30C6\u30C3\u30D7",
  inputSchema: z.any(),
  // ループの状態を受け取る
  outputSchema: z.any(),
  // 更新されたループの状態を返す
  execute: async ({ context }) => {
    const logger = getLogger();
    const loopData = context.inputData;
    logger.info("[DEBUG] researchCycleStep execute - START", { inspectedLoopData: inspect(loopData, { depth: null }) });
    let currentSearchResults = [];
    let nextSubQuestionsForLoop = [];
    let currentBestThought = loopData.bestThought;
    if (loopData.subQuestions && loopData.subQuestions.length > 0) {
      logger.info("[DEBUG] researchCycleStep - Performing search for subQuestions:", { subQuestions: loopData.subQuestions });
      const searchPromises = loopData.subQuestions.map(async (subQuery) => {
        try {
          const agentResponse = await thoughtTransformerAgent.generate(
            `Based on the original query "${loopData.query}" and the current thought ${JSON.stringify(loopData.selectedThought)}, perform a web search for the sub-question: "${subQuery}". Use the available search tool.`
          );
          const searchToolResult = agentResponse.toolResults?.find((tr) => tr.toolName === "webSearchTool");
          if (searchToolResult?.result) {
            logger.info(`[DEBUG] researchCycleStep - Search successful for subQuery: "${subQuery}"`, { subQuery });
            return { source: "webSearchTool", query: subQuery, results: searchToolResult.result };
          } else {
            logger.warn(`[DEBUG] researchCycleStep - No search result found in agent response for subQuery: "${subQuery}"`, { subQuery, agentResponse });
            return { source: "webSearchTool", query: subQuery, results: [] };
          }
        } catch (error) {
          logger.error(`[DEBUG] researchCycleStep - Error searching for subQuery: "${subQuery}"`, { subQuery, error });
          return { source: "webSearchTool", query: subQuery, results: [] };
        }
      });
      currentSearchResults = await Promise.all(searchPromises);
      logger.info("[DEBUG] researchCycleStep - Completed searches", { currentSearchResults });
    } else {
      logger.info("[DEBUG] researchCycleStep - No subQuestions to search for this cycle.");
    }
    logger.info("[DEBUG] researchCycleStep - Maintaining current best thought", { currentBestThought });
    logger.info("[DEBUG] researchCycleStep - No generation of next subQuestions in this simplified version.");
    nextSubQuestionsForLoop = [];
    const output = {
      searchResults: currentSearchResults,
      // このサイクルでの検索結果
      bestThought: currentBestThought,
      // 更新された思考 (今回は維持)
      nextSubQuestions: nextSubQuestionsForLoop
      // 次のサイクルで使うサブクエスチョン
    };
    logger.info("[DEBUG] researchCycleStep execute - END", { inspectedOutput: inspect(output, { depth: null }) });
    return output;
  }
});
goTResearchWorkflow.step(clarityCheckStep).then(requestClarificationStep, {
  when: async ({ context }) => {
    const clarityResult = context.getStepResult(clarityCheckStep);
    return !clarityResult?.isClear;
  }
}).while(
  // 第一引数: 条件判定関数
  async ({ context }) => {
    const cycleResult = context.getStepResult(researchCycleStep);
    const logger = getLogger();
    logger.info(`(.while condition) cycleResult: ${JSON.stringify(cycleResult)}`);
    const score = cycleResult && typeof cycleResult === "object" && "score" in cycleResult ? cycleResult.score : void 0;
    const threshold = 7;
    const isFirstRun = cycleResult === void 0 || score === void 0;
    if (isFirstRun) {
      logger.info(`(.while condition) First run detected, will continue loop`);
      return true;
    }
    const shouldContinue = score !== void 0 && score < threshold;
    logger.info(`(.while condition) isFirstRun: ${isFirstRun}, Score: ${score}, Threshold: ${threshold}, Should continue? ${shouldContinue}`);
    return shouldContinue;
  },
  // 第二引数: 繰り返すステップ
  researchCycleStep,
  // 第三引数: 変数マッピング
  {
    // researchCycleStep に渡す変数
    query: { step: requestClarificationStep, path: "clarifiedQuery" }
  }
).then(prepareSynthesizeInput).then(synthesizeStep).commit();

const storage = new LibSQLStore({
  url: "file:./mastra.db"
});
const mastra = new Mastra({
  storage,
  agents: {
    thoughtEvaluatorAgent: thoughtEvaluatorAgent,
    thoughtGeneratorAgent: thoughtGeneratorAgent,
    thoughtTransformerAgent: thoughtTransformerAgent,
    clarityCheckAgent: clarityCheckAgent,
    clarificationPromptAgent: clarificationPromptAgent
  },
  workflows: {
    goTResearchWorkflow
  },
  logger: createLogger({
    name: "Mastra",
    level: "info"
  })
});
const getLogger = () => mastra.getLogger();

var index = /*#__PURE__*/Object.freeze({
  __proto__: null,
  getLogger: getLogger,
  mastra: mastra
});

export { webSearchTool as a, arxivSearchTool as b, mediumSearchTool as c, mastra as m, noteSearchTool as n, redditSearchTool as r, tavilySearchTool as t, weatherTool as w, youTubeSearchTool as y };
