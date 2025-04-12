/**
 * Tree of Thoughts (ToT) 研究ワークフロー
 * 
 * 構造化された思考プロセスを使用して、深い調査と分析を行うワークフロー。
 * 研究計画の生成、情報収集、情報評価、洞察生成、レポート生成の各段階を体系的に実行します。
 */

import { Step, Workflow } from "@mastra/core/workflows";
import { z } from "zod";

// ToT Research Agent関数のインポート
import {
  executePlanningPhase,
  executeGatheringPhase,
  executeAnalysisPhase,
  executeInsightPhase,
  executeReportPhase
} from "../agents/tot-research";

/**
 * 研究計画生成ステップ
 * 
 * 複数の思考経路を生成し、最も有望な経路を選択して詳細な研究計画を作成します。
 */
const planningStep = new Step({
  id: "planningStep",
  inputSchema: z.object({
    query: z.string().describe("ユーザーのクエリ"),
    clarificationResponse: z.string().optional().describe("明確化レスポンス（オプション）")
  }),
  outputSchema: z.object({
    researchPlan: z.object({
      selectedThought: z.string(),
      subtopics: z.array(z.string()),
      optimizedQueries: z.array(z.object({
        query: z.string(),
        purpose: z.string()
      }))
    }),
    originalQuery: z.string()
  }),
  execute: async ({ context }) => {
    // トリガーからクエリを取得
    const query = context?.getStepResult<{
      query: string;
      clarificationResponse?: string;
    }>("trigger")?.query;
    
    const clarificationResponse = context?.getStepResult<{
      query: string;
      clarificationResponse?: string;
    }>("trigger")?.clarificationResponse;
    
    if (!query) {
      throw new Error("クエリが指定されていません");
    }
    
    console.log(`[ToT Workflow] 計画ステップ実行: クエリ=${query.substring(0, 50)}...`);
    
    // 計画フェーズを実行
    const result = await executePlanningPhase(query);
    
    // 結果からresearchPlanを抽出
    // 実際の実装では、LLMの応答から構造化データを抽出する処理が必要
    // ここではモックの研究計画を返す
    const researchPlan = {
      selectedThought: "主要な技術的進化とその影響を包括的に分析する",
      subtopics: [
        "最新の技術トレンド",
        "業界への影響",
        "将来の展望",
        "主要プレーヤーの動向",
        "課題と機会"
      ],
      optimizedQueries: [
        {
          query: `${query} latest technological trends analysis`,
          purpose: "最新の技術トレンドを特定する"
        },
        {
          query: `${query} industry impact case studies`,
          purpose: "業界への影響に関する事例を収集する"
        },
        {
          query: `${query} future predictions expert opinions`,
          purpose: "将来の展望に関する専門家の意見を収集する"
        },
        {
          query: `${query} major players market share`,
          purpose: "主要プレーヤーの動向と市場シェアを調査する"
        },
        {
          query: `${query} challenges opportunities analysis`,
          purpose: "課題と機会に関する分析を収集する"
        }
      ]
    };
    
    return {
      researchPlan,
      originalQuery: query
    };
  }
});

/**
 * 情報収集ステップ
 * 
 * 最適化されたクエリを使用して並列検索を実行し、幅広い情報を収集します。
 */
const gatheringStep = new Step({
  id: "gatheringStep",
  outputSchema: z.object({
    collectedInformation: z.array(z.object({
      query: z.string(),
      purpose: z.string(),
      results: z.array(z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
        date: z.string().optional()
      }))
    })),
    originalQuery: z.string()
  }),
  execute: async ({ context }) => {
    // 前のステップから研究計画を取得
    const planResult = context?.getStepResult<{
      researchPlan: {
        selectedThought: string;
        subtopics: string[];
        optimizedQueries: {
          query: string;
          purpose: string;
        }[];
      };
      originalQuery: string;
    }>("planningStep");
    
    if (!planResult) {
      throw new Error("研究計画が見つかりません");
    }
    
    const { researchPlan, originalQuery } = planResult;
    
    console.log(`[ToT Workflow] 情報収集ステップ実行: クエリ=${originalQuery.substring(0, 50)}...`);
    
    // 情報収集フェーズを実行
    const result = await executeGatheringPhase(researchPlan, originalQuery);
    
    // 結果からcollectedInformationを抽出
    // 実際の実装では、LLMの応答から構造化データを抽出する処理が必要
    // ここではモックの収集情報を返す
    const collectedInformation = researchPlan.optimizedQueries.map(query => ({
      query: query.query,
      purpose: query.purpose,
      results: [
        {
          title: `${query.purpose}に関する記事1`,
          url: "https://example.com/article1",
          snippet: `これは${query.purpose}に関する情報を含む記事のスニペットです。実際の実装では、Brave Search APIからの実際の結果が含まれます。`,
          date: new Date().toISOString().split('T')[0]
        },
        {
          title: `${query.purpose}に関する記事2`,
          url: "https://example.com/article2",
          snippet: `これは${query.purpose}に関する別の情報を含む記事のスニペットです。実際の実装では、Brave Search APIからの実際の結果が含まれます。`,
          date: new Date().toISOString().split('T')[0]
        }
      ]
    }));
    
    return {
      collectedInformation,
      originalQuery
    };
  }
});

/**
 * 情報分析ステップ
 * 
 * 収集した情報の信頼性と関連性を評価し、複数の解釈仮説を生成し、情報ギャップを特定します。
 */
const analysisStep = new Step({
  id: "analysisStep",
  outputSchema: z.object({
    informationAnalysis: z.object({
      informationEvaluation: z.object({
        highReliabilitySources: z.array(z.string()),
        mediumReliabilitySources: z.array(z.string()),
        lowReliabilitySources: z.array(z.string())
      }),
      interpretations: z.array(z.object({
        statement: z.string(),
        supportingEvidence: z.array(z.string()),
        counterEvidence: z.array(z.string()),
        confidenceScore: z.number()
      })),
      informationGaps: z.array(z.object({
        area: z.string(),
        description: z.string(),
        importance: z.enum(["high", "medium", "low"]),
        additionalQuery: z.string().optional()
      }))
    }),
    originalQuery: z.string()
  }),
  execute: async ({ context }) => {
    // 前のステップから収集情報を取得
    const gatheringResult = context?.getStepResult<{
      collectedInformation: {
        query: string;
        purpose: string;
        results: {
          title: string;
          url: string;
          snippet: string;
          date?: string;
        }[];
      }[];
      originalQuery: string;
    }>("gatheringStep");
    
    if (!gatheringResult) {
      throw new Error("収集情報が見つかりません");
    }
    
    const { collectedInformation, originalQuery } = gatheringResult;
    
    console.log(`[ToT Workflow] 情報分析ステップ実行: クエリ=${originalQuery.substring(0, 50)}...`);
    
    // 情報分析フェーズを実行
    const result = await executeAnalysisPhase(collectedInformation, originalQuery);
    
    // 結果からinformationAnalysisを抽出
    // 実際の実装では、LLMの応答から構造化データを抽出する処理が必要
    // ここではモックの分析結果を返す
    const informationAnalysis = {
      informationEvaluation: {
        highReliabilitySources: ["最新の技術トレンドに関する記事1", "業界への影響に関する事例を収集する記事1"],
        mediumReliabilitySources: ["将来の展望に関する専門家の意見を収集する記事1", "主要プレーヤーの動向と市場シェアを調査する記事1"],
        lowReliabilitySources: ["課題と機会に関する分析を収集する記事2"]
      },
      interpretations: [
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
        }
      ],
      informationGaps: [
        {
          area: "最新の市場データと統計",
          description: "現在の市場シェアと成長率に関する最新データが不足しています。",
          importance: "high" as const,
          additionalQuery: `${originalQuery} market share statistics latest data`
        },
        {
          area: "実際のユーザー体験と満足度",
          description: "実際のユーザーからのフィードバックと満足度に関するデータが限られています。",
          importance: "medium" as const,
          additionalQuery: `${originalQuery} user satisfaction reviews feedback`
        }
      ]
    };
    
    return {
      informationAnalysis,
      originalQuery
    };
  }
});

/**
 * 追加情報収集ステップ（条件付き）
 * 
 * 情報ギャップが特定された場合に、追加の情報収集を行います。
 */
const additionalGatheringStep = new Step({
  id: "additionalGatheringStep",
  outputSchema: z.object({
    additionalInformation: z.array(z.object({
      query: z.string(),
      purpose: z.string(),
      results: z.array(z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
        date: z.string().optional()
      }))
    })),
    originalQuery: z.string()
  }),
  execute: async ({ context }) => {
    // 前のステップから情報分析結果を取得
    const analysisResult = context?.getStepResult<{
      informationAnalysis: {
        informationGaps: {
          area: string;
          description: string;
          importance: "high" | "medium" | "low";
          additionalQuery?: string;
        }[];
      };
      originalQuery: string;
    }>("analysisStep");
    
    if (!analysisResult) {
      throw new Error("情報分析結果が見つかりません");
    }
    
    const { informationAnalysis, originalQuery } = analysisResult;
    
    // 重要度の高い情報ギャップのみを抽出
    const highImportanceGaps = informationAnalysis.informationGaps.filter(
      gap => gap.importance === "high" && gap.additionalQuery
    );
    
    if (highImportanceGaps.length === 0) {
      console.log(`[ToT Workflow] 追加情報収集スキップ: 重要な情報ギャップなし`);
      return {
        additionalInformation: [],
        originalQuery
      };
    }
    
    console.log(`[ToT Workflow] 追加情報収集ステップ実行: ギャップ数=${highImportanceGaps.length}`);
    
    // 追加クエリを構築
    const additionalQueries = highImportanceGaps.map(gap => ({
      query: gap.additionalQuery!,
      purpose: `${gap.area}に関する情報を収集する`
    }));
    
    // 追加の研究計画を構築
    const additionalResearchPlan = {
      optimizedQueries: additionalQueries
    };
    
    // 追加情報収集フェーズを実行
    const result = await executeGatheringPhase(additionalResearchPlan, originalQuery);
    
    // 結果からadditionalInformationを抽出
    // 実際の実装では、LLMの応答から構造化データを抽出する処理が必要
    // ここではモックの追加情報を返す
    const additionalInformation = additionalQueries.map(query => ({
      query: query.query,
      purpose: query.purpose,
      results: [
        {
          title: `${query.purpose}に関する追加記事1`,
          url: "https://example.com/additional1",
          snippet: `これは${query.purpose}に関する追加情報を含む記事のスニペットです。実際の実装では、Brave Search APIからの実際の結果が含まれます。`,
          date: new Date().toISOString().split('T')[0]
        }
      ]
    }));
    
    return {
      additionalInformation,
      originalQuery
    };
  }
});

/**
 * 洞察生成ステップ
 * 
 * 分析に基づいて重要な洞察を生成し、洞察を中心に全体ストーリーを構築し、証拠に基づく結論を形成します。
 */
const insightStep = new Step({
  id: "insightStep",
  outputSchema: z.object({
    integratedInsights: z.object({
      keyInsights: z.array(z.object({
        title: z.string(),
        description: z.string(),
        evidenceStrength: z.enum(["strong", "moderate", "weak"]),
        supportingFacts: z.array(z.string())
      })),
      narrativeStructure: z.object({
        approach: z.string(),
        mainSections: z.array(z.string()),
        flowDescription: z.string()
      }),
      conclusions: z.array(z.object({
        statement: z.string(),
        confidenceLevel: z.enum(["high", "medium", "low"]),
        supportingEvidence: z.array(z.string()),
        limitations: z.array(z.string())
      }))
    }),
    originalQuery: z.string()
  }),
  execute: async ({ context }) => {
    // 前のステップから情報分析結果を取得
    const analysisResult = context?.getStepResult<{
      informationAnalysis: any;
      originalQuery: string;
    }>("analysisStep");
    
    if (!analysisResult) {
      throw new Error("情報分析結果が見つかりません");
    }
    
    const { informationAnalysis, originalQuery } = analysisResult;
    
    // 追加情報収集結果を取得（存在する場合）
    const additionalGatheringResult = context?.getStepResult<{
      additionalInformation: any;
    }>("additionalGatheringStep");
    
    // 追加情報がある場合は、分析結果と統合
    let enhancedAnalysis = informationAnalysis;
    if (additionalGatheringResult && additionalGatheringResult.additionalInformation.length > 0) {
      // 実際の実装では、追加情報を分析結果と統合する処理が必要
      console.log(`[ToT Workflow] 追加情報を統合: 項目数=${additionalGatheringResult.additionalInformation.length}`);
    }
    
    console.log(`[ToT Workflow] 洞察生成ステップ実行: クエリ=${originalQuery.substring(0, 50)}...`);
    
    // 洞察生成フェーズを実行
    const result = await executeInsightPhase(enhancedAnalysis, originalQuery);
    
    // 結果からintegratedInsightsを抽出
    // 実際の実装では、LLMの応答から構造化データを抽出する処理が必要
    // ここではモックの統合洞察を返す
    interface Insight {
      title: string;
      description: string;
      evidenceStrength: "strong" | "moderate" | "weak";
      supportingFacts: string[];
    }
      
    interface Conclusion {
      statement: string;
      confidenceLevel: "high" | "medium" | "low";
      supportingEvidence: string[];
      limitations: string[];
    }
      
    const integratedInsights: {
      keyInsights: Insight[];
      narrativeStructure: {
        approach: string;
        mainSections: string[];
        flowDescription: string;
      };
      conclusions: Conclusion[];
    } = {
      keyInsights: [
        {
          title: "効率性と使いやすさのバランスが成功の鍵",
          description: "技術的効率性とユーザー体験の両方に焦点を当てた製品が市場で最も成功している。どちらか一方だけに偏った製品は特定のニッチ市場でのみ成功している。",
          evidenceStrength: "strong" as const,
          supportingFacts: [
            "効率性を強調する製品と使いやすさを強調する製品の両方に関する分析",
            "市場リーダーの製品は両方の側面でバランスが取れている",
            "ユーザーレビューは両方の側面を評価している"
          ]
        },
        {
          title: "業界標準化が加速しつつある",
          description: "過去2年間で業界標準化の動きが加速しており、主要プレーヤーが共通規格の採用を進めている。これにより相互運用性が向上し、エコシステム全体の成長が促進されている。",
          evidenceStrength: "moderate" as const,
          supportingFacts: [
            "主要企業による共通規格の採用発表",
            "クロスプラットフォーム互換性の向上",
            "業界団体による標準化イニシアチブの増加"
          ]
        }
      ],
      narrativeStructure: {
        approach: "トピック別構成と重要度の組み合わせ",
        mainSections: [
          "概要: 主要な発見と背景",
          "効率性と使いやすさのバランスが成功の鍵",
          "業界標準化が加速しつつある",
          "今後の展望と推奨事項"
        ],
        flowDescription: "最も重要な洞察から始め、関連する洞察をグループ化し、最後に将来の展望で締めくくる構成。各セクションは具体的な証拠と実例で裏付ける。"
      },
      conclusions: [
        {
          statement: "効率性とユーザー体験のバランスが市場成功の決定的要因である",
          confidenceLevel: "high",
          supportingEvidence: [
            "効率性を強調する製品と使いやすさを強調する製品の両方に関する分析",
            "市場リーダーの製品は両方の側面でバランスが取れている",
            "ユーザーレビューは両方の側面を評価している"
          ],
          limitations: [
            "特定のニッチ市場では一方の側面が特に重視される場合がある",
            "技術の進化により、このバランスの最適点は変化する可能性がある"
          ]
        },
        {
          statement: "業界標準化の進行により、相互運用性が競争優位性の源泉になりつつある",
          confidenceLevel: "medium",
          supportingEvidence: [
            "主要企業による共通規格の採用発表",
            "クロスプラットフォーム互換性の向上",
            "業界団体による標準化イニシアチブの増加"
          ],
          limitations: [
            "一部の企業は依然として独自規格を推進している",
            "標準化の進行速度は地域や製品カテゴリによって異なる"
          ]
        }
      ]
    };
    
    return {
      integratedInsights,
      originalQuery
    };
  }
});

/**
 * レポート生成ステップ
 * 
 * 統合された洞察から構造化レポートを生成し、レポートを最適化します。
 */
const reportStep = new Step({
  id: "reportStep",
  outputSchema: z.object({
    finalReport: z.object({
      title: z.string(),
      summary: z.string(),
      sections: z.array(z.object({
        title: z.string(),
        content: z.string(),
        subsections: z.array(z.object({
          title: z.string(),
          content: z.string()
        })).optional()
      })),
      sources: z.array(z.object({
        title: z.string(),
        url: z.string(),
        accessedDate: z.string(),
        reliability: z.enum(["high", "medium", "low"])
      })),
      generatedAt: z.string()
    }),
    reportText: z.string(),
    formatType: z.enum(["markdown", "html", "text"]),
    originalQuery: z.string()
  }),
  execute: async ({ context }) => {
    // 前のステップから統合洞察を取得
    const insightResult = context?.getStepResult<{
      integratedInsights: any;
      originalQuery: string;
    }>("insightStep");
    
    if (!insightResult) {
      throw new Error("統合洞察が見つかりません");
    }
    
    const { integratedInsights, originalQuery } = insightResult;
    
    // 情報収集結果を取得
    const gatheringResult = context?.getStepResult<{
      collectedInformation: {
        results: {
          title: string;
          url: string;
          snippet: string;
          date?: string;
        }[];
      }[];
    }>("gatheringStep");
    
    // 評価済みソースを構築
    let evaluatedSources: {
      title: string;
      url: string;
      snippet: string;
      date?: string;
    }[] = [];
    if (gatheringResult) {
      evaluatedSources = gatheringResult.collectedInformation.flatMap(info => 
        info.results.map(result => ({
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          date: result.date
        }))
      );
    }
    
    console.log(`[ToT Workflow] レポート生成ステップ実行: クエリ=${originalQuery.substring(0, 50)}...`);
    
    // レポート生成フェーズを実行
    const result = await executeReportPhase(integratedInsights, originalQuery, evaluatedSources);
    
    // 結果からfinalReportとreportTextを抽出
    // 実際の実装では、LLMの応答から構造化データを抽出する処理が必要
    // ここではモックの最終レポートを返す
    const finalReport = {
      title: `${originalQuery}に関する包括的分析`,
      summary: `このレポートでは、「${originalQuery}」に関する包括的な分析を提供します。主要な洞察、現在のトレンド、および将来の展望について詳細に検討しています。分析の結果、効率性とユーザー体験のバランス、業界標準化の進行などの主要なポイントが明らかになりました。`,
      sections: [
        {
          title: "概要",
          content: `このレポートでは、「${originalQuery}」に関する包括的な分析を提供します。主要な洞察、現在のトレンド、および将来の展望について詳細に検討しています。分析の結果、効率性とユーザー体験のバランス、業界標準化の進行などの主要なポイントが明らかになりました。`
        },
        {
          title: "主要な発見",
          content: "以下では、分析から得られた主要な発見を詳細に説明します。",
          subsections: integratedInsights.keyInsights.map((insight: {
            title: string;
            description: string;
            supportingFacts: string[];
          }) => ({
            title: insight.title,
            content: `${insight.description}\n\n**裏付けとなる事実:**\n${insight.supportingFacts.map((fact: string) => `- ${fact}`).join('\n')}`
          }))
        },
        {
          title: "結論と推奨事項",
          content: "分析に基づいて、以下の結論と推奨事項を提示します。",
          subsections: integratedInsights.conclusions.map((conclusion: {
            statement: string;
            confidenceLevel: 'high' | 'medium' | 'low';
            supportingEvidence: string[];
            limitations: string[];
          }) => ({
            title: conclusion.statement,
            content: `**確信度:** ${conclusion.confidenceLevel === 'high' ? '高' : conclusion.confidenceLevel === 'medium' ? '中' : '低'}\n\n**裏付けとなる証拠:**\n${conclusion.supportingEvidence.map((evidence: string) => `- ${evidence}`).join('\n')}\n\n**制限事項:**\n${conclusion.limitations.map((limitation: string) => `- ${limitation}`).join('\n')}`
          }))
        }
      ],
      sources: evaluatedSources.map(source => ({
        title: source.title,
        url: source.url,
        accessedDate: source.date || new Date().toISOString().split('T')[0],
        reliability: 'medium' as const
      })),
      generatedAt: new Date().toISOString()
    };
    
    // マークダウン形式のレポートテキストを生成
    const reportText = `# ${finalReport.title}

## 概要
${finalReport.summary}

## 主要な発見
${finalReport.sections[1].subsections?.map((subsection: { title: string; content: string }) => 
  `### ${subsection.title}\n${subsection.content}`
).join('\n\n') || ''}

## 結論と推奨事項
${finalReport.sections[2].subsections?.map((subsection: { title: string; content: string }) => 
  `### ${subsection.title}\n${subsection.content}`
).join('\n\n') || ''}

## 情報ソース
${finalReport.sources.map((source: { title: string; url: string; accessedDate: string }) => 
  `- [${source.title}](${source.url}) (アクセス日: ${source.accessedDate})`
).join('\n')}

---
*このレポートは ${new Date(finalReport.generatedAt).toLocaleString()} に生成されました。*`;
    
    return {
      finalReport,
      reportText,
      formatType: "markdown" as const,
      originalQuery
    };
  }
});

/**
 * ToT研究ワークフロー
 * 
 * 研究計画の生成、情報収集、情報評価、洞察生成、レポート生成の各段階を体系的に実行するワークフロー。
 */
export const totResearchWorkflow = new Workflow({
  name: "tot-research-workflow",
  triggerSchema: z.object({
    query: z.string().describe("ユーザーのクエリ"),
    clarificationResponse: z.string().optional().describe("明確化レスポンス（オプション）")
  }),
});

// ワークフローのステップを定義
totResearchWorkflow
  .step(planningStep)
  .then(gatheringStep)
  .then(analysisStep)
  .then(additionalGatheringStep, {
    when: { "analysisStep.informationAnalysis.informationGaps": (gaps: any) => 
      gaps && gaps.some((gap: any) => gap.importance === "high" && gap.additionalQuery)
    }
  })
  .then(insightStep)
  .then(reportStep);

// ワークフローをコミット
totResearchWorkflow.commit();
