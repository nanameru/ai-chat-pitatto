/**
 * X検索サービス
 * ユーザークエリからサブクエリを生成し、検索を実行して結果を返す
 */

import { DatabaseAdapter } from '../../db/adapter';
import { XSearchAdapter } from '../../db/x-search-adapter';
import { generateSubQueries } from './subquery-generator';
import { 
  XSearchResponse, 
  XSearchSource, 
  XSearchState, 
  XSearchError, 
  FetchedData, 
  SubQuery, 
  XSearchResult, 
  XSearchResultMessage,
  ProcessedPosts
} from './types';
import { 
  executeCozeQueries, 
  executeParallelCozeQueries, 
  generateCozeResponse, 
  rerankSimilarDocuments, 
  storeDataWithEmbedding,
  TwitterPost
} from '@/lib/ai/coze/coze';

// デバッグモードの設定
const DEBUG_MODE = true;

/**
 * デバッグログを出力する関数
 * サーバーサイドとクライアントサイドの両方で動作するように設計
 */
function debugLog(...args: any[]) {
  if (!DEBUG_MODE) return;
  
  // サーバーサイドとクライアントサイドの両方でログを出力
  console.log(...args);
  
  // クライアントサイドの場合、window.consoleにも出力
  if (typeof window !== 'undefined') {
    // ブラウザ環境の場合
    const prefix = '[X-Search Debug]';
    window.console.log(prefix, ...args);
    
    // 開発ツールのコンソールに目立つように表示
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Error')) {
      window.console.error(prefix, ...args);
    } else if (args[0] && typeof args[0] === 'string' && args[0].includes('Warning')) {
      window.console.warn(prefix, ...args);
    } else if (args[0] && typeof args[0] === 'string' && (args[0].includes('Starting') || args[0].includes('Completed'))) {
      window.console.info(prefix, ...args);
    }
  }
}

/**
 * X検索サービスクラス
 * 検索フローを管理し、データベースとの連携を行う
 */
export class XSearchService {
  private dbAdapter: DatabaseAdapter;
  
  /**
   * コンストラクタ
   * @param dbAdapter データベースアダプター（省略時はXSearchAdapterを使用）
   */
  constructor(dbAdapter?: DatabaseAdapter) {
    this.dbAdapter = dbAdapter || new XSearchAdapter();
  }
  
  /**
   * X検索を実行する
   * @param query ユーザーの検索クエリ
   * @param chatId チャットセッションのID
   * @param onStateChange 状態変更時のコールバック関数（オプション）
   * @returns X検索レスポンス
   */
  /**
   * X検索を実行する
   * @param query ユーザーの検索クエリ
   * @param chatId チャットセッションのID
   * @param onStateChange 状態変更時のコールバック関数（オプション）
   * @returns X検索レスポンス
   */
  async executeSearch(
    query: string, 
    chatId: string,
    onStateChange?: (state: XSearchState, data?: any) => void
  ): Promise<XSearchResponse> {
    try {
      let messageId: string;
      
      // ===== ステップ1: ユーザークエリの処理 =====
      console.log('\n===== ステップ1: ユーザークエリの処理 =====');
      console.log(`[XSearchService] ユーザークエリ: ${query}`);
      
      // 状態更新: 開始
      this.updateState(onStateChange, XSearchState.IDLE);
      
      try {
        // ユーザークエリを保存
        console.log(`[XSearchService] クエリをデータベースに保存します...`);
        messageId = await this.dbAdapter.saveUserQuery(query, chatId);
        console.log(`[XSearchService] クエリを保存しました。メッセージID: ${messageId}`);
        
        // ユーザークエリをエンベディングで保存
        console.log(`[XSearchService] ユーザークエリのエンベディングを保存しています...`);
        await this.storeUserQueryWithEmbedding(query, chatId);
        console.log(`[XSearchService] ステップ1完了: ユーザークエリの処理が完了しました`);
      } catch (error) {
        console.error(`[XSearchService] ステップ1でエラーが発生しました:`, error);
        throw new XSearchError('query_processing_error', 'ユーザークエリの処理中にエラーが発生しました', error);
      }
      
      // ===== ステップ2: サブクエリの生成 =====
      console.log('\n===== ステップ2: サブクエリの生成 =====');
      // 状態更新: サブクエリ生成中
      this.updateState(onStateChange, XSearchState.GENERATING_SUBQUERIES);
      
      let subQueries: SubQuery[];
      try {
        // サブクエリを生成
        console.log(`[XSearchService] サブクエリを生成しています...`);
        const subQueryTexts = await generateSubQueries(query);
        console.log(`[XSearchService] ${subQueryTexts.length}個のサブクエリを生成しました:`);
        subQueryTexts.forEach((sq, i) => console.log(`  ${i+1}. ${sq}`));
        
        // サブクエリが生成されたか確認
        if (!subQueryTexts || subQueryTexts.length === 0) {
          throw new XSearchError('no_subqueries', 'サブクエリを生成できませんでした');
        }
        
        // サブクエリを保存
        console.log(`[XSearchService] サブクエリをデータベースに保存しています...`);
        const subQueryIds = await this.dbAdapter.saveSubQueries(subQueryTexts, messageId, chatId);
        console.log(`[XSearchService] サブクエリを保存しました。`);
        
        // サブクエリオブジェクトを作成
        subQueries = subQueryTexts.map((query_text, index) => ({
          id: subQueryIds[index],
          query_text,
          fetched_data: []
        }));
        
        console.log(`[XSearchService] ステップ2完了: ${subQueries.length}個のサブクエリの生成と保存が完了しました`);
      } catch (error) {
        console.error(`[XSearchService] ステップ2でエラーが発生しました:`, error);
        throw new XSearchError('subquery_generation_error', 'サブクエリの生成中にエラーが発生しました', error);
      }
      
      // ===== ステップ3: 並列検索の実行 =====
      console.log('\n===== ステップ3: 並列検索の実行 =====');
      // 状態更新: 検索実行中
      this.updateState(onStateChange, XSearchState.SEARCHING);
      
      let searchResults: TwitterPost[];
      try {
        // 並列検索を実行
        console.log(`[XSearchService] ${subQueries.length}個のサブクエリで並列検索を実行しています...`);
        searchResults = await this.executeSearchWithSubQueries(
          subQueries, 
          chatId, 
          messageId,
          (processed, total) => {
            // 進捗状況をコールバックで通知
            console.log(`[XSearchService] 進捗状況: ${processed}/${total} クエリを処理しました`);
            this.updateState(onStateChange, XSearchState.SEARCHING, { 
              processedQueries: processed, 
              totalQueries: total 
            });
          }
        );
        
        // 検索結果が取得できたか確認
        console.log(`[XSearchService] ${searchResults.length}件の検索結果を取得しました`);
        
        // 検索結果を保存
        console.log(`[XSearchService] 検索結果をデータベースに保存しています...`);
        await this.dbAdapter.saveSearchResults(searchResults, messageId, chatId);
        console.log(`[XSearchService] 検索結果を保存しました`);
        
        // 検索結果の再ランク付け
        console.log(`[XSearchService] 検索結果の再ランク付けを行っています...`);
        await this.rerankSearchResults(messageId);
        
        console.log(`[XSearchService] ステップ3完了: 並列検索の実行と結果の保存が完了しました`);
      } catch (error) {
        console.error(`[XSearchService] ステップ3でエラーが発生しました:`, error);
        throw new XSearchError('search_execution_error', '検索の実行中にエラーが発生しました', error);
      }
      
      // 検索結果の詳細をログに出力
      console.log('\n===== 検索結果の詳細 =====');
      if (searchResults.length === 0) {
        console.log(`[XSearchService] 検索結果は0件です`);
      } else {
        searchResults.forEach((result, i) => {
          console.log(`\n結果 ${i+1}:`);
          console.log(`  投稿者: ${result.author.name} (@${result.author.username})`);
          console.log(`  投稿日時: ${result.created_at}`);
          console.log(`  本文: ${result.text.substring(0, 100)}${result.text.length > 100 ? '...' : ''}`);
          console.log(`  いいね数: ${result.metrics.likes}, リツイート数: ${result.metrics.retweets}, 返信数: ${result.metrics.replies}`);
          console.log(`  URL: https://x.com/${result.author.username}/status/${result.id}`);
        });
      }
      
      // 検索結果が0件の場合は特別なメッセージを返す
      if (searchResults.length === 0) {
        const defaultAnswer = `「${query}」に関する情報はX（旧Twitter）上で見つかりませんでした。別のキーワードで検索してみてください。`;
        console.log(`[XSearchService] 検索結果が0件のため、デフォルトメッセージを返します: ${defaultAnswer}`);
        
        // 状態更新: 完了
        this.updateState(onStateChange, XSearchState.COMPLETED);
        
        return {
          messageId,
          answer: defaultAnswer,
          sources: []
        };
      }
      
      // ===== ステップ4: AI回答の生成 =====
      console.log('\n===== ステップ4: AI回答の生成 =====');
      // 状態更新: 回答生成中
      this.updateState(onStateChange, XSearchState.GENERATING_ANSWER);
      
      let answer: string;
      try {
        // AI回答を生成
        console.log(`[XSearchService] ${searchResults.length}件の検索結果からAI回答を生成しています...`);
        answer = await this.generateAnswerFromResults(query, searchResults);
        console.log(`[XSearchService] AI回答の生成が完了しました (${answer.length}文字)`);
        console.log(`[XSearchService] ステップ4完了: AI回答の生成が完了しました`);
      } catch (error) {
        console.error(`[XSearchService] ステップ4でエラーが発生しました:`, error);
        throw new XSearchError('answer_generation_error', 'AI回答の生成中にエラーが発生しました', error);
      }
      
      // 状態更新: 完了
      this.updateState(onStateChange, XSearchState.COMPLETED);
      console.log('\n===== X検索プロセスが完了しました =====');
      
      // レスポンスを返す
      return {
        messageId,
        answer,
        sources: this.formatSearchResults(searchResults)
      };
    } catch (error: unknown) {
      console.error('[XSearchService] X検索の実行中にエラーが発生しました:', error);
      
      // エラー状態を通知
      const xError = error instanceof XSearchError 
        ? error 
        : new XSearchError(
            'unknown_error', 
            '不明なエラーが発生しました', 
            error
          );
      
      this.updateState(onStateChange, XSearchState.ERROR, { error: xError });
      throw xError;
    }
  }
  
  /**
   * ユーザークエリをエンベディングで保存する
   * @param query ユーザークエリ
   * @param userId ユーザーID
   */
  private async storeUserQueryWithEmbedding(query: string, userId: string): Promise<void> {
    try {
      await storeDataWithEmbedding(
        query,
        [{
          sourceTitle: 'User Query',
          sourceUrl: '',
          content: query,
          metadata: {
            type: 'user_query',
            timestamp: new Date().toISOString()
          }
        }],
        userId
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      console.error('[XSearchService] Error storing user query with embedding:', errorMessage);
      // エラーをスローせず、処理を続行
    }
  }
  
  /**
   * サブクエリを使用して検索を実行する
   * @param subQueries サブクエリの配列
   * @param userId ユーザーID
   * @param parentId 親クエリID
   * @param onProgress 進捗状況のコールバック関数
   * @returns 検索結果の配列
   */
  /**
   * サブクエリを使用して並列検索を実行する
   * @param subQueries サブクエリの配列
   * @param userId ユーザーID
   * @param parentId 親ID（チャットIDやメッセージID）
   * @param onProgress 進捗状況のコールバック関数
   * @returns 検索結果の配列
   */
  private async executeSearchWithSubQueries(
    subQueries: SubQuery[], 
    userId: string, 
    parentId: string,
    onProgress?: (processed: number, total: number) => void
  ): Promise<TwitterPost[]> {
    try {
      console.log(`[XSearchService] ${subQueries.length}個のサブクエリを並列実行します...`);
      console.log('[XSearchService] サブクエリ一覧:');
      subQueries.forEach((sq, i) => console.log(`  ${i+1}. ${sq.query_text}`));
      
      // 並列実行オプション
      const options = {
        skipStorage: false // データベースへの保存を行う
      };
      
      // Cozeクエリを並列実行
      console.log('[XSearchService] executeParallelCozeQueriesを呼び出します...');
      const results = await executeParallelCozeQueries(
        subQueries.map(sq => sq.query_text),
        userId,
        parentId,
        (processed) => {
          console.log(`[XSearchService] 並列実行進捗: ${processed}/${subQueries.length} 完了`);
          if (onProgress) {
            onProgress(processed, subQueries.length);
          }
        },
        options
      );
      
      // 並列実行が完了したことを確認
      if (!results || results.length === 0) {
        console.log('[XSearchService] 警告: 並列実行の結果が空です');
        return [];
      }
      
      console.log(`[XSearchService] 並列実行が完了しました。${results.length}件の結果を取得しました。`);
      
      // 結果の概要をログ出力
      results.forEach((result, i) => {
        console.log(`[XSearchService] 結果 ${i+1}: クエリ「${result.query}」- ${result.posts?.length || 0}件の投稿${result.error ? ` (エラー: ${result.error})` : ''}`);
      });
      
      // 結果を集約
      console.log('[XSearchService] 検索結果を集約しています...');
      const aggregatedPosts = new Map<string, TwitterPost>();
      let totalPostsCount = 0;
      
      results.forEach(result => {
        if (result.posts) {
          totalPostsCount += result.posts.length;
          result.posts.forEach((post: TwitterPost) => {
            // 重複を排除するためにMapを使用
            if (!aggregatedPosts.has(post.id)) {
              // URLとドメイン情報を追加
              const postWithUrl = {
                ...post,
                url: `https://x.com/${post.author.username}/status/${post.id}`,
                domain: 'x.com'
              } as TwitterPost & { url: string; domain: string };
              aggregatedPosts.set(post.id, postWithUrl);
            }
          });
        }
      });
      
      const uniquePosts = Array.from(aggregatedPosts.values());
      console.log(`[XSearchService] 集約完了: 合計${totalPostsCount}件の投稿から${uniquePosts.length}件の一意な投稿を抽出しました`);
      
      return uniquePosts;
    } catch (error: unknown) {
      console.error('[XSearchService] Error executing search with subqueries:', error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      throw new XSearchError(
        'subquery_search_error',
        `サブクエリでの検索実行中にエラーが発生しました: ${errorMessage}`,
        error
      );
    }
  }
  
  /**
   * 検索結果の再ランク付けを行う
   * @param queryId クエリID
   */
  private async rerankSearchResults(queryId: string): Promise<void> {
    try {
      await rerankSimilarDocuments(queryId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      console.error('[XSearchService] Error reranking search results:', errorMessage);
      // エラーをスローせず、処理を続行
    }
  }
  
  /**
   * 検索結果からAI回答を生成する
   * @param query 元のユーザークエリ
   * @param searchResults 検索結果
   * @returns 生成されたAI回答
   */
  private async generateAnswerFromResults(query: string, searchResults: TwitterPost[]): Promise<string> {
    try {
      // 検索結果が少ない場合
      if (searchResults.length === 0) {
        debugLog(`[XSearchService] 検索結果が0件のため、デフォルトメッセージを返します`);
        return `「${query}」に関する情報はX（旧Twitter）上で見つかりませんでした。別のキーワードで検索してみてください。`;
      }

      // 検索結果からプロンプトを作成
      debugLog(`[XSearchService] 回答生成用のプロンプトを作成しています...`);
      const prompt = this.createAnswerPrompt(query, searchResults);
      debugLog(`[XSearchService] プロンプトを作成しました（${prompt.length}文字）`);
      debugLog(`[XSearchService] プロンプトの一部: ${prompt.substring(0, 200)}...`);
      
      // Coze APIを使用して回答を生成
      try {
        debugLog(`[XSearchService] Coze APIを使用して回答を生成しています...`);
        const answer = await generateCozeResponse(prompt, {
          temperature: 0.7,
          max_tokens: 1000
        });
        debugLog(`[XSearchService] Coze APIから回答を受け取りました（${answer.length}文字）`);
        return answer;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : '不明なエラー';
        debugLog('[XSearchService] Coze APIでの回答生成中にエラーが発生しました:', errorMessage);
        debugLog(`[XSearchService] フォールバックとしてモック回答を生成します`);
        // APIエラー時はモック回答を返す
        return this.getMockAnswer(query, searchResults);
      }
    } catch (error: unknown) {
      console.error('[XSearchService] 回答生成中にエラーが発生しました:', error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      throw new XSearchError(
        'answer_generation_error',
        `検索結果からの回答生成中にエラーが発生しました: ${errorMessage}`,
        error
      );
    }
  }

  /**
   * 回答生成用のプロンプトを作成する
   * @param query ユーザークエリ
   * @param searchResults 検索結果
   * @returns 回答生成用のプロンプト
   */
  private createAnswerPrompt(query: string, searchResults: TwitterPost[]): string {
    // 検索結果を整形
    const formattedResults = searchResults.slice(0, 10).map((post, index) => {
      return `
投稿${index + 1}:
ユーザー: ${post.author.name} (@${post.author.username})
日時: ${post.created_at}
内容: ${post.text}
リツイート: ${post.metrics.retweets} いいね: ${post.metrics.likes} 返信: ${post.metrics.replies}
URL: https://x.com/${post.author.username}/status/${post.id}
      `.trim();
    }).join('\n\n');

    // プロンプトテンプレート
    return `
あなたはX（旧Twitter）の検索結果を要約するAIアシスタントです。
以下のユーザークエリと、それに関連するX上の投稿を分析し、要約してください。

ユーザークエリ: "${query}"

X上の関連投稿:
${formattedResults}

これらの投稿を分析して、以下の点を含む要約を作成してください:
1. 主要な意見や情報
2. 対立する意見がある場合はそれらを対比
3. 特に注目すべき投稿や傾向
4. 情報の信頼性に関する注意点（必要な場合）

要約は日本語で、客観的かつ中立的な立場で作成してください。
情報源が限られていることを明記し、断定的な表現は避けてください。
回答は400〜600文字程度にまとめてください。
    `.trim();
  }
  
  /**
   * 検索結果をXSearchSource形式にフォーマットする
   * @param posts Twitter投稿の配列
   * @returns フォーマットされた検索結果
   */
  private formatSearchResults(posts: TwitterPost[]): XSearchSource[] {
    return posts.map(post => {
      // 基本的なソース情報
      const source: XSearchSource = {
        url: `https://x.com/${post.author.username}/status/${post.id}`,
        title: `${post.author.name} (@${post.author.username})`,
        content: post.text,
        createdAt: post.created_at,
        author: `@${post.author.username}`
      };
      
      // スコア情報があれば追加（XSearchResultMessageから取得する想定）
      if ('embeddingScore' in post) {
        source.embeddingScore = (post as any).embeddingScore;
      }
      if ('rerankScore' in post) {
        source.rerankScore = (post as any).rerankScore;
      }
      if ('finalScore' in post) {
        source.finalScore = (post as any).finalScore;
      }
      
      return source;
    });
  }
  
  /**
   * 状態を更新し、コールバック関数を呼び出す
   * @param onStateChange 状態変更時のコールバック関数
   * @param state 新しい状態
   * @param data 追加データ（オプション）
   */
  private updateState(
    onStateChange?: (state: XSearchState, data?: any) => void,
    state?: XSearchState,
    data?: any
  ): void {
    if (onStateChange && state) {
      onStateChange(state, data);
    }
  }
  
  /**
   * 開発用のモック回答を生成する
   * @param query 元のユーザークエリ
   * @param searchResults 検索結果
   * @returns モック回答
   */
  private getMockAnswer(query: string, searchResults: TwitterPost[]): string {
    const postCount = searchResults.length;
    const positiveCount = Math.floor(postCount * 0.6); // 60%が肯定的と仮定
    const negativeCount = Math.floor(postCount * 0.3); // 30%が否定的と仮定
    const neutralCount = postCount - positiveCount - negativeCount; // 残りは中立的

    // 最も人気のある投稿を取得（いいね数で判断）
    const popularPosts = [...searchResults].sort((a, b) => 
      (b.metrics.likes + b.metrics.retweets) - (a.metrics.likes + a.metrics.retweets)
    ).slice(0, 3);

    // 人気投稿のユーザー名を取得
    const popularUsers = popularPosts.map(post => `@${post.author.username}`).join('、');

    return `
「${query}」についてX（旧Twitter）で検索した結果、${postCount}件の関連投稿が見つかりました。

分析結果:
• 約${positiveCount}件の投稿が${query}について肯定的な意見を述べています
• 約${negativeCount}件の投稿が懸念や批判的な見解を示しています
• 残りの${neutralCount}件は中立的な情報共有や質問でした

特に注目を集めていたのは${popularUsers}などのユーザーの投稿で、多くのリツイートやいいねを獲得していました。

最新の傾向としては、${query}に関する議論が活発に行われており、様々な視点からの意見が交わされています。ただし、これらの情報はX上の限られた投稿に基づくものであり、全体像を把握するにはさらなる情報源の確認が推奨されます。

各投稿の詳細は、ソースリンクから確認できます。
    `.trim();
  }
}
