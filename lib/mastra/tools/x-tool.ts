/**
 * X API ツール
 * 
 * 使用方法:
 * import { searchTweets, searchFullArchive } from 'lib/mastra/tools/x-tool';
 * 
 * 必要な環境変数:
 * NEXT_PUBLIC_X_API_KEY
 * NEXT_PUBLIC_X_API_SECRET
 */

import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const X_API_KEY = process.env.NEXT_PUBLIC_X_API_KEY || 'ojUuSi8ZDpPF0RIZd1fZFQgol';
const X_API_SECRET = process.env.NEXT_PUBLIC_X_API_SECRET || 'i2jINTOqPnV6hAl26K7A545p2QVz8LWNpZhlT7MIHenvsC3STt';

let bearerToken: string | null = null;

/**
 * OAuth2 App-Only でベアラートークンを取得
 */
async function getBearerToken(): Promise<string> {
  if (bearerToken) return bearerToken;
  
  console.log('getBearerToken: API認証を実行します');
  console.log(`API Key: ${X_API_KEY.substring(0, 4)}...`);
  console.log(`API Secret: ${X_API_SECRET.substring(0, 4)}...`);
  
  try {
    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams({ 
        grant_type: 'client_credentials',
        client_id: X_API_KEY,
        client_secret: X_API_SECRET,
        client_type: 'third_party_app'
      }),
    });
    
    console.log(`認証レスポンス ステータス: ${response.status} ${response.statusText}`);
    const responseText = await response.text();
    console.log(`レスポンス内容: ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}`);
    
    if (!response.ok) {
      throw new Error(`X API token fetch failed: ${response.status} ${response.statusText}`);
    }
    
    const data = JSON.parse(responseText);
    if (!data.access_token) {
      throw new Error(`Invalid token response: ${JSON.stringify(data)}`);
    }
    
    console.log('アクセストークン取得成功!');
    bearerToken = data.access_token;
    return data.access_token as string;
  } catch (error) {
    console.error('認証エラー:', error);
    throw error;
  }
}

/**
 * Recent Search エンドポイントを呼び出し
 * @param query 検索クエリ
 * @param max_results 取得件数(最大100)
 */
export async function searchTweets(query: string, max_results: number = 10): Promise<any> {
  const token = await getBearerToken();
  const url = new URL('https://api.twitter.com/2/tweets/search/recent');
  url.searchParams.set('query', query);
  url.searchParams.set('max_results', String(max_results));
  url.searchParams.set('tweet.fields', 'created_at,author_id,public_metrics,entities');
  url.searchParams.set('expansions', 'author_id');
  url.searchParams.set('user.fields', 'name,username,profile_image_url');
  
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`X API search failed: ${response.status} ${response.statusText}\n${errorText}`);
  }
  
  return response.json();
}

/**
 * 全文検索エンドポイントを呼び出し (Academic Research アクセスが必要)
 * @param query 検索クエリ
 * @param max_results 取得件数(最大100)
 * @param start_time 開始時間 (ISO 8601形式 例: 2021-01-01T00:00:00Z)
 * @param end_time 終了時間 (ISO 8601形式)
 */
export async function searchFullArchive(
  query: string, 
  max_results: number = 10,
  start_time?: string,
  end_time?: string
): Promise<any> {
  const token = await getBearerToken();
  const url = new URL('https://api.twitter.com/2/tweets/search/all');
  
  // 必須パラメータ
  url.searchParams.set('query', query);
  url.searchParams.set('max_results', String(max_results));
  
  // オプションパラメータ
  if (start_time) url.searchParams.set('start_time', start_time);
  if (end_time) url.searchParams.set('end_time', end_time);
  
  // 追加フィールド
  url.searchParams.set('tweet.fields', 'created_at,author_id,public_metrics,entities');
  url.searchParams.set('expansions', 'author_id');
  url.searchParams.set('user.fields', 'name,username,profile_image_url');
  
  console.log(`全文検索API呼び出し: ${url.toString()}`);
  
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`全文検索API エラー: ${errorText}`);
    throw new Error(`X API full archive search failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}