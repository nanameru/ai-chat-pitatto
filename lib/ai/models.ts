import { openai } from '@ai-sdk/openai';
import {
  customProvider,
} from 'ai';

export const DEFAULT_CHAT_MODEL: string = 'chat-model-small';

export const myProvider = customProvider({
  languageModels: {
    'chat-model-small': openai('gpt-4o-mini'),
    'chat-model-large': openai('gpt-4o'),
    'chat-model-reasoning': openai('o3-mini'),
    'title-model': openai('gpt-4o'),
    'artifact-model': openai('gpt-4o-mini'),
  },
  imageModels: {
    'small-model': openai.image('dall-e-2'),
    'large-model': openai.image('dall-e-3'),
  },
});

interface ChatModel {
  id: string;
  name: string;
  description: string;
  modelVersion: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model-small',
    name: 'ChatGPT-4o Mini',
    description: '高速で効率的な応答が可能な軽量モデル',
    modelVersion: 'gpt-4o-mini'
  },
  {
    id: 'chat-model-large',
    name: 'ChatGPT-4o',
    description: '高度な理解と詳細な応答が可能な標準モデル',
    modelVersion: 'gpt-4o'
  },
  {
    id: 'chat-model-reasoning',
    name: 'o3 Mini',
    description: '基本的なタスクに適した経済的なモデル',
    modelVersion: 'o3-mini'
  },
];
