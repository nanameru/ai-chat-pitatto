/**
 * Tree of Thoughts (ToT) アプローチのための型定義
 * 
 * このファイルには、ToTアプローチで使用される各種データ構造の型定義が含まれています。
 */

/**
 * 思考（Thought）の基本構造
 * 
 * 思考木の各ノードを表します。
 */
export interface Thought {
  id: string;
  content: string;
  parentId?: string;
  score?: number;
  confidence?: number;
  evidence?: string[];
  metadata?: any;
  children?: Thought[];
}

/**
 * 思考評価の結果
 */
export interface EvaluatedThought extends Thought {
  score: number;
  evaluationCriteria: {
    [criteriaName: string]: number;
  };
  reasoning: string;
}

/**
 * リサーチ計画の構造
 */
export interface ResearchPlan {
  approach: string;
  description: string;
  subtopics: string[];
  queries: ResearchQuery[];
  reasoning?: string;
}

/**
 * 検索クエリの構造
 */
export interface ResearchQuery {
  query: string;
  purpose: string;
  queryType: 'general' | 'specific' | 'technical';
  priority?: number;
}

/**
 * 収集された情報の構造
 */
export interface InformationItem {
  source: string;
  title: string;
  url: string;
  snippet: string;
  date?: string;
  reliability?: 'high' | 'medium' | 'low';
  relevance?: number;
}

/**
 * 収集情報のコレクション
 */
export interface CollectedInformation {
  query: string;
  purpose: string;
  results: InformationItem[];
  timestamp: string;
}

/**
 * 解釈仮説の構造
 */
export interface Hypothesis {
  statement: string;
  supportingEvidence: string[];
  counterEvidence: string[];
  confidenceScore: number;
  reasoning?: string;
}

/**
 * 情報ギャップの構造
 */
export interface InformationGap {
  area: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  additionalQuery?: string;
}

/**
 * 情報分析結果の構造
 */
export interface InformationAnalysis {
  informationEvaluation: {
    highReliabilitySources: string[];
    mediumReliabilitySources: string[];
    lowReliabilitySources: string[];
  };
  interpretations: Hypothesis[];
  informationGaps: InformationGap[];
}

/**
 * 洞察の構造
 */
export interface Insight {
  title: string;
  description: string;
  evidenceStrength: 'strong' | 'moderate' | 'weak';
  supportingFacts: string[];
  implications?: string[];
}

/**
 * ストーリー構造の定義
 */
export interface NarrativeStructure {
  approach: string;
  mainSections: string[];
  flowDescription?: string;
}

/**
 * 結論の構造
 */
export interface Conclusion {
  statement: string;
  confidenceLevel: 'high' | 'medium' | 'low';
  supportingEvidence: string[];
  limitations: string[];
}

/**
 * 知見統合結果の構造
 */
export interface IntegratedInsights {
  keyInsights: Insight[];
  narrativeStructure: NarrativeStructure;
  conclusions: Conclusion[];
}

/**
 * 最終レポートの構造
 */
export interface FinalReport {
  title: string;
  summary: string;
  sections: ReportSection[];
  sources: ReportSource[];
  generatedAt: string;
}

/**
 * レポートセクションの構造
 */
export interface ReportSection {
  title: string;
  content: string;
  subsections?: ReportSection[];
}

/**
 * レポートソースの構造
 */
export interface ReportSource {
  title: string;
  url: string;
  accessedDate: string;
  reliability: 'high' | 'medium' | 'low';
}

/**
 * ToT進捗データの構造
 */
export interface TotProgressData {
  stage: string;
  message: string;
  data?: any;
}

/**
 * ToTステージの定義
 */
export enum TotStage {
  PLANNING = 'planning',
  INFORMATION_GATHERING = 'information_gathering',
  ANALYSIS = 'analysis',
  INSIGHT_GENERATION = 'insight_generation',
  REPORT_GENERATION = 'report_generation'
}
