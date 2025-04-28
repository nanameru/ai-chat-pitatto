import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';
import * as agents from './agents';

import { weatherAgent, webSearchAgent, arxivSearchAgent, redditTestAgent, youTubeTestAgent, mediumTestAgent, noteTestAgent } from './agents';
import { goTResearchWorkflow } from './workflows';

export const mastra = new Mastra({
  agents: {
    thoughtEvaluatorAgent: agents.thoughtEvaluatorAgent,
    thoughtGeneratorAgent: agents.thoughtGeneratorAgent,
    thoughtTransformerAgent: agents.thoughtTransformerAgent,
    clarityCheckAgent: agents.clarityCheckAgent,
    clarificationPromptAgent: agents.clarificationPromptAgent
  },
  workflows: { goTResearchWorkflow },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});

// Loggerを便利に取得するためのヘルパー
export const getLogger = () => mastra.getLogger();
