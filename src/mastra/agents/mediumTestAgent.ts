import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { mediumSearchTool } from '../tools'; // Import the mediumSearchTool

export const mediumTestAgent = new Agent({
  name: 'Medium Test Agent',
  instructions: 'This agent is designed to test the Medium Search Tool. It uses the tool to search for articles on Medium.com based on a user query.',
  model: openai('gpt-4o-mini'),
  tools: { mediumSearchTool }, // Register the mediumSearchTool
}); 