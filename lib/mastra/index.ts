import { Mastra } from '@mastra/core';
import { deepResearchAgent } from './agents/deep-research-agent';
import { researchWorkflow } from './workflows/research-workflow';

export const mastra = new Mastra({
  agents: { deepResearchAgent },
  workflows: { researchWorkflow },
});

export { deepResearchAgent } from './agents/deep-research-agent';
export { researchWorkflow } from './workflows/research-workflow';
export * as tools from './tools';
