import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';

import { weatherAgent, webSearchAgent } from './agents';

export const mastra = new Mastra({
  agents: { weatherAgent, webSearchAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
