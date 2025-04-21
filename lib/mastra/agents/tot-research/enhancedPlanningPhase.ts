/**
 * Tree of Thoughts (ToT) 強化計画フェーズ
 * 
 * Beam Search アルゴリズムを使用してより深い思考探索を行う拡張計画フェーズの実装
 */

import { nanoid } from "nanoid";
import { totResearchAgent } from "./index";
import { Thought, ResearchPlan } from "../../types/tot";
import { totConfig } from "../../config/totConfig";
import { beamSearch, Node } from "../../algorithms/beamSearch";
import { generateNextThoughts } from "../../tools/tot/thought-tools";
import { researchPlanGenerator } from "../../tools/tot/planning-tools";
import { ToolCall, ToolResult, GenerateResult, ReasoningStep } from "./types";

/**
 * 強化された計画フェーズの実行
 * Beam Search を使用してより深い思考探索を行います
 * 
 * @param query ユーザーのクエリ
 * @returns 研究計画と思考プロセスを含む結果
 */
export async function executeEnhancedPlanningPhase(query: string) {
  console.log(`[ToT Research+] 強化計画フェーズ実行: クエリ=${query.substring(0, 50)}...`);
  
  // 推論ステップを記録
  const reasoningSteps: ReasoningStep[] = [
    {
      id: nanoid(),
      timestamp: new Date().toISOString(),
      type: 'planning',
      title: 'Beam Search による強化計画フェーズを開始',
      content: `クエリ「${query}」について深度=${totConfig.maxDepth}、ビーム幅=${totConfig.beamWidth}の探索を行います。`,
      metadata: {
        phase: 'enhanced_planning',
        currentStep: 1,
        totalSteps: totConfig.maxDepth + 2 // 初期 + 探索深度 + 最終統合
      }
    }
  ];

  try {
    // 1. 初期思考を生成（ルートノード）
    console.log(`[ToT Research+] 初期思考を生成: ${query.substring(0, 50)}...`);
    
    const initialThought: Thought = {
      id: nanoid(),
      content: query,
      score: undefined,
      confidence: undefined,
      evidence: [],
      metadata: { stage: "planning", index: 0 }
    };
    
    // ルートノードの作成
    const rootNode: Node<Thought> = {
      id: nanoid(),
      data: initialThought,
      score: 0, // 初期スコアは0
      depth: 0  // ルートの深さは0
    };
    
    reasoningSteps.push({
      id: nanoid(),
      timestamp: new Date().toISOString(),
      type: 'thought_root',
      title: '初期思考（ルートノード）',
      content: query,
      metadata: {
        phase: 'enhanced_planning',
        currentStep: 2,
        totalSteps: totConfig.maxDepth + 2
      }
    });

    // 2. Beam Search を実行
    console.log(`[ToT Research+] Beam Search 探索を開始: 深さ=${totConfig.maxDepth}, ビーム幅=${totConfig.beamWidth}`);
    
    // 思考生成のためのアダプタ関数を設定
    const expandFunction = async (node: Node<Thought>): Promise<Node<Thought>[]> => {
      return await generateNextThoughts(node, {
        stage: "planning",
        query: query,
        maxThoughts: totConfig.branchingFactor
      });
    };
    
    // Beam Search アルゴリズムを実行
    const exploredNodes = await beamSearch(
      expandFunction,
      rootNode.data,
      rootNode.score,
      {
        maxDepth: totConfig.maxDepth,
        beamWidth: totConfig.beamWidth,
        costBudget: totConfig.costBudget,
        logger: (message) => console.log(`[ToT Search] ${message}`)
      }
    );
    
    // 探索結果を記録
    for (let depth = 1; depth <= totConfig.maxDepth; depth++) {
      const nodesAtDepth = exploredNodes.filter(node => node.depth === depth);
      
      if (nodesAtDepth.length > 0) {
        // 各深さでの探索結果の概要をステップとして記録
        reasoningSteps.push({
          id: nanoid(),
          timestamp: new Date().toISOString(),
          type: 'thought_exploration',
          title: `深さ${depth}の思考探索`,
          content: `深さ${depth}で${nodesAtDepth.length}個の思考を探索しました。上位スコア: ${
            nodesAtDepth.slice(0, 3).map(n => n.score.toFixed(2)).join(', ')
          }`,
          metadata: {
            phase: 'enhanced_planning',
            currentStep: 2 + depth,
            totalSteps: totConfig.maxDepth + 2
          }
        });
        
        // トップ3の思考を詳細に記録
        nodesAtDepth.slice(0, 3).forEach((node, idx) => {
          reasoningSteps.push({
            id: nanoid(),
            timestamp: new Date().toISOString(),
            type: 'thought_detail',
            title: `深さ${depth}の思考 #${idx + 1} (スコア: ${node.score.toFixed(2)})`,
            content: node.data.content,
            metadata: {
              phase: 'enhanced_planning',
              currentStep: 2 + depth,
              totalSteps: totConfig.maxDepth + 2,
              subStep: idx + 1
            }
          });
        });
      }
    }
    
    // 3. 最高スコアの思考を選択
    const bestNode = exploredNodes.sort((a, b) => b.score - a.score)[0];
    
    if (!bestNode) {
      throw new Error("有効な思考が生成されませんでした");
    }
    
    console.log(`[ToT Research+] 最良の思考を選択: スコア=${bestNode.score.toFixed(2)}, 深さ=${bestNode.depth}`);
    
    reasoningSteps.push({
      id: nanoid(),
      timestamp: new Date().toISOString(),
      type: 'path_selection',
      title: '最良の思考経路を選択',
      content: `スコア ${bestNode.score.toFixed(2)} の思考を選択しました:\n\n${bestNode.data.content}`,
      metadata: {
        phase: 'enhanced_planning',
        currentStep: totConfig.maxDepth + 1,
        totalSteps: totConfig.maxDepth + 2
      }
    });
    
    // 4. 選択された思考から研究計画を生成
    console.log(`[ToT Research+] 研究計画を生成`);
    
    // @ts-ignore - マニュアルでのビルドステップなので一時的に無視
    const planResult = await researchPlanGenerator.execute({
      context: {
        selectedThought: {
          id: bestNode.id,
          content: bestNode.data.content,
          score: bestNode.score
        },
        query: query,
        maxSubtopics: 5,
        maxQueries: 5
      }
    });
    
    // 最終ステップを追加
    reasoningSteps.push({
      id: nanoid(),
      timestamp: new Date().toISOString(),
      type: 'research_plan',
      title: '研究計画生成完了',
      content: `研究計画:\n${JSON.stringify(planResult.researchPlan, null, 2)}`,
      metadata: {
        phase: 'enhanced_planning',
        currentStep: totConfig.maxDepth + 2,
        totalSteps: totConfig.maxDepth + 2
      }
    });
    
    // 5. 結果を返す（推論ステップを含む）
    const enhancedResult: GenerateResult = {
      // 基本的なテキスト応答を含める
      text: `Tree of Thoughts アプローチで研究計画を作成しました。深さ${totConfig.maxDepth}、ビーム幅${totConfig.beamWidth}で探索を行い、最良の思考経路に基づいて計画を立てました。`,
      
      // 研究計画と探索データを含めたメタデータ
      metadata: {
        researchPlan: planResult.researchPlan,
        beamSearchStats: {
          nodesExplored: exploredNodes.length,
          maxDepthReached: Math.max(...exploredNodes.map(n => n.depth)),
          bestScore: bestNode.score
        },
        thoughtTree: exploredNodes.map(node => ({
          id: node.id,
          content: node.data.content.substring(0, 100) + "...",
          score: node.score,
          depth: node.depth,
          parentId: node.parentId
        })),
        selectedThought: {
          id: bestNode.id,
          content: bestNode.data.content,
          score: bestNode.score,
          depth: bestNode.depth
        }
      },
      
      // 推論ステップを追加
      reasoningSteps: reasoningSteps
    };
    
    console.log(`[ToT Research+] 強化計画フェーズ完了: ノード数=${exploredNodes.length}, 最高スコア=${bestNode.score.toFixed(2)}`);
    
    return enhancedResult;
    
  } catch (error) {
    console.error(`[ToT Research+] 強化計画フェーズエラー:`, error);
    
    // エラーステップを追加
    reasoningSteps.push({
      id: nanoid(),
      timestamp: new Date().toISOString(),
      type: 'error',
      title: '強化計画フェーズでエラーが発生',
      content: `エラー: ${error instanceof Error ? error.message : String(error)}`,
      metadata: {
        phase: 'enhanced_planning',
        currentStep: reasoningSteps.length + 1,
        totalSteps: reasoningSteps.length + 1
      }
    });
    
    // エラー結果を返す
    const errorResult: GenerateResult = {
      text: `研究計画の生成中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      reasoningSteps: reasoningSteps,
      error: error instanceof Error ? error : new Error(String(error))
    };
    
    return errorResult;
  }
} 