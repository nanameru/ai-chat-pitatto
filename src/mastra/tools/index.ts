import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

interface GeocodingResponse {
  results: {
    latitude: number;
    longitude: number;
    name: string;
  }[];
}
interface WeatherResponse {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    weather_code: number;
  };
}

// Tavily Search APIのためのインターフェース
interface TavilySearchResponse {
  results: Array<{
    title: string;
    url: string;
    content: string;
  }>;
  answer?: string;
}

export const tavilySearchTool = createTool({
  id: 'tavily-search',
  description: '指定されたクエリでTavily Search APIを使用してウェブ検索を実行します',
  inputSchema: z.object({
    query: z.string().describe('検索クエリ'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string(),
      url: z.string(),
      description: z.string(),
    })),
    answer: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { query } = context;
    const count = 5;
    const searchDepth = "basic";
    const includeAnswer = false;
    const logger = (await import('..')).getLogger();
    
    logger.info(`(tavilySearchTool) 検索クエリの実行: "${query}", 取得件数: ${count}, 検索深度: ${searchDepth}`);
    
    const apiKey = process.env.TAVILY_API_KEY;
    
    if (!apiKey) {
      const errorMsg = '環境変数 TAVILY_API_KEY が設定されていません';
      logger.error(`(tavilySearchTool) API_KEY不足エラー: ${errorMsg}`);
      return { results: [], error: errorMsg };
    }

    const limitedCount = Math.min(count, 10);
    
    try {
      logger.info(`(tavilySearchTool) Tavily Search APIリクエスト開始`);
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          max_results: limitedCount,
          search_depth: searchDepth,
          include_answer: includeAnswer,
        })
      });

      logger.info(`(tavilySearchTool) APIレスポンス受信: ステータスコード=${response.status}`);
      
      if (!response.ok) {
        const responseText = await response.text().catch(e => `テキスト取得失敗: ${e.message}`);
        const errorMsg = `Tavily Search APIエラー: ${response.status} ${response.statusText}. レスポンス: ${responseText}`;
        logger.error(`(tavilySearchTool) APIエラー: ${errorMsg}`);
        return { results: [], error: errorMsg };
      }

      logger.info(`(tavilySearchTool) APIレスポンスのJSONパース開始`);
      const data = await response.json() as TavilySearchResponse;
      logger.info(`(tavilySearchTool) JSONパース完了`);

      if (!data.results || data.results.length === 0) {
        logger.info(`(tavilySearchTool) 検索結果なし: query="${query}"`);
        return {
          results: [],
          answer: data.answer
        };
      }

      const results = data.results.map(result => ({
        title: result.title,
        url: result.url,
        description: result.content
      }));
      
      logger.info(`(tavilySearchTool) 検索成功: ${results.length}件の結果を取得`);
      
      return {
        results,
        answer: data.answer
      };
    } catch (error) {
      // エラーの詳細情報を記録
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error(`(tavilySearchTool) 検索実行中のエラー: ${errorMessage}`);
      if (errorStack) {
        logger.error(`(tavilySearchTool) エラースタック: ${errorStack}`);
      }
      
      // 環境変数の状態をログに出力（API_KEYは一部マスク）
      const maskedApiKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'undefined';
      logger.error(`(tavilySearchTool) 環境変数状態: TAVILY_API_KEY=${maskedApiKey}`);
      
      return { results: [], error: errorMessage };
    }
  },
});

export const weatherTool = createTool({
  id: 'get-weather',
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGust: z.number(),
    conditions: z.string(),
    location: z.string(),
  }),
  execute: async ({ context }) => {
    return await getWeather(context.location);
  },
});

export { webSearchTool } from './webSearchTool';
export { arxivSearchTool } from './arxivSearchTool';
export { redditSearchTool } from './redditSearchTool';
export { youTubeSearchTool } from './youTubeSearchTool';
export { mediumSearchTool } from './mediumSearchTool';
export { noteSearchTool } from './noteSearchTool';

const getWeather = async (location: string) => {
  const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`;
  const geocodingResponse = await fetch(geocodingUrl);
  const geocodingData = (await geocodingResponse.json()) as GeocodingResponse;

  if (!geocodingData.results?.[0]) {
    throw new Error(`Location '${location}' not found`);
  }

  const { latitude, longitude, name } = geocodingData.results[0];

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code`;

  const response = await fetch(weatherUrl);
  const data = (await response.json()) as WeatherResponse;

  return {
    temperature: data.current.temperature_2m,
    feelsLike: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    windGust: data.current.wind_gusts_10m,
    conditions: getWeatherCondition(data.current.weather_code),
    location: name,
  };
};

function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };
  return conditions[code] || 'Unknown';
}
