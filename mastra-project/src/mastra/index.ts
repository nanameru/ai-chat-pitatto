import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';

import { weatherAgent, webSearchAgent, memoryAgent, copywriterAgent, editorAgent, publisherAgent, voiceAgent } from './agents';
import { searchWorkflow, chainSearchWorkflow, parallelSearchWorkflow, branchingSentimentWorkflow, conditionalContentWorkflow, agentSearchWorkflow, searchSummarizeWorkflow, whileLoopWorkflow, humanInTheLoopWorkflow, contentGenerationWorkflow, multiAgentWorkflow } from './workflows';
import * as workflows from './workflows';
import { runCyclicalWorkflowExample, runWhileLoopWorkflowExample, runMemoryAgentExample } from './run-examples';

export const mastra = new Mastra({
  agents: { weatherAgent, webSearchAgent, memoryAgent, copywriterAgent, editorAgent, publisherAgent, voiceAgent },
  workflows: { searchWorkflow, chainSearchWorkflow, parallelSearchWorkflow, branchingSentimentWorkflow, conditionalContentWorkflow, agentSearchWorkflow, searchSummarizeWorkflow, whileLoopWorkflow, humanInTheLoopWorkflow, contentGenerationWorkflow, multiAgentWorkflow },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});

export {
  workflows,
  runCyclicalWorkflowExample,
  runWhileLoopWorkflowExample,
  runMemoryAgentExample
};
