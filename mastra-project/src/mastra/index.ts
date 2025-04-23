import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';

import { weatherAgent, webSearchAgent } from './agents';
import { searchWorkflow, chainSearchWorkflow, parallelSearchWorkflow, branchingSentimentWorkflow, conditionalContentWorkflow, agentSearchWorkflow, searchSummarizeWorkflow, humanInTheLoopWorkflow } from './workflows';
import * as workflows from './workflows';
import { runCyclicalWorkflowExample, runWhileLoopWorkflowExample } from './run-examples';

export const mastra = new Mastra({
  agents: { weatherAgent, webSearchAgent },
  workflows: { searchWorkflow, chainSearchWorkflow, parallelSearchWorkflow, branchingSentimentWorkflow, conditionalContentWorkflow, agentSearchWorkflow, searchSummarizeWorkflow, humanInTheLoopWorkflow },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});

export {
  workflows,
  runCyclicalWorkflowExample,
  runWhileLoopWorkflowExample
};
