/**
 * ToT (Tree of Thoughts) ツール名を一元管理するための enum 定義
 * 
 * 文字列リテラルではなく enum を使用することで、
 * 1. 型安全性の確保（タイプミスによるエラーを防止）
 * 2. IDE の補完サポート
 * 3. リファクタリング時の一括変更
 * などのメリットが得られます。
 */

/**
 * 思考生成に関連するツール名の列挙型
 */
export enum ThoughtToolName {
  ThoughtGenerator = "thoughtGenerator",
  NextThoughtGenerator = "nextThoughtGenerator",
  ThoughtEvaluator = "thoughtEvaluator",
  PathSelector = "pathSelector"
}

/**
 * 研究計画に関連するツール名の列挙型
 */
export enum PlanningToolName {
  ResearchPlanGenerator = "researchPlanGenerator",
  QueryOptimizer = "queryOptimizer",
  ParallelSearchExecutor = "parallelSearchExecutor"
}

/**
 * クエリ洗練に関連するツール名の列挙型
 */
export enum QueryToolName {
  QueryClarifier = "queryClarifier",
  ClarificationProcessor = "clarificationProcessor"
}

/**
 * 検索実行に関連するツール名の列挙型
 */
export enum SearchToolName {
  WebSearchExecutor = "webSearchExecutor",
  SearchResultAnalyzer = "searchResultAnalyzer"
}

/**
 * 情報統合に関連するツール名の列挙型
 */
export enum SynthesisToolName {
  InformationSynthesizer = "informationSynthesizer",
  SummaryGenerator = "summaryGenerator"
}

/**
 * 分析に関連するツール名の列挙型
 * 
 * 注: lib/mastra/agents/tot-research/index.ts では
 * InformationEvaluator, HypothesisGenerator, GapAnalyzer の形式で使用されていますが、
 * analysis-tools.ts では INFORMATION_EVALUATOR 形式で定義されています。
 * ここでは両方のスタイルをサポートしています。
 */
export enum AnalysisToolName {
  // analysis-tools.ts で使用される形式
  INFORMATION_EVALUATOR = "Information Evaluator",
  HYPOTHESIS_GENERATOR = "Hypothesis Generator",
  GAP_ANALYZER = "Gap Analyzer",
  // index.ts で使用される形式
  InformationEvaluator = "informationEvaluator",
  HypothesisGenerator = "hypothesisGenerator",
  GapAnalyzer = "gapAnalyzer"
}

/**
 * インサイトに関連するツール名の列挙型
 * 
 * 注: lib/mastra/agents/tot-research/index.ts では
 * InsightGenerator, StoryBuilder, ConclusionFormer の形式で使用されていますが、
 * insight-tools.ts では INSIGHT_GENERATOR 形式で定義されています。
 * ここでは両方のスタイルをサポートしています。
 */
export enum InsightToolName {
  // insight-tools.ts で使用される形式
  INSIGHT_GENERATOR = "Insight Generator",
  STORY_BUILDER = "Story Builder",
  CONCLUSION_FORMER = "Conclusion Former",
  // index.ts で使用される形式
  InsightGenerator = "insightGenerator",
  StoryBuilder = "storyBuilder",
  ConclusionFormer = "conclusionFormer"
}

/**
 * レポート生成に関連するツール名の列挙型
 */
export enum ReportToolName {
  REPORT_GENERATOR = "Report Generator",
  ReportGenerator = "reportGenerator",
  ReportOptimizer = "reportOptimizer"
}

/**
 * ユーティリティに関連するツール名の列挙型
 */
export enum UtilityToolName {
  QueryClarifier = "queryClarifier",
  ClarificationProcessor = "clarificationProcessor",
  SearchTool = "searchTool"
}

/**
 * すべてのツール名を型として利用するためのユニオン型
 */
export type ToolName = 
  | ThoughtToolName
  | PlanningToolName
  | QueryToolName
  | SearchToolName
  | SynthesisToolName
  | AnalysisToolName
  | InsightToolName
  | ReportToolName
  | UtilityToolName;

/**
 * ツール名とカテゴリーのマッピング
 * 
 * 注: オブジェクトリテラルでの重複プロパティを避けるため、enum値ではなく
 * 文字列定数をキーとして使用しています。
 */
export const toolCategories = {
  // 思考ツール
  thoughtGenerator: "思考生成",
  thoughtEvaluator: "思考評価",
  nextThoughtGenerator: "次の思考生成",
  pathSelector: "パス選択",

  // 計画ツール
  researchPlanGenerator: "計画生成",
  queryOptimizer: "クエリ最適化",
  parallelSearchExecutor: "並列検索実行",

  // クエリツール
  queryClarifier: "クエリ明確化",
  clarificationProcessor: "明確化処理",

  // 検索ツール
  webSearchExecutor: "Web検索",
  searchResultAnalyzer: "検索結果分析",

  // 統合ツール
  informationSynthesizer: "情報統合",
  summaryGenerator: "要約生成",

  // 分析ツール - 両方の命名スタイルをサポート
  "Information Evaluator": "情報評価",
  "Hypothesis Generator": "仮説生成",
  "Gap Analyzer": "情報ギャップ分析",
  informationEvaluator: "情報評価",
  hypothesisGenerator: "仮説生成",
  gapAnalyzer: "情報ギャップ分析",

  // 洞察ツール - 両方の命名スタイルをサポート
  "Insight Generator": "インサイト生成",
  "Story Builder": "ストーリー構築",
  "Conclusion Former": "結論形成",
  insightGenerator: "インサイト生成",
  storyBuilder: "ストーリー構築",
  conclusionFormer: "結論形成",

  // レポートツール
  "Report Generator": "レポート生成",
  reportGenerator: "レポート生成",
  reportOptimizer: "レポート最適化",

  // ユーティリティツール
  searchTool: "検索ツール"
}; 