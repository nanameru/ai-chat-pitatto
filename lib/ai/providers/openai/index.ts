/**
 * OpenAIプロバイダーの実装
 */
import { openai } from '@ai-sdk/openai';
import { ChatModel, ImageModel, ModelProvider, ProviderType } from '../../types';

// 既存のAPIキーを使用する（.env.localから読み込み）
// 環境変数が優先的に使用されることを確認
const apiKey = process.env.OPENAI_API_KEY;
if (apiKey) {
  console.log('[OpenAI Provider] 環境変数からAPIキーを検出しました');
  console.log(`[OpenAI Provider] APIキー先頭: ${apiKey.substring(0, 5)}...`);
  
  // プロバイダー初期化前にAPIキーが設定されていることを確認する
  // @ai-sdk/openai に直接APIキーを渡す
  try {
    // 値が上書きされないようにObject.definePropertyを使用
    const envDescriptor = Object.getOwnPropertyDescriptor(process.env, 'OPENAI_API_KEY');
    if (envDescriptor && envDescriptor.configurable) {
      Object.defineProperty(process.env, 'OPENAI_API_KEY', {
        value: apiKey,
        writable: false,
        configurable: false
      });
      console.log('[OpenAI Provider] APIキーを保護しました');
    }
  } catch (error) {
    console.error('[OpenAI Provider] APIキー保護中にエラーが発生しました', error);
  }
} else {
  console.error('[OpenAI Provider] 環境変数OPENAI_API_KEYが設定されていません');
}

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
  // @ts-ignore - 型エラーを無視して明示的にAPIキーを設定
  'title-model': openai('gpt-4o', { apiKey: apiKey || '' }),
  // @ts-ignore - 型エラーを無視して明示的にAPIキーを設定
  'artifact-model': openai('gpt-4o-mini', { apiKey: apiKey || '' })
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
      // @ts-ignore - 型エラーを無視して明示的にAPIキーを設定
      models[model.id] = openai(model.modelVersion, { apiKey: apiKey || '' });
      console.log(`[OpenAI Provider] 言語モデル初期化: ${model.modelVersion}, APIキー: ${apiKey ? '設定済み' : '未設定'}`);
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
