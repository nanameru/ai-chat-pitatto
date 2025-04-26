import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { redditSearchTool } from '../tools'; // Import the redditSearchTool

export const redditTestAgent = new Agent({
  name: 'Reddit Test Agent', // Agent name
  instructions: 'This agent is designed to test the Reddit Search Tool. It takes a user query and uses the tool to search Reddit.', // Simple instructions for testing
  model: openai('gpt-4o-mini'), // Use a basic model
  tools: { redditSearchTool }, // Register the redditSearchTool with this agent
}); 