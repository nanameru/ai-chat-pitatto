import { Mastra } from '@mastra/core';
import { deepResearchAgentV2 } from './agents/deep-research-v2';
import { researchWorkflow } from './workflows/research-workflow';
import { totResearchAgent } from './agents/tot-research';
import { totResearchWorkflow } from './workflows/tot-research-workflow';

export const mastra = new Mastra({
  agents: { 
    deepResearchAgent: deepResearchAgentV2,
    totResearchAgent
  },
  workflows: { 
    researchWorkflow,
    totResearchWorkflow 
  },
});

export { deepResearchAgentV2 as deepResearchAgent } from './agents/deep-research-v2';
export { totResearchAgent } from './agents/tot-research';
export { researchWorkflow } from './workflows/research-workflow';
export { totResearchWorkflow } from './workflows/tot-research-workflow';
export * as tools from './tools';
