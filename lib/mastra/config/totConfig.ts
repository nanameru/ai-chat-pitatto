// ToT configuration: centralize models for generation and evaluation
// lib/mastra/config/totConfig.ts

/**
 * Tree of Thoughts (ToT) 設定
 * 生成と評価で利用するモデル名を設定します。
 */
export const totConfig = {
  // 思考生成時に使用するモデル名
  generationModel: "o4-mini",
  // 思考評価時に使用するモデル名
  evaluationModel: "o4-mini"
}; 