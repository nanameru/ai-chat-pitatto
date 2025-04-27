import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { youTubeSearchTool } from '../tools'; // Import the youTubeSearchTool

export const youTubeTestAgent = new Agent({
  name: 'YouTube Test Agent',
  instructions: 'This agent is designed to test the YouTube Search Tool. It uses the tool to search for videos based on a user query.',
  model: openai('gpt-4o-mini'),
  tools: { youTubeSearchTool }, // Register the youTubeSearchTool
}); 