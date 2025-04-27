/**
 * 推論ステップの型定義
 */
export type ReasoningStep = {
  id: string;
  timestamp: string;
  type: 'tool_start' | 'tool_end' | 'thinking' | 'clarification' | 'planning' | 'research' | 'integration' | 
        'thought_generation' | 'thought_evaluation' | 'path_selection' | 'research_plan' | 'query_optimization' | 
        'information_gathering' | 'information_analysis' | 'insight_generation' | 'report_generation' |
        'insight' | 'analysis' | 'hypothesis' | 'gap' | 'report';
  title: string;
  content: string;
  metadata?: {
    toolName?: string;
    phase?: string;
    totalSteps?: number;
    currentStep?: number;
    sources?: Array<{
      title: string;
      url: string;
    }>;
    evaluatedSources?: Array<{
      title: string;
      url: string;
      snippet: string;
      reliability: 'high' | 'medium' | 'low';
      relevance: number;
    }>;
    hypotheses?: Array<{
      statement: string;
      supportingEvidence: string[];
      counterEvidence: string[];
      confidenceScore: number;
    }>;
    informationGaps?: Array<{
      area: string;
      description: string;
      importance: 'high' | 'medium' | 'low';
      additionalQuery: string;
    }>;
  };
};

/**
 * Deep Research APIレスポンスの型定義
 */
export type DeepResearchResponse = {
  success: boolean;
  result: string;
  sessionId: string;
  reasoningSteps: ReasoningStep[];
  needsClarification: boolean;
  error?: string;
  phaseCompletion?: {
    planning: boolean;
    gathering: boolean;
    analysis: boolean;
    insight: boolean;
    report: boolean;
  };
  totResults?: {
    thoughtProcess?: string | any;
    researchPlan?: {
      topic?: string;
      subtopics?: string[];
    } | string;
    evaluatedSources?: any[];
    informationEvaluation?: {
      highReliabilitySources?: any[];
      mediumReliabilitySources?: any[];
      lowReliabilitySources?: any[];
    };
    hypotheses?: any[];
    informationAnalysis?: {
      informationGaps?: any[];
    };
    insights?: any[];
    finalReport?: string | any;
  };
};
