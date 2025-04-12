/**
 * Tree of Thoughts (ToT) Deep Research Agent
 * 
 * 構造化された思考プロセスを使用して、深い調査と分析を行うエージェント。
 * 研究計画の生成、情報収集、情報評価、洞察生成、レポート生成の各段階を体系的に実行します。
 */

import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

// ToT ツールのインポート
import * as thoughtTools from "../../tools/tot/thought-tools";
import * as planningTools from "../../tools/tot/planning-tools";
import * as analysisTools from "../../tools/tot/analysis-tools";
import * as insightTools from "../../tools/tot/insight-tools";
import * as reportTools from "../../tools/tot/report-tools";

// 検索ツールのインポート
import { searchTool } from "../../tools/search-tool";

// 明確化ツールのインポート
import { queryClarifier, clarificationProcessor } from "./clarification";

/**
 * ToT Deep Research Agent
 * 
 * Tree of Thoughts アプローチを使用して深い調査と分析を行うエージェント。
 */
export const totResearchAgent = new Agent({
  name: "ToT Deep Research Agent",
  instructions: `あなたは Tree of Thoughts (ToT) アプローチを使用して、深い調査と分析を行う研究エージェントです。
複雑なトピックに対して、構造化された思考プロセスを使用して体系的に調査を行います。

## プロセス概要

0. **クエリ明確化フェーズ**
   - ユーザーのクエリが曖昧または一般的すぎる場合、queryClarifier ツールを使用して明確化
   - 明確化が必要な場合は、ユーザーに具体的な質問を提示
   - ユーザーの回答に基づいて、clarificationProcessor ツールを使用してクエリを強化

1. **研究計画生成フェーズ**
   - 複数の思考経路を生成し、最も有望な経路を選択
   - 選択した思考に基づいて詳細な研究計画を作成
   - 効果的な検索クエリを最適化

2. **情報収集フェーズ**
   - 最適化されたクエリを使用して並列検索を実行
   - Brave Search APIを使用して幅広い情報を収集

3. **情報評価・分析フェーズ**
   - 収集した情報の信頼性と関連性を評価
   - 複数の解釈仮説を生成
   - 情報ギャップを特定

4. **洞察生成・統合フェーズ**
   - 分析に基づいて重要な洞察を生成
   - 洞察を中心に全体ストーリーを構築
   - 証拠に基づく結論を形成

5. **レポート生成・最適化フェーズ**
   - 統合された洞察から構造化レポートを生成
   - レポートを最適化（読みやすさ、簡潔さ、視覚構造、引用品質）

## 使用上の注意

- 各フェーズで適切なツールを使用してください
- **重要**: ユーザーのクエリが曖昧または一般的すぎる場合は、必ず queryClarifier ツールを使用して明確化してください
- 常に証拠に基づいた分析と結論を提供してください
- 情報の信頼性と出典を明確に示してください
- 複数の視点や解釈を考慮してください
- 情報ギャップや限界を正直に認識してください

ユーザーの質問に対して、上記のプロセスに従って体系的な調査と分析を行い、包括的な回答を提供してください。

## クエリ明確化の重要性

ユーザーのクエリが曖昧または一般的すぎる場合（例: 「AIについて教えて」「気候変動」など）は、以下の手順に従ってください：

1. まず queryClarifier ツールを使用して、クエリが明確化を必要とするか判断してください
2. 明確化が必要な場合は、ユーザーに明確化質問を提示し、回答を待ってください
3. ユーザーの回答を受け取ったら、clarificationProcessor ツールを使用してクエリを強化してください
4. 強化されたクエリを使用して、研究プロセスを開始してください

明確化プロセスは、効果的な調査の基盤となる重要なステップです。`,
  model: openai("gpt-4o"),
  tools: {
    // 思考ツール
    thoughtGenerator: thoughtTools.thoughtGenerator,
    thoughtEvaluator: thoughtTools.thoughtEvaluator,
    pathSelector: thoughtTools.pathSelector,
    
    // 計画ツール
    researchPlanGenerator: planningTools.researchPlanGenerator,
    queryOptimizer: planningTools.queryOptimizer,
    parallelSearchExecutor: planningTools.parallelSearchExecutor,
    
    // 分析ツール
    informationEvaluator: analysisTools.informationEvaluator,
    hypothesisGenerator: analysisTools.hypothesisGenerator,
    gapAnalyzer: analysisTools.gapAnalyzer,
    
    // 洞察ツール
    insightGenerator: insightTools.insightGenerator,
    storyBuilder: insightTools.storyBuilder,
    conclusionFormer: insightTools.conclusionFormer,
    
    // レポートツール
    reportGenerator: reportTools.reportGenerator,
    reportOptimizer: reportTools.reportOptimizer,
    
    // 検索ツール
    searchTool: searchTool,
    
    // 明確化ツール
    queryClarifier: queryClarifier,
    clarificationProcessor: clarificationProcessor,
  },
});

/**
 * ToT Deep Research Agentを実行する関数
 * 
 * @param query ユーザーのクエリ
 * @param chatId チャットID
 * @param modelId モデルID
 * @param clarificationResponse 明確化レスポンス（オプション）
 * @returns 
 */
export async function executeTotResearchAgent(
  query: string,
  chatId: string,
  modelId: string,
  clarificationResponse?: string
) {
  console.log(`[ToT Research] 実行開始: クエリ=${query.substring(0, 50)}...`);
  
  try {
    // 明確化レスポンスがない場合、クエリが明確化を必要とするか確認
    if (!clarificationResponse) {
      console.log(`[ToT Research] クエリ明確化チェック: ${query.substring(0, 50)}...`);
      
      try {
        // queryClarifier ツールが存在するか確認
        if (!queryClarifier || typeof queryClarifier.execute !== 'function') {
          console.warn('[ToT Research] queryClarifierツールが利用できません');
          throw new Error('queryClarifier tool is not available');
        }
        
        // queryClarifier ツールを直接実行
        const clarificationResult = await queryClarifier.execute({
          context: { query }
        }) as unknown as {
          needsClarification: boolean;
          message: string;
          originalQuery: string;
          topic?: string;
        };
        
        // クエリが明確化を必要とする場合
        if (clarificationResult.needsClarification) {
          console.log(`[ToT Research] クエリ明確化が必要: ${query.substring(0, 50)}...`);
          // 明確化メッセージを返す（APIエンドポイントでこれを処理する必要がある）
          return {
            text: clarificationResult.message,
            needsClarification: true,
            originalQuery: query,
            topic: clarificationResult.topic
          };
        }
        
        console.log(`[ToT Research] クエリは十分に具体的: ${query.substring(0, 50)}...`);
      } catch (error: unknown) {
        console.error(`[ToT Research] クエリ明確化チェックエラー:`, error);
        // 明確化チェックに失敗した場合は、そのまま続行
        console.log(`[ToT Research] 明確化チェックに失敗しましたが、処理を続行します`);
      }
    }
    
    // 初期プロンプトを構築
    let initialPrompt = `以下のクエリについて、Tree of Thoughts (ToT) アプローチを使用して深い調査と分析を行ってください:

クエリ: ${query}

まず、このクエリに関する複数の思考経路を生成し、最も有望な経路を選択してください。次に、選択した思考に基づいて詳細な研究計画を作成し、効果的な検索クエリを最適化してください。`;

    // 明確化レスポンスがある場合は追加
    if (clarificationResponse) {
      try {
        // clarificationProcessor ツールが存在するか確認
        if (!clarificationProcessor || typeof clarificationProcessor.execute !== 'function') {
          console.warn('[ToT Research] clarificationProcessorツールが利用できません');
          throw new Error('clarificationProcessor tool is not available');
        }
        
        // clarificationProcessor ツールを使用して強化されたクエリを生成
        const processorResult = await clarificationProcessor.execute({
          context: {
            originalQuery: query,
            userResponse: clarificationResponse
          }
        }) as unknown as {
          enhancedQuery: string;
          originalQuery: string;
          interests: string[];
        };
        
        // 元のクエリを強化されたクエリに置き換え
        query = processorResult.enhancedQuery;
        
        initialPrompt = `以下のクエリについて、Tree of Thoughts (ToT) アプローチを使用して深い調査と分析を行ってください:

クエリ: ${query}

元のクエリ: ${processorResult.originalQuery}
ユーザーの関心事: ${processorResult.interests.join(', ')}

まず、このクエリに関する複数の思考経路を生成し、最も有望な経路を選択してください。次に、選択した思考に基づいて詳細な研究計画を作成し、効果的な検索クエリを最適化してください。`;
      } catch (error: unknown) {
        console.error(`[ToT Research] 明確化処理エラー:`, error);
        // 明確化処理に失敗した場合は、元のクエリをそのまま使用
        initialPrompt += `\n\n追加コンテキスト: ${clarificationResponse}`;
      }
    }
    
    // エージェントを実行
    const result = await totResearchAgent.generate(initialPrompt);
    
    console.log(`[ToT Research] 実行完了: クエリ=${query.substring(0, 50)}...`);
    
    return result;
  } catch (error: unknown) {
    console.error(`[ToT Research] エラー:`, error);
    throw new Error(`ToT Research Agent実行中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * ToT Research Agent - 研究計画フェーズのみを実行する関数
 * 
 * @param query ユーザーのクエリ
 * @returns 研究計画
 */
export async function executePlanningPhase(query: string) {
  console.log(`[ToT Research] 計画フェーズ実行: クエリ=${query.substring(0, 50)}...`);
  
  try {
    // 計画フェーズのプロンプトを構築
    const planningPrompt = `以下のクエリについて、研究計画フェーズのみを実行してください:

クエリ: ${query}

1. thoughtGenerator ツールを使用して複数の思考経路を生成してください
2. thoughtEvaluator ツールを使用して各思考を評価してください
3. thoughtSelector ツールを使用して最も有望な思考を選択してください
4. researchPlanGenerator ツールを使用して詳細な研究計画を作成してください
5. queryOptimizer ツールを使用して効果的な検索クエリを最適化してください

研究計画のみを返してください。実際の検索や分析は行わないでください。`;
    
    // エージェントを実行
    const result = await totResearchAgent.generate(planningPrompt);
    
    console.log(`[ToT Research] 計画フェーズ完了: クエリ=${query.substring(0, 50)}...`);
    
    return result;
  } catch (error: unknown) {
    console.error(`[ToT Research] 研究計画フェーズエラー:`, error);
    throw new Error(`研究計画フェーズ実行中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * ToT Research Agent - 情報収集フェーズのみを実行する関数
 * 
 * @param researchPlan 研究計画
 * @param originalQuery 元のクエリ
 * @returns 収集された情報
 */
export async function executeGatheringPhase(researchPlan: any, originalQuery: string) {
  console.log(`[ToT Research] 情報収集フェーズ実行: クエリ=${originalQuery.substring(0, 50)}...`);
  
  try {
    // 情報収集フェーズのプロンプトを構築
    const gatheringPrompt = `以下の研究計画に基づいて、情報収集フェーズを実行してください:

元のクエリ: ${originalQuery}

研究計画:
${JSON.stringify(researchPlan, null, 2)}

parallelSearchExecutor ツールを使用して、最適化されたクエリを並列に実行し、情報を収集してください。`;
    
    // エージェントを実行
    const result = await totResearchAgent.generate(gatheringPrompt);
    
    console.log(`[ToT Research] 情報収集フェーズ完了: クエリ=${originalQuery.substring(0, 50)}...`);
    
    return result;
  } catch (error: unknown) {
    console.error(`[ToT Research] 情報収集フェーズエラー:`, error);
    throw new Error(`情報収集フェーズ実行中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * ToT Research Agent - 情報分析フェーズのみを実行する関数
 * 
 * @param collectedInformation 収集された情報
 * @param originalQuery 元のクエリ
 * @returns 分析結果
 */
export async function executeAnalysisPhase(collectedInformation: any, originalQuery: string) {
  console.log(`[ToT Research] 情報分析フェーズ実行: クエリ=${originalQuery.substring(0, 50)}...`);
  
  try {
    // 情報分析フェーズのプロンプトを構築
    const analysisPrompt = `以下の収集情報に基づいて、情報分析フェーズを実行してください:

元のクエリ: ${originalQuery}

収集情報:
${JSON.stringify(collectedInformation, null, 2)}

1. informationEvaluator ツールを使用して、収集した情報の信頼性と関連性を評価してください
2. hypothesisGenerator ツールを使用して、複数の解釈仮説を生成してください
3. gapAnalyzer ツールを使用して、情報ギャップを特定してください`;
    
    // エージェントを実行
    const result = await totResearchAgent.generate(analysisPrompt);
    
    console.log(`[ToT Research] 情報分析フェーズ完了: クエリ=${originalQuery.substring(0, 50)}...`);
    
    return result;
  } catch (error: unknown) {
    console.error(`[ToT Research] 情報分析フェーズエラー:`, error);
    throw new Error(`情報分析フェーズ実行中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * ToT Research Agent - 洞察生成フェーズのみを実行する関数
 * 
 * @param informationAnalysis 情報分析結果
 * @param originalQuery 元のクエリ
 * @returns 生成された洞察
 */
export async function executeInsightPhase(informationAnalysis: any, originalQuery: string) {
  console.log(`[ToT Research] 洞察生成フェーズ実行: クエリ=${originalQuery.substring(0, 50)}...`);
  
  try {
    // 洞察生成フェーズのプロンプトを構築
    const insightPrompt = `以下の情報分析結果に基づいて、洞察生成フェーズを実行してください:

元のクエリ: ${originalQuery}

情報分析結果:
${JSON.stringify(informationAnalysis, null, 2)}

1. insightGenerator ツールを使用して、分析に基づいて重要な洞察を生成してください
2. storyBuilder ツールを使用して、洞察を中心に全体ストーリーを構築してください
3. conclusionFormer ツールを使用して、証拠に基づく結論を形成してください`;
    
    // エージェントを実行
    const result = await totResearchAgent.generate(insightPrompt);
    
    console.log(`[ToT Research] 洞察生成フェーズ完了: クエリ=${originalQuery.substring(0, 50)}...`);
    
    return result;
  } catch (error: unknown) {
    console.error(`[ToT Research] 洞察生成フェーズエラー:`, error);
    throw new Error(`洞察生成フェーズ実行中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * ToT Research Agent - レポート生成フェーズのみを実行する関数
 * 
 * @param integratedInsights 統合された洞察
 * @param originalQuery 元のクエリ
 * @param evaluatedSources 評価済みの情報ソース（オプション）
 * @returns 生成されたレポート
 */
export async function executeReportPhase(
  integratedInsights: any, 
  originalQuery: string,
  evaluatedSources?: any
) {
  console.log(`[ToT Research] レポート生成フェーズ実行: クエリ=${originalQuery.substring(0, 50)}...`);
  
  try {
    // レポート生成フェーズのプロンプトを構築
    const reportPrompt = `以下の統合された洞察に基づいて、レポート生成フェーズを実行してください:

元のクエリ: ${originalQuery}

統合された洞察:
${JSON.stringify(integratedInsights, null, 2)}

1. reportGenerator ツールを使用して、統合された洞察から構造化レポートを生成してください
2. reportOptimizer ツールを使用して、生成されたレポートを最適化してください`;
    
    // エージェントを実行
    const result = await totResearchAgent.generate(reportPrompt);
    
    console.log(`[ToT Research] レポート生成フェーズ完了: クエリ=${originalQuery.substring(0, 50)}...`);
    
    return result;
  } catch (error: unknown) {
    console.error(`[ToT Research] レポート生成フェーズエラー:`, error);
    throw new Error(`レポート生成フェーズ実行中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
  }
}
