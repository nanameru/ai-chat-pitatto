import { Step, Workflow } from '@mastra/core/workflows';
import { createLogger } from '@mastra/core/logger';
import { z } from 'zod';

// ロガー設定
const logger = createLogger({ name: 'content-generation-workflow', level: 'info' });

// Helper functions (simulated)
function generateInitialDraft(input: string = '') {
  return {
    content: `Generated content based on: ${input}`,
    confidenceScore: 0.6, // Simulate low confidence to trigger suspension
  };
}

function enhanceWithGuidance(content: string = '', guidance: string = '') {
  return `${content} (Enhanced with guidance: ${guidance})`;
}

function makeMinorImprovements(content: string = '') {
  return `${content} (with minor improvements)`;
}

function calculateToneScore(_: string = '') {
  return 0.7; // Simulate a score that will trigger suspension
}

function calculateCompletenessScore(_: string = '') {
  return 0.9;
}

// Step 1: Get user input
const getUserInput = new Step({
  id: 'getUserInput',
  description: 'ワークフロー開始時の入力テキストを取得します',
  execute: async ({ context }) => {
    const input = context.triggerData.input;
    logger.info('ステップ1: ユーザー入力を取得', { input });
    return { userInput: input };
  },
  outputSchema: z.object({ userInput: z.string() }),
});

// Step 2: Generate content with AI (may suspend for human guidance)
const promptAgent = new Step({
  id: 'promptAgent',
  description: 'AIで初期ドラフトを生成し、ガイダンスが必要なら一時停止します',
  inputSchema: z.object({ guidance: z.string() }).optional(),
  outputSchema: z.object({ modelOutput: z.string() }).optional(),
  execute: async ({ context, suspend }) => {
    const userInput = context.getStepResult(getUserInput)?.userInput || '';
    logger.info('ステップ2: 初期ドラフトを生成', { userInput });
    const initialDraft = generateInitialDraft(userInput);
    logger.info('初期ドラフトの内容', initialDraft);
    
    if (initialDraft.confidenceScore > 0.7) {
      logger.info('ドラフトの自信度高いのでそのまま進行');
      return { modelOutput: initialDraft.content };
    }
    
    logger.warn('ドラフトの自信度低いため一時停止', { confidenceScore: initialDraft.confidenceScore });
    await suspend({ content: initialDraft.content });
    return undefined;
  },
});

// Step 3: Evaluate the content quality
const evaluateTone = new Step({
  id: 'evaluateToneConsistency',
  description: '生成コンテンツのトーンと完全性を評価します',
  outputSchema: z.object({ toneScore: z.any(), completenessScore: z.any() }),
  execute: async ({ context }) => {
    const content = context.getStepResult(promptAgent)?.modelOutput || '';
    logger.info('ステップ3: コンテンツ品質を評価', { content });
    const toneScore = calculateToneScore(content);
    const completenessScore = calculateCompletenessScore(content);
    logger.info('評価結果', { toneScore, completenessScore });
    return {
      toneScore: { score: toneScore },
      completenessScore: { score: completenessScore },
    };
  },
});

// Step 4: Improve response if needed (may suspend)
const improveResponse = new Step({
  id: 'improveResponse',
  description: '必要に応じて人の改善を待機し、改善内容を適用します',
  inputSchema: z.object({ improvedContent: z.string(), resumeAttempts: z.number() }).optional(),
  outputSchema: z.object({ improvedOutput: z.string() }).optional(),
  execute: async ({ context, suspend }) => {
    const content = context.getStepResult(promptAgent)?.modelOutput || '';
    const toneScore = context.getStepResult(evaluateTone)?.toneScore.score || 0;
    const completenessScore = context.getStepResult(evaluateTone)?.completenessScore.score || 0;
    const improvedContent = context.inputData?.improvedContent;
    const resumeAttempts = context.inputData?.resumeAttempts || 0;

    logger.info('ステップ4: 改善の必要性をチェック', { toneScore, completenessScore, resumeAttempts });
    
    if (toneScore > 0.8 && completenessScore > 0.8) {
      const minor = makeMinorImprovements(content);
      logger.info('スコア十分、高度な改善を適用', { minor });
      return { improvedOutput: minor };
    }
    
    if (!improvedContent) {
      const payload = { content, scores: { tone: toneScore, completeness: completenessScore }, resumeAttempts: resumeAttempts + 1 };
      logger.warn('改善内容待機のため一時停止', payload);
      await suspend(payload);
      return undefined;
    }
    
    logger.info('人手改善を適用', { improvedContent });
    return { improvedOutput: improvedContent };
  },
});

// Step 5: Final evaluation
const evaluateImproved = new Step({
  id: 'evaluateImprovedResponse',
  description: '最終的に改善されたコンテンツの評価を行います',
  outputSchema: z.object({ toneScore: z.any(), completenessScore: z.any() }),
  execute: async ({ context }) => {
    const improved = context.getStepResult(improveResponse)?.improvedOutput || '';
    logger.info('ステップ5: 最終評価を実行', { improved });
    const finalTone = calculateToneScore(improved);
    const finalComplete = calculateCompletenessScore(improved);
    logger.info('最終評価結果', { finalTone, finalComplete });
    return {
      toneScore: { score: finalTone },
      completenessScore: { score: finalComplete },
    };
  },
});

// ワークフローの作成
export const contentGenerationWorkflow = new Workflow({
  name: 'content-generation-workflow',
  triggerSchema: z.object({ input: z.string() }),
});

contentGenerationWorkflow
  .step(getUserInput)
  .then(promptAgent)
  .then(evaluateTone)
  .then(improveResponse)
  .then(evaluateImproved)
  .commit(); 