import { Mastra } from '@mastra/core';
import { deepResearchAgentV2 } from './agents/deep-research-v2';
import { researchWorkflow } from './workflows/research-workflow';

export const mastra = new Mastra({
  agents: { deepResearchAgent: deepResearchAgentV2 },
  workflows: { researchWorkflow },
});

export { deepResearchAgentV2 as deepResearchAgent } from './agents/deep-research-v2';
export { researchWorkflow } from './workflows/research-workflow';
export * as tools from './tools';
