import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { noteSearchTool } from '../tools'; // Import the noteSearchTool

export const noteTestAgent = new Agent({
  name: 'Note Test Agent',
  instructions: 'This agent is designed to test the Note Search Tool. It uses the tool to search for articles on note.com based on a user query.',
  model: openai('gpt-4o-mini'),
  tools: { noteSearchTool }, // Register the noteSearchTool
}); 