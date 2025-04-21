/**
 * Tree of Thoughts 探索結果のサンプルデータ
 * 
 * このファイルは、ToT Explorerのテスト用に作成されたサンプルデータです。
 * 実際のアプリケーションでは、APIから取得したデータを使用します。
 */

// ノードの型定義
export interface ThoughtNode {
  id: string;
  data: {
    content: string;
    score?: number;
    evaluationCriteria?: Record<string, number>;
    metadata?: {
      stage?: string;
      index?: number;
    };
  };
  score: number;
  depth: number;
  parentId?: string;
}

// 推論ステップの型定義
export interface ReasoningStep {
  id: string;
  timestamp: string;
  type: string;
  title: string;
  content: string;
  metadata: {
    phase: string;
    currentStep: number;
    totalSteps: number;
    subStep?: number;
  };
}

// 研究計画の型定義
export interface ResearchPlan {
  approach: string;
  description: string;
  subtopics: string[];
  queries: Array<{
    query: string;
    purpose: string;
    queryType: string;
    priority: number;
  }>;
}

// 「AIの未来」に関する調査をテーマにしたサンプルデータ
export const sampleExplorationData = {
  // ビームサーチのパラメータ
  beamWidth: 3,
  maxDepth: 3,
  
  // 探索されたノード
  exploredNodes: [
    {
      id: "root",
      data: {
        content: "AIの未来について調査したい",
        metadata: {
          stage: "planning",
          index: 0
        }
      },
      score: 0,
      depth: 0
    },
    {
      id: "node-1-1",
      data: {
        content: "アプローチ1：テクノロジー進化予測\n詳細説明：過去〜現在の技術進化から今後のブレークスルーを予測する。\n推奨検索ツール：searchTool（特許調査）\n主要サブトピック：\n- 深層学習の次世代モデル\n- 量子コンピューティングとAIの融合\n- 自己学習・自己改善AI\n- エッジAIの進化\n- 脳型コンピューティング\n必要な情報ソース：\n- arXiv\n- IEEE Xplore\n- WIPO 特許検索",
        score: 8.5,
        evaluationCriteria: {
          "網羅性": 9,
          "実行可能性": 8,
          "ユニークさ": 7,
          "効率性": 10
        },
        metadata: {
          stage: "planning",
          index: 1
        }
      },
      score: 8.5,
      depth: 1,
      parentId: "root"
    },
    {
      id: "node-1-2",
      data: {
        content: "アプローチ2：社会的影響分析\n詳細説明：AIの社会実装による経済・雇用・倫理面の影響を分析する。\n推奨検索ツール：searchTool（学術論文）\n主要サブトピック：\n- AI自動化による雇用変化\n- AIと経済格差\n- AIガバナンスと規制\n- AIと人間の協働\n- AIの倫理的課題\n必要な情報ソース：\n- 経済協力開発機構（OECD）\n- 世界経済フォーラム\n- 学術ジャーナル",
        score: 7.8,
        evaluationCriteria: {
          "網羅性": 8,
          "実行可能性": 9,
          "ユニークさ": 6,
          "効率性": 8
        },
        metadata: {
          stage: "planning",
          index: 2
        }
      },
      score: 7.8,
      depth: 1,
      parentId: "root"
    },
    {
      id: "node-1-3",
      data: {
        content: "アプローチ3：産業別応用展望\n詳細説明：各産業におけるAI応用の現状と将来展望を調査する。\n推奨検索ツール：searchTool（業界レポート）\n主要サブトピック：\n- ヘルスケアAI\n- 金融テック\n- 製造業のAI\n- 小売・物流のAI\n- 創造産業のAI\n必要な情報ソース：\n- 業界レポート\n- 企業の技術ロードマップ\n- スタートアップ動向",
        score: 7.2,
        evaluationCriteria: {
          "網羅性": 7,
          "実行可能性": 8,
          "ユニークさ": 6,
          "効率性": 8
        },
        metadata: {
          stage: "planning",
          index: 3
        }
      },
      score: 7.2,
      depth: 1,
      parentId: "root"
    },
    {
      id: "node-2-1",
      data: {
        content: "深層学習の次世代モデル調査\n\n現在のトランスフォーマーモデルを超える次世代アーキテクチャの研究動向を調査する。特に注目すべき点：\n\n1. スパース・モデリング技術\n2. ニューロシンボリックAI\n3. マルチモーダル基盤モデル\n4. 自己教師あり学習の進化\n5. 計算効率の飛躍的向上\n\n主要研究機関：OpenAI、Google DeepMind、Meta AI Research、Stanford、MITなどの最新論文を重点的に調査。",
        score: 9.2,
        evaluationCriteria: {
          "網羅性": 9,
          "実行可能性": 10,
          "ユニークさ": 8,
          "効率性": 10
        },
        metadata: {
          stage: "planning",
          index: 1
        }
      },
      score: 9.2,
      depth: 2,
      parentId: "node-1-1"
    },
    {
      id: "node-2-2",
      data: {
        content: "量子コンピューティングとAIの融合\n\n量子コンピューティングがAIにもたらす可能性と課題を調査する。特に：\n\n1. 量子機械学習アルゴリズム\n2. 量子ニューラルネットワーク\n3. 量子強化学習\n4. 量子コンピュータでの大規模モデル訓練\n5. 実用化タイムライン\n\nIBM、Google、D-Wave、Rigetti、IonQなどの量子コンピューティング企業の研究開発状況と、学術機関の最新研究を調査。",
        score: 8.7,
        evaluationCriteria: {
          "網羅性": 9,
          "実行可能性": 7,
          "ユニークさ": 10,
          "効率性": 9
        },
        metadata: {
          stage: "planning",
          index: 2
        }
      },
      score: 8.7,
      depth: 2,
      parentId: "node-1-1"
    },
    {
      id: "node-2-3",
      data: {
        content: "AI自動化による雇用変化\n\n様々な産業におけるAI自動化の進展と雇用への影響を調査する。特に：\n\n1. 職種別の自動化リスク\n2. 新たに創出される職種\n3. スキルギャップと再教育\n4. 労働市場の二極化\n5. 政策対応と社会保障\n\n各国の労働統計、経済予測、OECD・ILOなどの国際機関レポート、学術研究を調査。",
        score: 8.1,
        evaluationCriteria: {
          "網羅性": 8,
          "実行可能性": 9,
          "ユニークさ": 7,
          "効率性": 8
        },
        metadata: {
          stage: "planning",
          index: 1
        }
      },
      score: 8.1,
      depth: 2,
      parentId: "node-1-2"
    },
    {
      id: "node-3-1",
      data: {
        content: "スパースモデリングとニューロシンボリックAIの統合アプローチ\n\n現在のディープラーニングの限界を超えるために、スパースモデリング技術とニューロシンボリックAIを組み合わせた新しいアプローチを調査する。\n\n主な焦点：\n1. 少ないデータでの学習効率向上\n2. 解釈可能性と説明可能性の向上\n3. 論理推論と深層学習の統合\n4. 知識表現と転移学習\n5. 計算リソース要件の削減\n\n最新の研究成果と実装例、ベンチマーク結果を収集し、実用化への課題と展望を分析する。",
        score: 9.7,
        evaluationCriteria: {
          "網羅性": 10,
          "実行可能性": 9,
          "ユニークさ": 10,
          "効率性": 10
        },
        metadata: {
          stage: "planning",
          index: 1
        }
      },
      score: 9.7,
      depth: 3,
      parentId: "node-2-1"
    },
    {
      id: "node-3-2",
      data: {
        content: "量子機械学習の実用化タイムラインと産業インパクト\n\n量子機械学習の実用化に向けたロードマップと、各産業への影響を調査する。\n\n主な焦点：\n1. 短期（1-3年）、中期（3-7年）、長期（7-15年）の実用化予測\n2. 量子優位性が最初に達成される機械学習タスク\n3. 産業別の破壊的イノベーション可能性\n4. 必要なインフラと人材育成\n5. 投資動向と市場予測\n\n量子コンピューティング企業のロードマップ、ベンチャー投資、特許出願動向、専門家インタビューを分析する。",
        score: 9.1,
        evaluationCriteria: {
          "網羅性": 9,
          "実行可能性": 8,
          "ユニークさ": 10,
          "効率性": 9
        },
        metadata: {
          stage: "planning",
          index: 1
        }
      },
      score: 9.1,
      depth: 3,
      parentId: "node-2-2"
    }
  ],
  
  // 最良ノードのパス（IDのリスト）
  bestNodePath: ["root", "node-1-1", "node-2-1", "node-3-1"],
  
  // 最良ノード
  bestNode: {
    id: "node-3-1",
    data: {
      content: "スパースモデリングとニューロシンボリックAIの統合アプローチ\n\n現在のディープラーニングの限界を超えるために、スパースモデリング技術とニューロシンボリックAIを組み合わせた新しいアプローチを調査する。\n\n主な焦点：\n1. 少ないデータでの学習効率向上\n2. 解釈可能性と説明可能性の向上\n3. 論理推論と深層学習の統合\n4. 知識表現と転移学習\n5. 計算リソース要件の削減\n\n最新の研究成果と実装例、ベンチマーク結果を収集し、実用化への課題と展望を分析する。",
      score: 9.7,
      evaluationCriteria: {
        "網羅性": 10,
        "実行可能性": 9,
        "ユニークさ": 10,
        "効率性": 10
      },
      metadata: {
        stage: "planning",
        index: 1
      }
    },
    score: 9.7,
    depth: 3,
    parentId: "node-2-1"
  },
  
  // ビームサーチの統計情報
  beamSearchStats: {
    nodesExplored: 9,
    maxDepthReached: 3,
    bestScore: 9.7,
    executionTimeMs: 2500
  },
  
  // 研究計画
  researchPlan: {
    approach: "スパースモデリングとニューロシンボリックAIの統合による次世代AI技術の調査",
    description: "現在のディープラーニングの限界を超えるために、スパースモデリング技術とニューロシンボリックAIを組み合わせた新しいアプローチを調査する。",
    subtopics: [
      "少ないデータでの学習効率向上技術",
      "AIの解釈可能性と説明可能性",
      "論理推論と深層学習の統合手法",
      "知識表現と転移学習の進展",
      "計算リソース要件の削減アプローチ"
    ],
    queries: [
      {
        query: "sparse modeling neural symbolic AI integration",
        purpose: "統合アプローチの最新研究調査",
        queryType: "technical",
        priority: 1
      },
      {
        query: "few-shot learning efficiency improvement techniques",
        purpose: "少ないデータでの学習効率向上手法の調査",
        queryType: "technical",
        priority: 2
      },
      {
        query: "explainable AI interpretability methods",
        purpose: "解釈可能性向上技術の調査",
        queryType: "technical",
        priority: 3
      },
      {
        query: "logical reasoning integration deep learning",
        purpose: "論理推論と深層学習の統合手法調査",
        queryType: "technical",
        priority: 4
      },
      {
        query: "AI computational resource reduction techniques",
        purpose: "計算リソース削減技術の調査",
        queryType: "technical",
        priority: 5
      }
    ]
  },
  
  // 推論ステップ
  reasoningSteps: [
    {
      id: "step-1",
      timestamp: "2025-04-19T14:30:00.000Z",
      type: "planning",
      title: "Beam Search による強化計画フェーズを開始",
      content: "クエリ「AIの未来について調査したい」について深度=3、ビーム幅=3の探索を行います。",
      metadata: {
        phase: "enhanced_planning",
        currentStep: 1,
        totalSteps: 5
      }
    },
    {
      id: "step-2",
      timestamp: "2025-04-19T14:30:01.000Z",
      type: "thought_root",
      title: "初期思考（ルートノード）",
      content: "AIの未来について調査したい",
      metadata: {
        phase: "enhanced_planning",
        currentStep: 2,
        totalSteps: 5
      }
    },
    {
      id: "step-3",
      timestamp: "2025-04-19T14:30:10.000Z",
      type: "thought_exploration",
      title: "深さ1の思考探索",
      content: "深さ1で3個の思考を探索しました。上位スコア: 8.50, 7.80, 7.20",
      metadata: {
        phase: "enhanced_planning",
        currentStep: 3,
        totalSteps: 5
      }
    },
    {
      id: "step-4",
      timestamp: "2025-04-19T14:30:20.000Z",
      type: "thought_exploration",
      title: "深さ2の思考探索",
      content: "深さ2で3個の思考を探索しました。上位スコア: 9.20, 8.70, 8.10",
      metadata: {
        phase: "enhanced_planning",
        currentStep: 4,
        totalSteps: 5
      }
    },
    {
      id: "step-5",
      timestamp: "2025-04-19T14:30:30.000Z",
      type: "thought_exploration",
      title: "深さ3の思考探索",
      content: "深さ3で2個の思考を探索しました。上位スコア: 9.70, 9.10",
      metadata: {
        phase: "enhanced_planning",
        currentStep: 5,
        totalSteps: 5
      }
    },
    {
      id: "step-6",
      timestamp: "2025-04-19T14:30:40.000Z",
      type: "path_selection",
      title: "最良の思考経路を選択",
      content: "スコア 9.70 の思考を選択しました:\n\nスパースモデリングとニューロシンボリックAIの統合アプローチ\n\n現在のディープラーニングの限界を超えるために、スパースモデリング技術とニューロシンボリックAIを組み合わせた新しいアプローチを調査する。",
      metadata: {
        phase: "enhanced_planning",
        currentStep: 6,
        totalSteps: 7
      }
    },
    {
      id: "step-7",
      timestamp: "2025-04-19T14:30:50.000Z",
      type: "research_plan",
      title: "研究計画生成完了",
      content: "スパースモデリングとニューロシンボリックAIの統合による次世代AI技術の調査計画を作成しました。5つのサブトピックと5つの検索クエリを含みます。",
      metadata: {
        phase: "enhanced_planning",
        currentStep: 7,
        totalSteps: 7
      }
    }
  ]
};