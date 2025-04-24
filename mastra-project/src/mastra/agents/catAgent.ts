import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Fetch a random cat fact from the external service
const getCatFact = async (): Promise<string> => {
  const response = await fetch('https://catfact.ninja/fact');
  const data = (await response.json()) as { fact: string };
  return data.fact;
};

// Define the catFact tool that uses getCatFact
const catFactTool = createTool({
  id: 'Get cat facts',
  inputSchema: z.object({}),
  description: 'Fetches cat facts',
  execute: async () => {
    console.log('using tool to fetch cat fact');
    return { catFact: await getCatFact() };
  },
});

// Define the cat expert agent
export const catAgent = new Agent({
  name: 'cat-one',
  instructions: `
You are a helpful cat expert assistant. When discussing cats, you should always include an interesting cat fact.

Your main responsibilities:
1. Answer questions about cats
2. Use the catFact tool to provide verified cat facts
3. Incorporate the cat facts naturally into your responses

Always use the catFact tool at least once in your responses to ensure accuracy.
`,
  model: openai('gpt-4o-mini'),
  tools: { catFact: catFactTool },
}); 