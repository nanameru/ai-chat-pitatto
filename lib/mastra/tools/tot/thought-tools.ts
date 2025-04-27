/**
 * Tree of Thoughts (ToT) 思考ツール
 * 
 * 思考の生成、評価、選択に関するツールを提供します。
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { nanoid } from "nanoid";
import { Thought, EvaluatedThought } from "../../types/tot";
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { totConfig } from "../../config/totConfig";
import { Node } from "../../algorithms/beamSearch";
import { handleJsonParseFailure, withAIModelBackoff, reportError } from "../../utils/errorHandling";

/**
 * 思考生成ツール
 * 
 * 指定されたステージに応じて複数の思考経路を生成します。
 */
export const thoughtGenerator = createTool({
  id: "Thought Generator",
  inputSchema: z.object({
    query: z.string().describe("思考生成の対象となるクエリまたはコンテキスト"),
    stage: z.enum(["planning", "analysis", "insight"]).describe("思考生成のステージ"),
    maxThoughts: z.number().min(1).max(10).default(5).describe("生成する思考の最大数"),
    context: z.any().optional().describe("追加コンテキスト情報（オプション）"),
    modelOverride: z.any().optional().describe("モデルをオーバーライドするための関数（オプション）"),
  }),
  outputSchema: z.object({
    thoughts: z.array(z.object({
      id: z.string(),
      content: z.string(),
      parentId: z.string().optional(),
      score: z.number().optional(),
      confidence: z.number().optional(),
      evidence: z.array(z.string()).optional(),
      metadata: z.any().optional()
    })).describe("生成された思考のリスト"),
    stage: z.string().describe("思考生成のステージ"),
    query: z.string().describe("元のクエリ"),
    prompt: z.string().describe("使用したプロンプト"),
    timestamp: z.string().describe("タイムスタンプ"),
    isFallback: z.boolean().optional().describe("フォールバックが使用されたかどうか")
  }),
  description: "指定されたステージに応じて複数の思考経路を生成します",
  execute: async ({ context: { query, stage, maxThoughts, context, modelOverride } }) => {
    console.log(`[ToT] 思考生成: ステージ=${stage}, クエリ=${query.substring(0, 50)}...`);
    
    // ステージに応じたプロンプトを構築
    let prompt = "";
    let thoughtType = "";
    
    if (stage === "planning") {
      thoughtType = "調査アプローチ";
      // 利用可能な検索ツールを動的に列挙（将来ツールが増えても自動追随）
      const availableSearchTools = [
        "searchTool", // 既存ツール
        // ここに新しい検索ツールを追加するだけでプロンプトに反映される
      ];
      const toolListStr = availableSearchTools.map(t => `- ${t}`).join("\n");

      const basePrompt = `以下のクエリに対する${maxThoughts}つの異なる調査アプローチを生成してください:
"${query}"

利用可能な検索ツール一覧:\n${toolListStr}

各アプローチには以下を必ず含めてください:
1. アプローチ名（簡潔に）
2. アプローチの詳細説明（2-3文）
3. 推奨検索ツール（上記リストから選択し、使用理由を10〜20文字で）
4. 調査すべき主要サブトピック（必ず5項目）
5. 必要な情報ソース（最低3件）

【出力例】
----
アプローチ1：テクノロジー進化予測
詳細説明：過去〜現在の技術進化から今後のブレークスルーを予測する。
推奨検索ツール：searchTool（特許調査）
主要サブトピック：
- 深層学習の次世代モデル
- ...
必要な情報ソース：
- arXiv
- IEEE Xplore
- WIPO 特許検索
----

＜セルフチェック＞
- 網羅性     : Yes/No
- 実行可能性 : Yes/No
- 独自性     : Yes/No

全てYesになるよう修正してから回答してください。

JSONではなく、自然な文章形式で返してください。各アプローチは明確に区切ってください。`;

      prompt = basePrompt;
    } 
    else if (stage === "analysis") {
      thoughtType = "解釈仮説";
      prompt = `以下の情報に基づいて${maxThoughts}つの異なる解釈仮説を生成してください:
"${query}"

${context ? `追加コンテキスト: ${JSON.stringify(context)}` : ''}

各仮説には以下を含めてください:
1. 仮説の主張（1文）
2. 支持する証拠（箇条書き）
3. 反証となる証拠（箇条書き）

JSONではなく、自然な文章形式で返してください。各仮説は明確に区切ってください。`;
    } 
    else if (stage === "insight") {
      thoughtType = "重要洞察";
      prompt = `以下の分析に基づいて${maxThoughts}つの重要な洞察を生成してください:
"${query}"

${context ? `追加コンテキスト: ${JSON.stringify(context)}` : ''}

各洞察には以下を含めてください:
1. 洞察のタイトル（簡潔に）
2. 洞察の詳細説明（2-3文）
3. 裏付けとなる事実（箇条書き）
4. 実用的な意味合い（1-2文）

JSONではなく、自然な文章形式で返してください。各洞察は明確に区切ってください。`;
    }
    
    try {
      // Create the thought generation agent
      const thoughtAgent = new Agent({
        name: `${stage.charAt(0).toUpperCase() + stage.slice(1)} Thought Generator`,
        instructions: `あなたは複数の思考経路を提案する思考生成の専門家です。
与えられたクエリやコンテキストに基づいて、多様で創造的な思考を生成してください。
各思考は明確に区切り、指定された形式に従ってください。`,
        model: modelOverride || openai(totConfig.generationModel),
      });
      
      // Generate thoughts using the agent with exponential backoff
      console.log(`[ToT] 思考生成プロンプト: ${prompt.substring(0, 100)}...`);
      
      const thoughtResult = await withAIModelBackoff(() => 
        thoughtAgent.generate(prompt)
      );
      
      // Parse the generated thoughts
      const responseText = thoughtResult.text;
      
      // Simple parsing based on line breaks and numbers/separators
      const thoughtBlocks = responseText.split(/\n\s*\n|(?=\d+[\.\)]\s*[A-Z])/g)
        .filter(block => block.trim().length > 0)
        .slice(0, maxThoughts);
      
      // フォールバック用のデフォルト思考を準備
      const defaultThoughts = [
        `${thoughtType}1：${query}の基本概要\n${query}の基本的な概念と歴史を調査し、主要な発展段階を特定します。`,
        `${thoughtType}2：${query}の応用例\n${query}の実世界での応用例と成功事例を調査し、効果的な実装パターンを特定します。`,
        `${thoughtType}3：${query}の最新トレンド\n${query}に関する最新の研究動向やトレンドを調査し、今後の発展方向を予測します。`
      ].slice(0, maxThoughts);
      
      // 思考ブロックが空または少なすぎる場合はフォールバックを使用
      let isFallback = false;
      if (thoughtBlocks.length < Math.min(2, maxThoughts)) {
        isFallback = true;
        reportError('thought_generation_insufficient', new Error('生成された思考が不十分です'), {
          query,
          stage,
          responseTextLength: responseText.length,
          thoughtBlocksCount: thoughtBlocks.length
        });
        
        // フォールバックのデフォルト思考を使用
        for (let i = thoughtBlocks.length; i < Math.min(maxThoughts, defaultThoughts.length); i++) {
          thoughtBlocks.push(defaultThoughts[i]);
        }
      }
      
      // Create thought objects
      const thoughts: Thought[] = thoughtBlocks.map((content, index) => ({
        id: nanoid(),
        content: content.trim(),
        parentId: undefined,
        score: undefined,
        confidence: undefined,
        evidence: [],
        metadata: { stage, index }
      }));
      
      return {
        thoughts,
        stage,
        query,
        prompt,
        timestamp: new Date().toISOString(),
        isFallback
      };
    } catch (error: unknown) {
      // エラー報告を追加
      reportError('thought_generation_error', error, {
        query,
        stage
      });
      
      console.error(`[ToT] 思考生成エラー:`, error);
      
      // エラー時のフォールバック思考を生成
      const fallbackThoughts: Thought[] = Array.from({ length: Math.min(3, maxThoughts) }, (_, index) => ({
        id: nanoid(),
        content: `${thoughtType}${index + 1}：${query}に関する考察\n${query}の${['基本概念', '応用例', '将来展望'][index] || '側面'}について調査します。`,
        parentId: undefined,
        score: undefined,
        confidence: undefined,
        evidence: [],
        metadata: { stage, index, isFallback: true }
      }));
      
      // フォールバック結果を返す
      return {
        thoughts: fallbackThoughts,
        stage,
        query,
        prompt,
        timestamp: new Date().toISOString(),
        isFallback: true
      };
    }
  }
});

/**
 * 思考評価ツール
 * 
 * 生成された思考を評価してスコア付けします。
 */
export const thoughtEvaluator = createTool({
  id: "Thought Evaluator",
  inputSchema: z.object({
    thoughts: z.array(z.object({
      id: z.string(),
      content: z.string(),
      metadata: z.any().optional()
    })).describe("評価する思考のリスト"),
    stage: z.enum(["planning", "analysis", "insight"]).describe("評価するステージ"),
    evaluationCriteria: z.array(z.string()).optional().describe("評価基準（オプション）"),
    context: z.any().optional().describe("追加コンテキスト情報（オプション）"),
    modelOverride: z.any().optional().describe("モデルをオーバーライドするための関数（オプション）"),
  }),
  outputSchema: z.object({
    evaluatedThoughts: z.array(z.object({
      id: z.string(),
      content: z.string(),
      score: z.number(),
      evaluationCriteria: z.record(z.number()).optional(),
      reasoning: z.string().optional(),
      metadata: z.any().optional()
    })).describe("評価された思考のリスト"),
    bestThought: z.object({
      id: z.string(),
      content: z.string(),
      score: z.number(),
      evaluationCriteria: z.record(z.number()).optional(),
      reasoning: z.string().optional()
    }).describe("最高スコアの思考"),
    criteria: z.array(z.string()).describe("使用された評価基準"),
    stage: z.string().describe("評価ステージ"),
    timestamp: z.string().describe("タイムスタンプ"),
    isFallback: z.boolean().optional().describe("フォールバックが使用されたかどうか")
  }),
  description: "生成された思考を評価してスコア付けします",
  execute: async ({ context: { thoughts, stage, evaluationCriteria, context, modelOverride } }) => {
    console.log(`[ToT] 思考評価: ステージ=${stage}, 思考数=${thoughts.length}`);
    
    // ステージに応じたデフォルト評価基準を設定
    const defaultCriteria: { [key: string]: string[] } = {
      "planning": ["網羅性", "実行可能性", "ユニークさ", "効率性"],
      "analysis": ["証拠の強さ", "論理的一貫性", "説明力", "反証の考慮"],
      "insight": ["新規性", "実用性", "根拠の強さ", "重要性"]
    };
    
    const criteria = evaluationCriteria || defaultCriteria[stage] || ["有用性", "正確性"];
    
    try {
      // Create the evaluation agent
      const evaluationAgent = new Agent({
        name: "Thought Evaluator Agent",
        instructions: `あなたは思考を評価する専門家です。以下のルールに従い、指定された各評価基準を整数0〜10点で採点し、15〜40文字で理由を述べてください。

【出力フォーマット（厳守、JSONのみ）】
{
  "criteria": {
    "<基準名>": { "score": <0-10>, "reason": "理由15〜40文字" },
    ... // すべての基準を列挙
  },
  "average": <平均スコア(小数第2位)>
}

【制約】
- JSON以外の文字列を含めない（コードブロックも不要）
- scoreは整数0〜10のみ
- reasonは15〜40文字
- averageはcriteria.scoreの平均値を小数第2位で計算
- フィールド名や順序を変更しない`,
        model: modelOverride || openai(totConfig.evaluationModel),
      });
      
      // Evaluate each thought
      const evaluatedThoughts: EvaluatedThought[] = [];
      let isFallback = false;
      
      for (const thought of thoughts) {
        // Create prompt for evaluation
        const evaluationPrompt = `以下の思考を評価してください：

思考内容:
"""
${thought.content}
"""

評価基準:
${criteria.map((criterion, index) => `${index + 1}. ${criterion}`).join('\n')}

各基準について0〜10のスコアを付け、評価理由を簡潔に説明してください。
最後に、すべての基準の平均値として総合スコアを計算してください。`;

        try {
          // Get evaluation from the agent with exponential backoff
          const evaluationResult = await withAIModelBackoff(() => 
            evaluationAgent.generate(evaluationPrompt)
          );
          
          const evaluationText = evaluationResult.text;
          
          // Parse the evaluation results
          const criteriaScores: { [key: string]: number } = {};
          let rawEvaluation = {};
          let totalScore = 0;
          
          try {
            // Try to parse as JSON first (preferred format)
            rawEvaluation = JSON.parse(evaluationText);
            if (rawEvaluation && typeof rawEvaluation === 'object' && 'criteria' in rawEvaluation) {
              const criteriaObj = (rawEvaluation as any).criteria;
              if (criteriaObj && typeof criteriaObj === 'object') {
                // Extract scores from JSON format
                for (const criterion of criteria) {
                  if (criterion in criteriaObj && 
                      typeof criteriaObj[criterion] === 'object' && 
                      'score' in criteriaObj[criterion]) {
                    const score = Number(criteriaObj[criterion].score);
                    criteriaScores[criterion] = isNaN(score) ? 5 : Math.min(10, Math.max(0, score));
                  } else {
                    criteriaScores[criterion] = 5; // Default score
                  }
                }
                
                // Use provided average if available and valid
                if ('average' in rawEvaluation && 
                    typeof (rawEvaluation as any).average === 'number') {
                  totalScore = (rawEvaluation as any).average;
                } else {
                  totalScore = Object.values(criteriaScores).reduce((sum, score) => sum + score, 0) / criteria.length;
                }
              }
            } else {
              throw new Error('Invalid JSON format');
            }
          } catch (parseError) {
            // JSON解析に失敗した場合、テキスト形式での解析を試みる
            // エラーを報告
            handleJsonParseFailure(parseError, evaluationText, {
              thought: thought.id,
              stage
            });
            
            // Extract scores for each criterion using regex
            criteria.forEach(criterion => {
              const regex = new RegExp(`${criterion}[：:](\\s*)(\\d+)(?:\\.\\d+)?`, 'i');
              const match = evaluationText.match(regex);
              if (match && match[2]) {
                criteriaScores[criterion] = Math.min(10, Math.max(0, parseInt(match[2], 10)));
              } else {
                criteriaScores[criterion] = 5; // Default score
              }
            });
            
            // Calculate the total score
            totalScore = Object.values(criteriaScores).reduce((sum, score) => sum + score, 0) / criteria.length;
            
            // このthoughtに対するフォールバック処理が必要だったことを記録
            isFallback = true;
          }
          
          // Add evaluated thought
          evaluatedThoughts.push({
            ...thought,
            score: totalScore,
            evaluationCriteria: criteriaScores,
            reasoning: evaluationText
          });
        } catch (evalError) {
          // 個別の思考評価に失敗した場合
          reportError('thought_evaluation_error', evalError, {
            thoughtId: thought.id,
            stage
          });
          
          // デフォルトスコアを割り当て
          const defaultScores: { [key: string]: number } = {};
          criteria.forEach(c => defaultScores[c] = 5); // デフォルトは中間点の5
          
          // フォールバック評価を追加
          evaluatedThoughts.push({
            ...thought,
            score: 5, // デフォルトスコア
            evaluationCriteria: defaultScores,
            reasoning: "評価プロセス中にエラーが発生したため、デフォルト評価を適用しました。"
          });
          
          // フォールバックが使用されたことを記録
          isFallback = true;
        }
      }
      
      // Sort by score
      const sortedThoughts = [...evaluatedThoughts].sort((a, b) => b.score - a.score);
      
      return {
        evaluatedThoughts: sortedThoughts,
        bestThought: sortedThoughts[0],
        criteria,
        stage,
        timestamp: new Date().toISOString(),
        isFallback
      };
    } catch (error: unknown) {
      // エラー報告を追加
      reportError('thought_evaluation_batch_error', error, {
        thoughtCount: thoughts.length,
        stage
      });
      
      console.error(`[ToT] 思考評価エラー:`, error);
      
      // エラー時のフォールバック評価を生成
      const fallbackEvaluations: EvaluatedThought[] = thoughts.map((thought, index) => {
        // インデックスに基づいて少し異なるスコアを付与（同点を避ける）
        const baseScore = 7.0; // 比較的高めのデフォルトスコア
        const scoreVariation = Math.max(0, (thoughts.length - index) / thoughts.length * 2); // 0-2の範囲で変動
        const score = baseScore - scoreVariation;
        
        // デフォルトの評価基準スコア
        const defaultScores: { [key: string]: number } = {};
        criteria.forEach(c => defaultScores[c] = Math.round(score));
        
        return {
          ...thought,
          score,
          evaluationCriteria: defaultScores,
          reasoning: "エラーによりデフォルト評価が適用されました。"
        };
      }).sort((a, b) => b.score - a.score);
      
      return {
        evaluatedThoughts: fallbackEvaluations,
        bestThought: fallbackEvaluations[0],
        criteria,
        stage,
        timestamp: new Date().toISOString(),
        isFallback: true
      };
    }
  }
});

/**
 * 最適経路選択ツール
 * 
 * 評価された思考から最適な経路を選択します。
 */
export const pathSelector = createTool({
  id: "Path Selector",
  inputSchema: z.object({
    evaluatedThoughts: z.array(z.object({
      id: z.string(),
      content: z.string(),
      score: z.number(),
      evaluationCriteria: z.record(z.number()).optional(),
      reasoning: z.string().optional()
    })).describe("評価済みの思考リスト"),
    stage: z.enum(["planning", "analysis", "insight"]).describe("選択するステージ"),
    selectionStrategy: z.enum(["best", "hybrid", "diverse"]).optional().default("best").describe("選択戦略"),
    context: z.any().optional().describe("追加コンテキスト情報（オプション）"),
    modelOverride: z.any().optional().describe("モデルをオーバーライドするための関数（オプション）"),
  }),
  description: "評価された思考から最適な経路を選択します",
  execute: async ({ context: { evaluatedThoughts, stage, selectionStrategy = "best", context, modelOverride } }) => {
    console.log(`[ToT] 経路選択: ステージ=${stage}, 戦略=${selectionStrategy}, 思考数=${evaluatedThoughts.length}`);
    
    try {
      let selectedPath;
      let reasoningForSelection;
      
      if (selectionStrategy === "best") {
        // 最高スコアの思考を選択
        selectedPath = evaluatedThoughts[0]; // 既にスコア順にソート済みと仮定
        reasoningForSelection = `最高スコア（${selectedPath.score.toFixed(2)}）の思考を選択しました。`;
      } 
      else if (selectionStrategy === "hybrid") {
        // Create hybrid thought using an AI agent
        const pathSelectionAgent = new Agent({
          name: "Path Selection Agent",
          instructions: `あなたは思考経路を統合する専門家です。複数の思考の強みを組み合わせて、新しい統合的な思考を生成してください。`,
          model: modelOverride || openai(totConfig.generationModel),
        });
        
        if (evaluatedThoughts.length >= 2) {
          const top1 = evaluatedThoughts[0];
          const top2 = evaluatedThoughts[1];
          
          const hybridPrompt = `以下の2つの思考を組み合わせて、新しい統合的な思考を生成してください：

思考1 (スコア: ${top1.score.toFixed(2)}):
"""
${top1.content}
"""

思考2 (スコア: ${top2.score.toFixed(2)}):
"""
${top2.content}
"""

これらの思考の強みを統合した新しい思考を生成してください。`;

          const hybridResult = await pathSelectionAgent.generate(hybridPrompt);
          const hybridContent = hybridResult.text;
          
          selectedPath = {
            id: nanoid(),
            content: hybridContent,
            score: (top1.score + top2.score) / 2,
            evaluationCriteria: top1.evaluationCriteria,
            reasoning: `上位2つの思考の強みを組み合わせました。`
          };
          reasoningForSelection = `上位2つの思考（スコア: ${top1.score.toFixed(2)}と${top2.score.toFixed(2)}）を組み合わせました。`;
        } else {
          selectedPath = evaluatedThoughts[0];
          reasoningForSelection = `思考が1つしかないため、その思考を選択しました。`;
        }
      }
      else if (selectionStrategy === "diverse") {
        // Create diverse selection using an AI agent
        const pathSelectionAgent = new Agent({
          name: "Path Selection Agent",
          instructions: `あなたは思考経路を選択する専門家です。多様性を考慮して、高スコアだけでなくユニークな視点も持つ思考を選択してください。`,
          model: modelOverride || openai(totConfig.generationModel),
        });
        
        // Create prompt for diverse selection
        let selectionPrompt = `以下の思考から、多様性を考慮して最適な思考を1つ選択してください：\n\n`;
        
        evaluatedThoughts.slice(0, Math.min(3, evaluatedThoughts.length)).forEach((thought, index) => {
          selectionPrompt += `思考 ${index + 1} (スコア: ${thought.score.toFixed(2)}):\n"""${thought.content}"""\n\n`;
        });
        
        selectionPrompt += `上記の思考から、スコアだけでなく多様性や独自の視点も考慮して1つを選択し、その理由を説明してください。
回答は「思考X」のように選択する思考の番号を明示してください。`;

        const selectionResult = await pathSelectionAgent.generate(selectionPrompt);
        const selectionText = selectionResult.text;
        
        // Extract selected thought number
        const match = selectionText.match(/思考\s*(\d+)/i);
        const selectedIndex = match && match[1] ? Math.min(parseInt(match[1]) - 1, 2) : 0;
        
        selectedPath = evaluatedThoughts[selectedIndex];
        reasoningForSelection = `多様性を考慮して、上位3つの中から思考${selectedIndex + 1}を選択しました。理由: ${selectionText.replace(/^思考\s*\d+[：:]\s*/i, '')}`;
      }
      
      return {
        selectedPath,
        allPaths: evaluatedThoughts,
        reasoning: reasoningForSelection,
        stage,
        selectionStrategy,
        timestamp: new Date().toISOString()
      };
    } catch (error: unknown) {
      console.error(`[ToT] 経路選択エラー:`, error);
      throw new Error(`経路選択中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});

/**
 * Beam Search と統合するためのアダプタ関数
 * 親ノードから次の思考を生成して評価までを行います
 * 
 * @param parentNode 親思考ノード
 * @param options 生成オプション
 * @returns 評価済みの子思考ノード配列
 */
export async function generateNextThoughts(
  parentNode: Node<Thought>,
  options: {
    stage?: "planning" | "analysis" | "insight";
    query?: string;
    context?: any;
    maxThoughts?: number;
  } = {}
): Promise<Node<Thought>[]> {
  const {
    stage = "planning",
    query = "", 
    context = undefined,
    maxThoughts = totConfig.branchingFactor
  } = options;

  console.log(
    `[ToT] 次の思考生成: 親=${parentNode.data.content.substring(0, 50)}...`
  );

  try {
    // 1. 思考生成
    // 親ノードの内容をプロンプトの一部として追加
    const thoughtContext = {
      query: query || parentNode.data.content, // クエリがない場合は親の内容を使用
      stage,
      maxThoughts,
      context: context || {
        previousThought: parentNode.data.content,
        depth: parentNode.depth
      }
    };

    // ツールが利用可能か確認
    if (!thoughtGenerator || typeof thoughtGenerator.execute !== 'function') {
      console.error("[ToT] thoughtGeneratorツールが利用できません");
      return [];
    }

    // 暫定対応: containerオブジェクトの提供と型アサーション
    const executeResult = await thoughtGenerator.execute({
      context: thoughtContext,
      container: {} as any // 暫定対応: 型エラー回避
    });
    
    // 戻り値のタイプを安全に処理
    const generatorResult = executeResult as unknown as { 
      thoughts: Thought[], 
      stage: string, 
      query: string,
      prompt: string,
      timestamp: string,
      isFallback: boolean
    };
    
    const thoughts = generatorResult.thoughts;

    if (!thoughts || thoughts.length === 0) {
      console.warn("[ToT] 思考生成に失敗しました");
      return [];
    }

    // 2. 生成された各思考に親IDを設定
    const thoughtsWithParent = thoughts.map((thought: Thought) => ({
      ...thought,
      parentId: parentNode.id
    }));

    // ツールが利用可能か確認
    if (!thoughtEvaluator || typeof thoughtEvaluator.execute !== 'function') {
      console.error("[ToT] thoughtEvaluatorツールが利用できません");
      return [];
    }

    // 3. 思考評価
    const evaluatorResult = await thoughtEvaluator.execute({
      context: {
        thoughts: thoughtsWithParent,
        stage,
        // 評価に役立つ可能性のある追加コンテキスト
        context: {
          parentThought: parentNode.data,
          depth: parentNode.depth + 1
        }
      },
      container: {} as any // 暫定対応: 型エラー回避
    }) as unknown as {
      evaluatedThoughts: EvaluatedThought[],
      bestThought: EvaluatedThought,
      criteria: string[],
      stage: string,
      timestamp: string,
      isFallback: boolean
    };

    const evaluatedThoughts = evaluatorResult.evaluatedThoughts;

    if (!evaluatedThoughts || evaluatedThoughts.length === 0) {
      console.warn("[ToT] 思考評価に失敗しました");
      return [];
    }

    // 4. Node<Thought>形式に変換
    return evaluatedThoughts.map((thought: EvaluatedThought) => ({
      id: thought.id,
      data: thought,
      score: thought.score || 0,
      depth: parentNode.depth + 1,
      parentId: parentNode.id
    }));
  } catch (error) {
    console.error("[ToT] 次の思考生成中にエラー:", error);
    return [];
  }
}
