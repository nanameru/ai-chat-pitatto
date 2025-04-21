/**
 * Tree of Thoughts (ToT) Research Agent の型定義
 */

/**
 * 推論ステップのメタデータ
 */
export interface ReasoningStepMetadata {
  phase: string;
  currentStep: number;
  totalSteps: number;
  toolName?: string;
  subStep?: number;
}

/**
 * 推論ステップ
 */
export interface ReasoningStep {
  id: string;
  timestamp: string;
  type: string;
  title: string;
  content: string;
  metadata: ReasoningStepMetadata;
}

/**
 * ツール呼び出し
 */
export interface ToolCall {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: any;
}

/**
 * ツール実行結果
 */
export interface ToolResult {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: any;
}

/**
 * エージェント生成結果
 */
export interface GenerateResult {
  text?: string; 
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  reasoningSteps?: ReasoningStep[];
  metadata?: any;
  error?: Error;
} 