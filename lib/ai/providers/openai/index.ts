/**
 * OpenAIプロバイダーの実装
 */
import { openai } from '@ai-sdk/openai';
import { ChatModel, ImageModel, ModelProvider, ProviderType } from '../../types';

/**
 * OpenAIで利用可能なチャットモデル
 */
export const openaiChatModels: ChatModel[] = [
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
  }
];

/**
 * OpenAIで利用可能な特殊目的モデル
 */
export const openaiSpecialModels = {
  'title-model': openai('gpt-4o'),
  'artifact-model': openai('gpt-4o-mini')
};

/**
 * OpenAIで利用可能な画像モデル
 */
export const openaiImageModels: Record<string, ReturnType<typeof openai.image>> = {
  'small-model': openai.image('dall-e-2'),
  'large-model': openai.image('dall-e-3')
};

/**
 * OpenAIプロバイダークラス
 */
export class OpenAIProvider implements ModelProvider {
  type = ProviderType.OpenAI;

  /**
   * 言語モデルを取得
   */
  getLanguageModels(): Record<string, ReturnType<typeof openai>> {
    const models: Record<string, ReturnType<typeof openai>> = {};
    
    // チャットモデルを追加
    openaiChatModels.forEach(model => {
      models[model.id] = openai(model.modelVersion);
    });
    
    // 特殊目的モデルを追加
    Object.entries(openaiSpecialModels).forEach(([id, model]) => {
      models[id] = model;
    });
    
    return models;
  }

  /**
   * 画像モデルを取得
   */
  getImageModels(): Record<string, ReturnType<typeof openai.image>> {
    return openaiImageModels;
  }
}

// OpenAIプロバイダーのインスタンスをエクスポート
export const openaiProvider = new OpenAIProvider();
