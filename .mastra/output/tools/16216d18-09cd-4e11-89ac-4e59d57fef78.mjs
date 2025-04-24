import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

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

export { weatherTool, webSearchTool };
