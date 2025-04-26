import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { arxivSearchTool } from '../tools'; // Import the arxivSearchTool

export const arxivSearchAgent = new Agent({
  name: 'Arxiv Search Agent', // Agent name
  instructions: 'You are an agent specialized in searching for academic papers on arXiv. Use the provided tool to perform searches based on user queries.', // Instructions for the agent
  model: openai('gpt-4o-mini'), // Specify the language model
  tools: { arxivSearchTool }, // Register the arxivSearchTool with this agent
}); 