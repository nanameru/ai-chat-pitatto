import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { weatherTool, webSearchTool } from '../tools';
import { catAgent } from './catAgent';

export const weatherAgent = new Agent({
  name: 'Weather Agent',
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
  model: openai('gpt-4o'),
  tools: { weatherTool },
});

export const webSearchAgent = new Agent({
  name: 'Web Search Agent',
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
  model: openai('gpt-4o'),
  tools: { webSearchTool },
});

export { catAgent };
export { memoryAgent } from './memoryAgent';
