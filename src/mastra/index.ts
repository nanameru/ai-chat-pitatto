import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';
import { LibSQLStore } from '@mastra/libsql';
import * as agents from './agents';

import { weatherAgent, webSearchAgent, arxivSearchAgent, redditTestAgent, youTubeTestAgent, mediumTestAgent, noteTestAgent } from './agents';
import { goTResearchWorkflow } from './workflows';

const storage = new LibSQLStore({
  url: 'file:./mastra.db',
});

export const mastra = new Mastra({
  storage,
  agents: {
    thoughtEvaluatorAgent: agents.thoughtEvaluatorAgent,
    thoughtGeneratorAgent: agents.thoughtGeneratorAgent,
    thoughtTransformerAgent: agents.thoughtTransformerAgent,
    thoughtAggregationAgent: agents.thoughtAggregationAgent,
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
