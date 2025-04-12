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
  }),
  description: "指定されたステージに応じて複数の思考経路を生成します",
  execute: async ({ context: { query, stage, maxThoughts, context } }) => {
    console.log(`[ToT] 思考生成: ステージ=${stage}, クエリ=${query.substring(0, 50)}...`);
    
    // ステージに応じたプロンプトを構築
    let prompt = "";
    let thoughtType = "";
    
    if (stage === "planning") {
      thoughtType = "調査アプローチ";
      prompt = `以下のクエリに対する${maxThoughts}つの異なる調査アプローチを生成してください:
"${query}"

各アプローチには以下を含めてください:
1. アプローチ名（簡潔に）
2. アプローチの詳細説明（2-3文）
3. 調査すべき主要サブトピック（3-5項目）
4. 必要な情報ソース

JSONではなく、自然な文章形式で返してください。各アプローチは明確に区切ってください。`;
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
        model: openai("gpt-4o-mini"),
      });
      
      // Generate thoughts using the agent
      console.log(`[ToT] 思考生成プロンプト: ${prompt.substring(0, 100)}...`);
      const thoughtResult = await thoughtAgent.generate(prompt);
      
      // Parse the generated thoughts
      const responseText = thoughtResult.text;
      
      // Simple parsing based on line breaks and numbers/separators
      const thoughtBlocks = responseText.split(/\n\s*\n|(?=\d+[\.\)]\s*[A-Z])/g)
        .filter(block => block.trim().length > 0)
        .slice(0, maxThoughts);
      
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
        timestamp: new Date().toISOString()
      };
    } catch (error: unknown) {
      console.error(`[ToT] 思考生成エラー:`, error);
      throw new Error(`思考生成中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
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
  }),
  description: "生成された思考を評価してスコア付けします",
  execute: async ({ context: { thoughts, stage, evaluationCriteria, context } }) => {
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
        instructions: `あなたは思考を評価する専門家です。与えられた思考を指定された評価基準に基づいて評価し、スコア付けしてください。
各基準について0〜10の数値スコアを提供し、評価理由を説明してください。
最終的に、すべての基準の平均値として総合スコアを計算してください。`,
        model: openai("gpt-4o-mini"),
      });
      
      // Evaluate each thought
      const evaluatedThoughts: EvaluatedThought[] = [];
      
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

        // Get evaluation from the agent
        const evaluationResult = await evaluationAgent.generate(evaluationPrompt);
        const evaluationText = evaluationResult.text;
        
        // Parse the evaluation results
        const criteriaScores: { [key: string]: number } = {};
        
        // Extract scores for each criterion
        criteria.forEach(criterion => {
          const regex = new RegExp(`${criterion}[：:]\\s*(\\d+(?:\\.\\d+)?)`, 'i');
          const match = evaluationText.match(regex);
          if (match && match[1]) {
            criteriaScores[criterion] = parseFloat(match[1]);
          } else {
            criteriaScores[criterion] = 5; // Default score
          }
        });
        
        // Calculate the total score
        const totalScore = Object.values(criteriaScores).reduce((sum, score) => sum + score, 0) / criteria.length;
        
        // Add evaluated thought
        evaluatedThoughts.push({
          ...thought,
          score: totalScore,
          evaluationCriteria: criteriaScores,
          reasoning: evaluationText
        });
      }
      
      // Sort by score
      const sortedThoughts = [...evaluatedThoughts].sort((a, b) => b.score - a.score);
      
      return {
        evaluatedThoughts: sortedThoughts,
        bestThought: sortedThoughts[0],
        criteria,
        stage,
        timestamp: new Date().toISOString()
      };
    } catch (error: unknown) {
      console.error(`[ToT] 思考評価エラー:`, error);
      throw new Error(`思考評価中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
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
  }),
  description: "評価された思考から最適な経路を選択します",
  execute: async ({ context: { evaluatedThoughts, stage, selectionStrategy = "best", context } }) => {
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
          model: openai("gpt-4o-mini"),
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
          model: openai("gpt-4o-mini"),
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
