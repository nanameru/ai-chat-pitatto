/**
 * Tree of Thoughts (ToT) 用 Beam Search アルゴリズム
 * 
 * 思考ツリーを幅優先で探索し、各深さでスコア上位のノードのみを保持します。
 */

import { nanoid } from "nanoid";
import { reportError } from "../utils/errorHandling";

/**
 * ビームサーチで使用するノードの基本インターフェース
 */
export interface Node<T> {
  id: string;      // ノード固有のID
  data: T;         // ノードが持つデータ
  score: number;   // 評価スコア（高いほど良い）
  depth: number;   // ルートからの深さ
  parentId?: string; // 親ノードのID（ルートノードでは未定義）
  isFallback?: boolean; // フォールバックノードかどうか
}

/**
 * ビームサーチの設定オプション
 */
export interface BeamSearchOptions {
  /** 最大探索深さ（デフォルト: 3） */
  maxDepth?: number;
  /** ビーム幅 - 各深さで保持するノード数（デフォルト: 3） */
  beamWidth?: number;
  /** コスト予算（省略可） */
  costBudget?: number;
  /** 進行をモニタリングするコールバック関数 */
  progressCallback?: (progress: {
    currentDepth: number;
    maxDepth: number;
    frontierSize: number;
    exploredNodes: number;
  }) => void;
  /** エラー時の最小ビーム幅（デフォルト: 1） */
  minBeamWidth?: number;
  /** ログ出力関数（省略可） */
  logger?: (message: string) => void;
  /** 実行ID（トレース用、省略可） */
  executionId?: string;
}

/**
 * ビームサーチアルゴリズムを実行する
 * 
 * @param expand ノードを展開する非同期関数
 * @param rootData ルートノードのデータ
 * @param options ビームサーチのオプション
 * @returns 探索されたノードの配列（スコア順）
 */
export async function beamSearch<T>(
  expand: (node: Node<T>) => Promise<Node<T>[]>,
  rootData: T,
  initialScore: number = 0,
  options: BeamSearchOptions = {}
): Promise<Node<T>[]> {
  // オプションのデフォルト値を設定
  const {
    maxDepth = 3,
    beamWidth = 3,
    minBeamWidth = 1,
    executionId = nanoid().substring(0, 8),
    logger = console.log
  } = options;

  // 進行コールバック関数
  const progressCallback = options.progressCallback || (() => {});

  // 累積コスト追跡（オプションでbudgetが指定されている場合）
  let cumulativeCost = 0;

  // ルートノードを作成
  const rootNode: Node<T> = {
    id: nanoid(),
    data: rootData,
    score: initialScore,
    depth: 0
  };

  // 現在のフロンティア（探索中のノード）
  let frontier: Node<T>[] = [rootNode];
  
  // すべての探索されたノードを保持（最終結果用）
  const explored: Node<T>[] = [rootNode];

  // 各深さごとに探索
  for (let depth = 1; depth <= maxDepth; depth++) {
    logger(`[Beam Search][${executionId}] 深さ ${depth}/${maxDepth} の探索を開始（ノード数: ${frontier.length}）`);
    
    if (frontier.length === 0) {
      logger(`[Beam Search][${executionId}] 探索を終了: フロンティアが空です`);
      break;
    }

    // 進捗を報告
    progressCallback({
      currentDepth: depth,
      maxDepth,
      frontierSize: frontier.length,
      exploredNodes: explored.length
    });

    // 各フロンティアノードを展開（並列実行）
    const expandResults = await Promise.allSettled(
      frontier.map(node => expand(node))
    );
    
    // 成功した結果と失敗した結果を分離
    const successfulExpandResults = expandResults
      .filter((result): result is PromiseFulfilledResult<Node<T>[]> => 
        result.status === 'fulfilled')
      .map(result => result.value);
      
    // 失敗した結果があれば報告
    const failedExpands = expandResults
      .filter((result): result is PromiseRejectedResult => 
        result.status === 'rejected');
      
    if (failedExpands.length > 0) {
      // エラーを報告するが、処理は続行
      failedExpands.forEach(failedResult => {
        const error = failedResult.reason;
        logger(`[Beam Search][${executionId}] ノード展開エラー: ${error instanceof Error ? error.message : String(error)}`);
        
        reportError('beam_search_expand_error', error, {
          depth,
          maxDepth,
          executionId,
          frontierSize: frontier.length,
          failedExpandsCount: failedExpands.length
        });
      });
    }
    
    // 展開されたノードをフラット化
    const expandedNodes = successfulExpandResults.flat();
    logger(`[Beam Search][${executionId}] 深さ ${depth} で ${expandedNodes.length} ノードを生成 (失敗: ${failedExpands.length})`);

    if (expandedNodes.length === 0) {
      logger(`[Beam Search][${executionId}] 注意: 子ノードが生成されませんでした。前の層を維持して継続します。`);
      
      // すべての展開が失敗した場合、現在のフロンティアを次の深さにも維持
      // これにより探索が完全に失敗するのを防ぐ
      frontier.forEach(node => {
        // クローンして深さを更新し、フォールバックとしてマーク
        const fallbackNode: Node<T> = {
          ...node,
          id: nanoid(),
          depth: depth,
          parentId: node.id,
          isFallback: true
        };
        explored.push(fallbackNode);
        expandedNodes.push(fallbackNode);
      });
      
      // それでも展開ノードがない場合は終了
      if (expandedNodes.length === 0) {
        logger(`[Beam Search][${executionId}] 探索を終了: 子ノードが生成されませんでした`);
        break;
      }
    }

    // スコア順にソートし、beamWidth 分だけ保持
    const sortedNodes = expandedNodes.sort((a, b) => b.score - a.score);
    
    // エラーが多発した場合はビーム幅を調整して最低限のノードを確保
    const currentBeamWidth = failedExpands.length > 0 
      ? Math.max(minBeamWidth, beamWidth - Math.floor(failedExpands.length / 2))
      : beamWidth;
    
    frontier = sortedNodes.slice(0, currentBeamWidth);
    
    if (currentBeamWidth < beamWidth) {
      logger(`[Beam Search][${executionId}] ビーム幅を縮小: ${beamWidth} → ${currentBeamWidth} (エラー多発のため)`);
    }
    
    // 探索済みノードに追加
    explored.push(...frontier);

    // コスト超過チェック
    if (options.costBudget) {
      // 実際のコスト計算はアプリケーション固有のロジックに置き換えてください
      cumulativeCost += frontier.length; // 単純化した例
      
      if (cumulativeCost > (options.costBudget || Infinity)) {
        logger(`[Beam Search][${executionId}] コスト予算超過のため探索を中断 (${cumulativeCost})`);
        
        reportError('beam_search_budget_exceeded', new Error('コスト予算超過'), {
          depth,
          maxDepth,
          executionId,
          cumulativeCost,
          budget: options.costBudget
        });
        
        break;
      }
    }
  }

  logger(`[Beam Search][${executionId}] 探索完了: ${explored.length} ノードを探索`);
  
  // スコア順にソートして返す
  return explored.sort((a, b) => b.score - a.score);
} 