import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { weatherTool, webSearchTool } from '../tools';

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

export { arxivSearchAgent } from './arxivSearchAgent';
export { redditTestAgent } from './redditTestAgent';
export { youTubeTestAgent } from './youTubeTestAgent';
export { mediumTestAgent } from './mediumTestAgent';
export { noteTestAgent } from './noteTestAgent';
export { thoughtGeneratorAgent } from './thoughtGeneratorAgent';
export { thoughtEvaluatorAgent } from './thoughtEvaluatorAgent';
export { thoughtTransformerAgent } from './thoughtTransformerAgent';
export { synthesizerAgent } from './synthesizerAgent';
export { thoughtAggregationAgent } from './thoughtAggregationAgent';

export const clarityCheckAgent = new Agent({
  name: 'clarityCheckAgent',
  model: openai('gpt-4o-mini'),
  instructions: `あなたは質問の明確さを評価する専門家です。与えられた質問が明確か不明確かを判断し、理由とともに回答してください。評価結果は必ず以下のJSON形式で返してください: {"isClear": boolean, "reasoning": "評価理由を簡潔に"}`
});

export const clarificationPromptAgent = new Agent({
  name: 'clarificationPromptAgent',
  model: openai('gpt-4o-mini'),
  instructions: `あなたは質問の明確化を支援する専門家です。不明確な質問に対して、ユーザーがより明確に質問を再構築できるような質問文を生成してください。`
});
