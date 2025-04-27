import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Buffer } from 'buffer'; // Node.js Buffer for Basic Auth encoding

// --- Token Caching ---
interface RedditToken {
  access_token: string;
  token_type: string;
  expires_in: number; // Seconds
  scope: string;
  acquired_at: number; // Timestamp (ms) when acquired
}

let cachedToken: RedditToken | null = null;

async function getRedditAccessToken(): Promise<string> {
  const now = Date.now();

  // Check if cached token exists and is still valid (with a 60-second buffer)
  if (cachedToken && (cachedToken.acquired_at + (cachedToken.expires_in - 60) * 1000 > now)) {
    return cachedToken.access_token;
  }

  // Fetch new token if cache is invalid or missing
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const username = process.env.REDDIT_USERNAME; // Needed for User-Agent

  if (!clientId || !clientSecret || !username) {
    throw new Error('Reddit API credentials (REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME) are not set in environment variables.');
  }

  const tokenUrl = 'https://www.reddit.com/api/v1/access_token';
  // Encode credentials for Basic Authentication header
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const userAgent = `MastraRedditTool/0.1 by ${username}`;

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=read', // Requesting read-only scope
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get Reddit access token: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const tokenData = await response.json() as Omit<RedditToken, 'acquired_at'>;
    cachedToken = { ...tokenData, acquired_at: now };
    console.log('Successfully obtained new Reddit access token.'); // Log success
    return cachedToken.access_token;

  } catch (error) {
    console.error('Error fetching Reddit access token:', error);
    // Type check before accessing message property
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    throw new Error(`Error fetching Reddit access token: ${errorMessage}`);
  }
}

// --- Tool Definition ---
export const redditSearchTool = createTool({
  id: 'reddit-search',
  description: 'キーワードやオプションのフィルタを使ってRedditの投稿やコメントを検索します。',
  inputSchema: z.object({
    query: z.string().describe('検索キーワード（例: "大規模言語モデル", "subreddit:MachineLearning best llms"）'),
    subreddit: z.string().optional().describe('検索対象を特定のサブレディットに限定します（例: "programming", "MachineLearning"）。"r/"は含めないでください。'),
    // type: z.enum(['link', 'comment', 'sr']).optional().default('link'),
    sort: z.enum(['relevance', 'hot', 'top', 'new', 'comments']).optional().default('relevance').describe('結果の並び順'),
    time: z.enum(['hour', 'day', 'week', 'month', 'year', 'all']).optional().default('all').describe('topソート時の期間指定'), // Restore simple description
    limit: z.number().int().min(1).max(100).optional().default(10).describe('返す結果の最大数（1-100）。デフォルト: 10'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      id: z.string().describe('投稿/コメントID'),
      title: z.string().optional().describe('投稿タイトル（投稿の場合のみ存在）'),
      body: z.string().optional().describe('投稿本文またはコメント本文'),
      author: z.string().describe('投稿者名'),
      subreddit: z.string().describe('サブレディット名'),
      score: z.number().describe('投稿/コメントのスコア'),
      num_comments: z.number().optional().describe('コメント数（投稿の場合のみ存在）'),
      created_utc: z.number().describe('作成日時（Unixタイムスタンプ）'),
      url: z.string().describe('投稿/コメントへのパーマリンク'),
      kind: z.string().describe('種類（t3: 投稿, t1: コメント）'),
    })).describe('Redditからの検索結果リスト。'),
  }),
  execute: async ({ context }) => {
    const { query, subreddit, sort, time, limit } = context;
    const username = process.env.REDDIT_USERNAME; // Needed for User-Agent

    if (!username) {
        throw new Error('Reddit username (REDDIT_USERNAME) is not set in environment variables for User-Agent.');
    }
    const userAgent = `MastraRedditTool/0.1 by ${username}`;

    try {
      const accessToken = await getRedditAccessToken();

      const searchParams = new URLSearchParams({
        q: query,
        sort: sort,
        t: time,
        limit: limit.toString(),
        // type: context.type || 'link', // Stick to default search which seems post-focused
        raw_json: '1', // Get raw JSON without HTML entities
      });

      let searchUrl: string;
      if (subreddit) {
        // Subreddit specific search
        searchUrl = `https://oauth.reddit.com/r/${subreddit}/search?${searchParams.toString()}`;
        // Ensure restrict_sr is set for subreddit search
        searchUrl += '&restrict_sr=1';
      } else {
        // Global Reddit search
        searchUrl = `https://oauth.reddit.com/search?${searchParams.toString()}`;
      }
      console.log(`Executing Reddit search: ${searchUrl}`); // Log the URL

      const response = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': userAgent,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Handle rate limits specifically if possible
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

      // Map results to output schema
      const results = data.data.children.map((item: any) => ({
        id: item.data.id,
        title: item.data.title, // Might be null for comments
        body: item.data.selftext || item.data.body, // Use selftext for posts, body for comments
        author: item.data.author,
        subreddit: item.data.subreddit,
        score: item.data.score,
        num_comments: item.data.num_comments, // Might be null for comments
        created_utc: item.data.created_utc,
        url: `https://www.reddit.com${item.data.permalink}`, // Construct full permalink
        kind: item.kind, // Include kind (t3 or t1)
      }));

      return { results };

    } catch (error) {
      console.error('Error during Reddit search execution:', error);
      // Re-throw specific errors or a generic one
      let errorMessage = 'An unknown error occurred during Reddit search.';
      if (error instanceof Error) {
          errorMessage = `Reddit search failed: ${error.message}`;
      }
      // Throw a new error with a potentially more specific message
      throw new Error(errorMessage);
    }
  },
}); 