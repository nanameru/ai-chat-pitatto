/**
 * 推論ステップの型定義
 */
export type ReasoningStep = {
  id: string;
  timestamp: string;
  type: 'tool_start' | 'tool_end' | 'thinking' | 'clarification' | 'planning' | 'research' | 'integration';
  title: string;
  content: string;
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
};
