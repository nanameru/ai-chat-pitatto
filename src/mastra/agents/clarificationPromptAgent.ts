import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

// TODO: Adjust instructions and model as needed
export const clarificationPromptAgent = new Agent({
  name: 'Clarification Prompt Agent',
  instructions: 'You are an AI assistant. Given a user query that was deemed unclear and the reason why, generate a polite and specific question to ask the user for clarification. Only output the question itself.',
  model: openai('gpt-4o-mini'), // Or another suitable model
}); 