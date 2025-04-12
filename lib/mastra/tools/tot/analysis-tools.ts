/**
 * Tree of Thoughts (ToT) 情報分析ツール
 * 
 * 収集情報の評価、解釈、ギャップ分析に関するツールを提供します。
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { InformationAnalysis, Hypothesis, InformationGap } from "../../types/tot";

/**
 * 情報評価ツール
 * 
 * 収集された情報の信頼性と関連性を評価します。
 */
export const informationEvaluator = createTool({
  id: "Information Evaluator",
  inputSchema: z.object({
    collectedInformation: z.array(z.object({
      query: z.string(),
      purpose: z.string(),
      results: z.array(z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
        date: z.string().optional()
      }))
    })).describe("評価する収集情報"),
    originalQuery: z.string().describe("元のクエリ"),
  }),
  description: "収集された情報の信頼性と関連性を評価します",
  execute: async ({ context: { collectedInformation, originalQuery } }) => {
    console.log(`[ToT] 情報評価: クエリ=${originalQuery.substring(0, 50)}..., 情報セット数=${collectedInformation.length}`);
    
    try {
      // 情報評価のモック実装
      // 実際の実装では、LLMを使用して情報を評価します
      
      // 情報ソースをカテゴリ分け
      const sourceCategories = {
        highReliability: ["official", "documentation", "academic", "research", "gov", "edu"],
        mediumReliability: ["news", "blog", "review", "tech", "company"],
        lowReliability: ["forum", "social", "anonymous", "personal"]
      };
      
      // 各情報ソースを評価
      const evaluatedSources = collectedInformation.flatMap(infoSet => 
        infoSet.results.map(result => {
          // URLからドメインを抽出
          const domain = new URL(result.url).hostname;
          
          // 信頼性を評価（モック実装）
          let reliability: 'high' | 'medium' | 'low' = 'medium';
          if (sourceCategories.highReliability.some(term => domain.includes(term))) {
            reliability = 'high';
          } else if (sourceCategories.lowReliability.some(term => domain.includes(term))) {
            reliability = 'low';
          }
          
          // 関連性を評価（モック実装）
          // 実際の実装では、クエリと内容の意味的な関連性を評価します
          const relevance = Math.random() * 10; // 0-10のランダムスコア
          
          return {
            ...result,
            reliability,
            relevance,
            purpose: infoSet.purpose
          };
        })
      );
      
      // 信頼性カテゴリごとにソースを分類
      const highReliabilitySources = evaluatedSources
        .filter(source => source.reliability === 'high')
        .map(source => source.title);
      
      const mediumReliabilitySources = evaluatedSources
        .filter(source => source.reliability === 'medium')
        .map(source => source.title);
      
      const lowReliabilitySources = evaluatedSources
        .filter(source => source.reliability === 'low')
        .map(source => source.title);
      
      return {
        evaluatedSources,
        informationEvaluation: {
          highReliabilitySources,
          mediumReliabilitySources,
          lowReliabilitySources
        },
        originalQuery,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`[ToT] 情報評価エラー:`, error);
      throw new Error(`情報評価中にエラーが発生しました: ${error.message}`);
    }
  }
});

/**
 * 仮説生成ツール
 * 
 * 収集情報に基づいて複数の解釈仮説を生成します。
 */
export const hypothesisGenerator = createTool({
  id: "Hypothesis Generator",
  inputSchema: z.object({
    evaluatedSources: z.array(z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
      reliability: z.enum(["high", "medium", "low"]),
      relevance: z.number().optional(),
      purpose: z.string().optional()
    })).describe("評価済みの情報ソース"),
    originalQuery: z.string().describe("元のクエリ"),
    maxHypotheses: z.number().min(1).max(10).default(3).describe("生成する仮説の最大数"),
  }),
  description: "収集情報に基づいて複数の解釈仮説を生成します",
  execute: async ({ context: { evaluatedSources, originalQuery, maxHypotheses } }) => {
    console.log(`[ToT] 仮説生成: クエリ=${originalQuery.substring(0, 50)}..., ソース数=${evaluatedSources.length}`);
    
    try {
      // 仮説生成のモック実装
      // 実際の実装では、LLMを使用して仮説を生成します
      
      // モック仮説を生成
      const hypotheses: Hypothesis[] = [
        {
          statement: "主要な技術的進化は効率性の向上に焦点を当てている",
          supportingEvidence: [
            "複数のソースが効率性の向上を主要な利点として言及している",
            "最新のアップデートは処理速度を50%向上させている",
            "業界リーダーは効率性を主要な差別化要因として強調している"
          ],
          counterEvidence: [
            "一部のユーザーは機能よりも使いやすさを重視している",
            "競合他社は別の側面に焦点を当てている"
          ],
          confidenceScore: 0.85
        },
        {
          statement: "ユーザー体験の向上が最も重要な発展方向である",
          supportingEvidence: [
            "ユーザーフィードバックは一貫してUIの改善を要求している",
            "最新の製品リリースはユーザー体験の向上を強調している",
            "市場調査はユーザー体験が購入決定の主要因子であることを示している"
          ],
          counterEvidence: [
            "技術的な性能がまだ一部のユーザーセグメントでは最優先事項である",
            "コスト効率が一部の市場では依然として決定的な要因である"
          ],
          confidenceScore: 0.75
        },
        {
          statement: "業界は統合と標準化に向かって進化している",
          supportingEvidence: [
            "主要プレーヤーは共通規格の採用を発表している",
            "最近の合併と買収が業界の統合を示している",
            "クロスプラットフォーム互換性が新製品の主要機能になっている"
          ],
          counterEvidence: [
            "一部の企業は依然として独自の規格を推進している",
            "市場の一部セグメントでは特化型ソリューションが好まれている"
          ],
          confidenceScore: 0.65
        }
      ].slice(0, maxHypotheses);
      
      return {
        hypotheses,
        originalQuery,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`[ToT] 仮説生成エラー:`, error);
      throw new Error(`仮説生成中にエラーが発生しました: ${error.message}`);
    }
  }
});

/**
 * 情報ギャップ分析ツール
 * 
 * 未解決の疑問点や情報不足領域を特定します。
 */
export const gapAnalyzer = createTool({
  id: "Gap Analyzer",
  inputSchema: z.object({
    hypotheses: z.array(z.object({
      statement: z.string(),
      supportingEvidence: z.array(z.string()),
      counterEvidence: z.array(z.string()),
      confidenceScore: z.number()
    })).describe("生成された仮説"),
    evaluatedSources: z.array(z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
      reliability: z.enum(["high", "medium", "low"]),
      relevance: z.number().optional(),
      purpose: z.string().optional()
    })).optional().describe("評価済みの情報ソース（オプション）"),
    originalQuery: z.string().describe("元のクエリ"),
    researchPlan: z.object({
      subtopics: z.array(z.string())
    }).optional().describe("リサーチ計画（オプション）"),
  }),
  description: "未解決の疑問点や情報不足領域を特定します",
  execute: async ({ context: { hypotheses, evaluatedSources, originalQuery, researchPlan } }) => {
    console.log(`[ToT] ギャップ分析: クエリ=${originalQuery.substring(0, 50)}..., 仮説数=${hypotheses.length}`);
    
    try {
      // ギャップ分析のモック実装
      // 実際の実装では、LLMを使用してギャップを分析します
      
      // 情報ギャップを特定
      const informationGaps: InformationGap[] = [];
      
      // 仮説の反証から情報ギャップを特定
      hypotheses.forEach(hypothesis => {
        if (hypothesis.counterEvidence.length > 0) {
          // 反証があれば、その点について詳細情報が必要
          informationGaps.push({
            area: `${hypothesis.statement}に関する詳細情報`,
            description: `この仮説には反証があり、より詳細な調査が必要です: ${hypothesis.counterEvidence[0]}`,
            importance: hypothesis.confidenceScore > 0.7 ? 'high' : 'medium',
            additionalQuery: `${originalQuery} ${hypothesis.statement} evidence data`
          });
        }
      });
      
      // リサーチ計画のサブトピックから情報ギャップを特定
      if (researchPlan && researchPlan.subtopics) {
        // 各サブトピックに対する情報の有無を確認
        researchPlan.subtopics.forEach(subtopic => {
          // 情報ソースにサブトピックに関する情報があるかチェック
          const hasInformation = evaluatedSources ? 
            evaluatedSources.some(source => 
              source.title.toLowerCase().includes(subtopic.toLowerCase()) || 
              source.snippet.toLowerCase().includes(subtopic.toLowerCase())
            ) : false;
          
          if (!hasInformation) {
            // 情報がなければ、そのサブトピックについて情報ギャップを追加
            informationGaps.push({
              area: subtopic,
              description: `${subtopic}に関する情報が不足しています。`,
              importance: 'medium',
              additionalQuery: `${originalQuery} ${subtopic} detailed information`
            });
          }
        });
      }
      
      // 追加のギャップを追加（モック）
      informationGaps.push({
        area: "最新の市場データと統計",
        description: "現在の市場シェアと成長率に関する最新データが不足しています。",
        importance: 'high',
        additionalQuery: `${originalQuery} market share statistics latest data`
      });
      
      informationGaps.push({
        area: "実際のユーザー体験と満足度",
        description: "実際のユーザーからのフィードバックと満足度に関するデータが限られています。",
        importance: 'medium',
        additionalQuery: `${originalQuery} user satisfaction reviews feedback`
      });
      
      // 重要度でソート
      const sortedGaps = informationGaps.sort((a, b) => {
        const importanceOrder = { 'high': 0, 'medium': 1, 'low': 2 };
        return importanceOrder[a.importance] - importanceOrder[b.importance];
      });
      
      // 情報分析結果を構築
      const informationAnalysis: InformationAnalysis = {
        informationEvaluation: {
          highReliabilitySources: [],
          mediumReliabilitySources: [],
          lowReliabilitySources: []
        },
        interpretations: hypotheses,
        informationGaps: sortedGaps
      };
      
      return {
        informationAnalysis,
        originalQuery,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`[ToT] ギャップ分析エラー:`, error);
      throw new Error(`ギャップ分析中にエラーが発生しました: ${error.message}`);
    }
  }
});
