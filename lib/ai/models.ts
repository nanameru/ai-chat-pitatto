import { openai } from '@ai-sdk/openai';
// import { xai } from '@ai-sdk/xai';
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
    // Grokモデルは一時的に無効化
    // 'grok-model': xai('grok-2-1212') as unknown as ReturnType<typeof openai>,
    // 'grok-vision-model': xai('grok-2-vision-1212') as unknown as ReturnType<typeof openai>,
  },
  imageModels: {
    'small-model': openai.image('dall-e-2'),
    'large-model': openai.image('dall-e-3'),
    // Grokモデルは一時的に無効化
    // 'grok-image-model': xai.image('grok-2-vision-1212') as unknown as ReturnType<typeof openai.image>,
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
  // Grokモデルは一時的に無効化
  // {
  //   id: 'grok-model',
  //   name: 'Grok-2-1212',
  //   description: 'xAIの高性能テキスト生成モデル',
  //   modelVersion: 'grok-2-1212'
  // },
  // {
  //   id: 'grok-vision-model',
  //   name: 'Grok-2-Vision-1212',
  //   description: 'xAIのマルチモーダル対応モデル（画像生成機能付き）',
  //   modelVersion: 'grok-2-vision-1212'
  // },
];
