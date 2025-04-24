import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { openai } from '@ai-sdk/openai';

// Memory-enabled agent setup
const memory = new Memory();

export const memoryAgent = new Agent({
  name: 'MyMemoryAgent',
  instructions: 'あなたはメモリを持つ役立つアシスタントです。',
  model: openai('gpt-4o'),
  memory: memory,
}); 