import { NextRequest, NextResponse } from 'next/server';
import { deepResearchAgentV2 } from '@/lib/mastra/agents/deep-research-v2';
import crypto from 'crypto';

// 推論ステップを保存するための型定義
type ReasoningStep = {
  id: string;
  timestamp: string;
  type: 'tool_start' | 'tool_end' | 'thinking' | 'clarification' | 'planning' | 'research' | 'integration' | 'additional_search';
  title: string;
  content: string;
};

// セッションデータの型定義
type SessionData = {
  query: string;
  reasoningSteps: ReasoningStep[];
  accumulatedInformation: any[];
  searchIterations: number;
  sectionId?: string;
  sectionName?: string;
  sectionPurpose?: string;
  sectionFocus?: string[];
  missingInformation?: string[];
  confidenceScore?: number;
  requiredInformationTypes?: string[];
};

// ギャップ識別ツールの結果型
interface GapIdentifierResult {
  missingInformation: string[];
  confidenceScore: number;
}

// 検索イテレーション管理ツールの結果型
interface SearchIterationResult {
  shouldContinueSearch: boolean;
}

// セッションデータを保存するためのメモリ（実際の実装ではデータベースを使用することを推奨）
const sessionStore: Record<string, SessionData> = {};

// 推論過程を保存するためのメモリ（実際の実装ではデータベースを使用することを推奨）
const reasoningSteps: Record<string, ReasoningStep[]> = {};

// セッションデータを初期化または取得する関数
function initializeOrGetSession(sessionId: string | null, query: string): { sessionId: string, isNewSession: boolean } {
  const currentSessionId = sessionId || crypto.randomUUID();
  const isNewSession = !sessionId;
  
  if (isNewSession) {
    // 新しいセッションの初期化
    reasoningSteps[currentSessionId] = [];
    sessionStore[currentSessionId] = {
      query,
      reasoningSteps: [],
      accumulatedInformation: [],
      searchIterations: 0,
      sectionId: crypto.randomUUID(),
      sectionName: '主要セクション',
      sectionPurpose: 'ユーザークエリに関する情報収集',
      sectionFocus: [query],
      requiredInformationTypes: []
    };
  }
  
  return { sessionId: currentSessionId, isNewSession };
}

// 追加検索が必要かどうかを判断する関数
async function shouldPerformAdditionalSearch(sessionId: string, currentResponse: string): Promise<boolean> {
  try {
    const sessionData = sessionStore[sessionId];
    if (!sessionData) return false;
    
    // 現在の検索イテレーション数を取得
    const currentIteration = sessionData.searchIterations;
    
    // セクション情報の設定（実際のアプリケーションでは適切に設定する）
    const sectionId = sessionData.sectionId || crypto.randomUUID();
    const sectionName = sessionData.sectionName || '主要セクション';
    const sectionPurpose = sessionData.sectionPurpose || 'ユーザークエリに関する情報収集';
    const sectionFocus = sessionData.sectionFocus || [sessionData.query];
    
    // deepResearchAgentV2とそのツールが存在することを確認
    if (!deepResearchAgentV2 || !deepResearchAgentV2.tools) {
      console.error('Deep Research Agent V2またはそのツールが初期化されていません');
      return false;
    }
    
    // 情報ギャップ特定ツールの存在確認
    const gapIdentifierTool = deepResearchAgentV2.tools.gapIdentifier;
    if (!gapIdentifierTool) {
      console.error('情報ギャップ特定ツールが利用できません');
      return false;
    }
    
    // 情報ギャップを特定
    const gapIdentifierResult: GapIdentifierResult = await (gapIdentifierTool as any).execute({
      context: {
        sectionId,
        sectionName,
        sectionPurpose,
        sectionFocus,
        accumulatedInformation: sessionData?.accumulatedInformation || [],
        requiredInformationTypes: sessionData?.requiredInformationTypes || []
      }
    }) as unknown as GapIdentifierResult;
    
    // 検索イテレーション管理
    const searchIterationTool = deepResearchAgentV2.tools.searchIterationManager;
    if (!searchIterationTool) {
      console.error('検索イテレーション管理ツールが利用できません');
      return false;
    }
    
    // 検索イテレーション管理 (再確認)
    if (!searchIterationTool) {
      // この状況は理論上発生しないはずですが、念のためエラー処理
      console.error('検索イテレーション管理ツールが実行直前に見つかりません');
      // 関数は boolean を返す必要があるため、エラー時は false を返す
      return false;
    }

    const searchIterationResult: SearchIterationResult = await (searchIterationTool as any).execute({
      context: {
        sectionId,
        sectionName,
        currentIteration,
        maxIterations: 3, // 最大検索イテレーション数
        missingInformation: gapIdentifierResult?.missingInformation || [],
        confidenceScore: gapIdentifierResult?.confidenceScore || 0
      }
    }) as unknown as SearchIterationResult;
    
    // セッションデータを更新
    sessionStore[sessionId] = {
      ...sessionData,
      sectionId,
      sectionName,
      sectionPurpose,
      sectionFocus,
      missingInformation: gapIdentifierResult?.missingInformation || [],
      confidenceScore: gapIdentifierResult?.confidenceScore || 0
    };
    
    // 推論ステップに情報ギャップを記録
    addReasoningStep(sessionId, {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'additional_search',
      title: '情報ギャップの特定',
      content: `不足している情報: ${(gapIdentifierResult?.missingInformation || []).join(', ')}\n信頼度スコア: ${(gapIdentifierResult?.confidenceScore || 0).toFixed(2)}`
    });
    
    return searchIterationResult.shouldContinueSearch; 
  } catch (error) {
    console.error('[API] 追加検索判断エラー:', error);
    return false;
  }
}

// 追加検索を実行する関数
async function performAdditionalSearch(sessionId: string): Promise<string> {
  try {
    const sessionData = sessionStore[sessionId];
    if (!sessionData) throw new Error('セッションデータが見つかりません');
    
    // 検索イテレーション数を増加
    sessionData.searchIterations += 1;
    
    // deepResearchAgentV2とそのツールが存在することを確認
    if (!deepResearchAgentV2 || !deepResearchAgentV2.tools || !deepResearchAgentV2.tools.queryGenerator) {
      console.error('Deep Research Agent V2またはクエリ生成ツールが初期化されていません');
      throw new Error('クエリ生成ツールが利用できません');
    }
    
    // 追加検索のための新しいクエリを生成
    const queryGeneratorTool = deepResearchAgentV2.tools.queryGenerator;
    if (!queryGeneratorTool) {
      console.error('クエリ生成ツールが利用できません');
      throw new Error('クエリ生成ツールが利用できません');
    }
    
    const queryGeneratorResult = await (queryGeneratorTool as any).execute({
      context: {
        topic: sessionData.query,
        sectionId: sessionData.sectionId || '',
        sectionName: sessionData.sectionName || '主要セクション',
        sectionPurpose: sessionData.sectionPurpose || 'ユーザークエリに関する情報収集',
        sectionFocus: sessionData.sectionFocus || [sessionData.query],
        missingInformation: sessionData.missingInformation || []
      }
    }) as { queries?: string[] };
    
    // クエリが生成されなかった場合のフォールバック
    const queries = queryGeneratorResult.queries || [sessionData.query];
    
    // 推論ステップに追加検索クエリを記録
    addReasoningStep(sessionId, {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'additional_search',
      title: '追加検索クエリ',
      content: queries.join('\n')
    });
    
    // 追加検索の実行
    // 最初のクエリだけを使用
    const searchQuery = queries[0];
    
    // 検索ツールの存在確認
    const searchTool = deepResearchAgentV2.tools.searchTool;
    if (!searchTool) {
      console.error('検索ツールが利用できません');
      throw new Error('検索ツールが利用できません');
    }
    
    const searchResult = await (searchTool as any).execute({
      context: {
        query: searchQuery
      }
    }) as { query: string; results: Array<{ title: string; snippet: string; url: string }>; timestamp: string };
    
    // 分析ツールの存在確認
    const analysisTool = deepResearchAgentV2.tools.analysisTool;
    if (!analysisTool) {
      console.error('分析ツールが利用できません');
      throw new Error('分析ツールが利用できません');
    }
    
    // 検索結果の分析
    const analysisResult = await (analysisTool as any).execute({
      context: {
        query: searchQuery,
        results: searchResult.results,
        iteration: sessionData.searchIterations,
        maxIterations: 3
      }
    }) as unknown as { missingInformation: string[]; completenessScore: number; isSufficient: boolean; };
    
    // 情報蓄積ツールの存在確認
    const informationAccumulatorTool = deepResearchAgentV2.tools.informationAccumulator;
    if (!informationAccumulatorTool) {
      console.error('情報蓄積ツールが利用できません');
      throw new Error('情報蓄積ツールが利用できません');
    }
    
    // 情報の蓄積
    const accumulatorResult = await (informationAccumulatorTool as any).execute({
      context: {
        sectionId: sessionData.sectionId || '',
        sectionName: sessionData.sectionName || '主要セクション',
        searchResults: searchResult.results,
        existingInformation: sessionData.accumulatedInformation || []
      }
    }) as unknown as { accumulatedInformation: any[]; informationStats: any; timestamp: string };
    
    // セッションデータを更新
    sessionStore[sessionId] = {
      ...sessionData,
      accumulatedInformation: accumulatorResult?.accumulatedInformation || sessionData.accumulatedInformation || [],
    };
    
    // 推論ステップに検索結果を記録
    addReasoningStep(sessionId, {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'additional_search',
      title: '追加検索結果',
      content: `検索結果数: ${searchResult.results?.length || 0}件`
    });
    
    // 最終的な結果を生成
    const finalResponse = await deepResearchAgentV2.generate(
      `元のクエリ: ${sessionData.query}\n\n` +
      `これまでに収集した情報: ${JSON.stringify(accumulatorResult?.accumulatedInformation || [])}\n\n` +
      `最終的な回答を生成してください。`
    );
    
    return finalResponse.text;
  } catch (error) {
    console.error('[API] 追加検索実行エラー:', error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { query, sessionId, clarificationResponse, mode } = await req.json();
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'クエリが指定されていないか、無効な形式です' },
        { status: 400 }
      );
    }
    
    // セッションの初期化または取得
    const { sessionId: currentSessionId, isNewSession } = initializeOrGetSession(sessionId, query);
    
    console.log(`[API] Deep Research Agent実行開始 (${mode || 'initial'}):`, query);
    
    // 推論ステップに初期クエリを追加
    addReasoningStep(currentSessionId, {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'thinking',
      title: '初期クエリ',
      content: `ユーザーからのクエリ: ${query}`
    });
    
    // 初期セッションデータは初期化関数で設定済み
    
    // Deep Research Agent V2を実行
    const response = await deepResearchAgentV2.generate(
      clarificationResponse ? 
        `元のクエリ: ${query}\n\nユーザーの回答: ${clarificationResponse}` : 
        query
    );
    
    // 推論ステップを記録
    addReasoningStep(currentSessionId, {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'integration',
      title: 'Deep Research結果',
      content: response.text
    });
    
    console.log('[API] Deep Research Agent実行完了');
    
    // 明確化が必要かどうかをチェック
    const needsClarification = checkForClarification(response.text, currentSessionId);
    
    let finalResult = response.text;
    let additionalSearchPerformed = false;
    
    // 明確化が不要で、Deep Researchモードの場合は追加検索を検討
    if (!needsClarification && mode === 'deep') {
      // 追加検索が必要かどうかを判断
      const needsAdditionalSearch = await shouldPerformAdditionalSearch(currentSessionId, response.text);
      
      if (needsAdditionalSearch) {
        console.log('[API] 追加検索を実行します');
        additionalSearchPerformed = true;
        
        // 追加検索を実行
        finalResult = await performAdditionalSearch(currentSessionId);
        
        // 最終結果を記録
        addReasoningStep(currentSessionId, {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          type: 'integration',
          title: '追加検索後の最終結果',
          content: finalResult
        });
      }
    }
    
    // 最終的な推論ステップを追加
    addReasoningStep(currentSessionId, {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'thinking',
      title: '最終結果',
      content: needsClarification ? '明確化が必要です' : 
               additionalSearchPerformed ? '追加検索完了' : '調査完了'
    });
    
    return NextResponse.json({
      success: true,
      result: finalResult,
      sessionId: currentSessionId,
      reasoningSteps: reasoningSteps[currentSessionId],
      needsClarification,
      additionalSearchPerformed
    });
  } catch (error) {
    console.error('[API] Deep Research Agent実行エラー:', error);
    return NextResponse.json(
      { error: 'Deep Research Agentの実行中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

// 推論ステップを追加する関数
function addReasoningStep(sessionId: string, step: ReasoningStep) {
  if (!reasoningSteps[sessionId]) {
    reasoningSteps[sessionId] = [];
  }
  reasoningSteps[sessionId].push(step);
  console.log(`[Reasoning] ${step.type}: ${step.title}`);
}

// 明確化が必要かどうかをチェックする関数
function checkForClarification(text: string, sessionId: string): boolean {
  // テキストに明確化を求める質問が含まれているかチェック
  const clarificationPhrases = [
    'どのような情報をお求めでしょうか',
    '以下のような観点を教えていただけると',
    'どの観点で深掘りすればよいか',
    '詳細を教えていただけますか',
    '具体的に知りたい点はありますか'
  ];
  
  const hasClarificationPhrase = clarificationPhrases.some(phrase => text.includes(phrase));
  
  // 推論ステップに明確化ステップが含まれているかチェック
  const hasClarificationStep = reasoningSteps[sessionId]?.some(step => step.type === 'clarification');
  
  return hasClarificationPhrase || hasClarificationStep;
}

// ステップのタイトルを取得する関数
function getStepTitle(toolName: string, stepType: ReasoningStep['type']): string {
  switch (stepType) {
    case 'clarification':
      return 'クエリの明確化';
    case 'planning':
      if (toolName.includes('outline')) return 'アウトライン作成';
      if (toolName.includes('section')) return 'セクション計画';
      if (toolName.includes('review')) return '計画レビュー';
      return '計画段階';
    case 'research':
      if (toolName.includes('query')) return '検索クエリ生成';
      if (toolName.includes('search')) return '情報検索';
      return '調査段階';
    case 'integration':
      if (toolName.includes('content')) return 'コンテンツ生成';
      if (toolName.includes('integration')) return '情報統合';
      return '統合段階';
    default:
      return '思考プロセス';
  }
}

// ステップの内容を取得する関数
function getStepContent(toolName: string, result: any, stepType: ReasoningStep['type']): string {
  try {
    // ツール名と結果に基づいて適切な内容を抽出
    if (toolName === 'queryClarifier' && result.message) {
      return result.message;
    }
    
    if (toolName === 'outlineGenerator' && result.outline) {
      return result.outline;
    }
    
    if (toolName === 'sectionPlanner' && result.sections) {
      return JSON.stringify(result.sections, null, 2);
    }
    
    if (toolName.includes('query') && result.queries) {
      return result.queries.join('\n');
    }
    
    // デフォルトは結果をJSON文字列として返す
    return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  } catch (error) {
    console.error('ステップ内容の抽出エラー:', error);
    return '内容を抽出できませんでした';
  }
}
