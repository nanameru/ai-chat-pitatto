/**
 * AI モデルの共通型定義
 */

/**
 * チャットモデルのインターフェース
 */
export interface ChatModel {
  id: string;
  name: string;
  description: string;
  modelVersion: string;
}

/**
 * 画像モデルのインターフェース
 */
export interface ImageModel {
  id: string;
  name: string;
  description: string;
  modelVersion: string;
}

/**
 * プロバイダーの種類
 */
export enum ProviderType {
  OpenAI = 'openai',
  XAI = 'xai',
  Anthropic = 'anthropic'
}

/**
 * モデルプロバイダーのインターフェース
 */
export interface ModelProvider {
  type: ProviderType;
  getLanguageModels(): Record<string, any>;
  getImageModels?(): Record<string, any>;
}
