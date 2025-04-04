/**
 * xAIプロバイダーの実装
 */
import { xai } from '@ai-sdk/xai';
import { ChatModel, ImageModel, ModelProvider, ProviderType } from '../../types';

/**
 * xAIで利用可能なチャットモデル
 */
export const xaiChatModels: ChatModel[] = [
  {
    id: 'grok-model',
    name: 'Grok-2-1212',
    description: 'xAIの高性能テキスト生成モデル',
    modelVersion: 'grok-2-1212'
  },
  {
    id: 'grok-vision-model',
    name: 'Grok-2-Vision-1212',
    description: 'xAIのマルチモーダル対応モデル（画像生成機能付き）',
    modelVersion: 'grok-2-vision-1212'
  }
];

/**
 * xAIで利用可能な画像モデル
 */
export const xaiImageModels: Record<string, any> = {
  'grok-image-model': xai.image('grok-2-vision-1212')
};

/**
 * xAIプロバイダークラス
 */
export class XAIProvider implements ModelProvider {
  type = ProviderType.XAI;

  /**
   * 言語モデルを取得
   */
  getLanguageModels(): Record<string, any> {
    const models: Record<string, any> = {};
    
    // チャットモデルを追加
    xaiChatModels.forEach(model => {
      // 型アサーションを使用してバージョン互換性の問題を解決
      models[model.id] = xai(model.modelVersion) as any;
    });
    
    return models;
  }

  /**
   * 画像モデルを取得
   */
  getImageModels(): Record<string, any> {
    return xaiImageModels;
  }
}

// xAIプロバイダーのインスタンスをエクスポート
export const xaiProvider = new XAIProvider();
