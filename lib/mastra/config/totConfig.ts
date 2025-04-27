// ToT configuration: centralize models for generation and evaluation
// lib/mastra/config/totConfig.ts

/**
 * Tree of Thoughts (ToT) 設定
 * モデル名、探索パラメータなどの設定を一元管理します。
 */
export const totConfig = {
  // モデル設定
  // 思考生成時に使用するモデル名
  generationModel: "o4-mini",
  // 思考評価時に使用するモデル名
  evaluationModel: "o4-mini",

  // Beam Search 設定
  // 各ノードから生成する子ノードの数
  branchingFactor: 5,
  // 探索の最大深さ
  maxDepth: 3,
  // 各深さで保持する上位ノード数
  beamWidth: 3,
  
  // コスト管理設定
  // 推定コスト予算上限（トークン数）
  costBudget: 100000,
  // 並列実行の最大数
  maxConcurrency: 5,
  
  // キャッシュ設定
  // キャッシュ有効期限（ミリ秒）
  cacheTTL: 24 * 60 * 60 * 1000, // 24時間
}; 