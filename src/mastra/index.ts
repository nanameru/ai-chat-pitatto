import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';

import { weatherAgent, webSearchAgent, arxivSearchAgent, redditTestAgent, youTubeTestAgent, mediumTestAgent, noteTestAgent, clarityCheckAgent, clarificationPromptAgent, thoughtGeneratorAgent, thoughtEvaluatorAgent } from './agents';
import { goTResearchWorkflow } from './workflows';

export const mastra = new Mastra({
  agents: { weatherAgent, webSearchAgent, arxivSearchAgent, redditTestAgent, youTubeTestAgent, mediumTestAgent, noteTestAgent, clarityCheckAgent, clarificationPromptAgent, thoughtGeneratorAgent, thoughtEvaluatorAgent },
  workflows: { goTResearchWorkflow },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
