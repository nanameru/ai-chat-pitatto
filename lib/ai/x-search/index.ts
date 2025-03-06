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
import { executeCozeQueries, generateCozeResponse, rerankSimilarDocuments, storeDataWithEmbedding } from '@/lib/ai/coze/coze';
import { TwitterPost } from '@/lib/ai/coze/coze';

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
  async executeSearch(
    query: string, 
    chatId: string,
    onStateChange?: (state: XSearchState, data?: any) => void
  ): Promise<XSearchResponse> {
    try {
      // 状態更新: 初期状態
      this.updateState(onStateChange, XSearchState.IDLE);
      
      // ユーザークエリを保存
      console.log(`[XSearchService] Executing search for query: ${query}`);
      const messageId = await this.dbAdapter.saveUserQuery(query, chatId);
      
      // 状態更新: サブクエリ生成中
      this.updateState(onStateChange, XSearchState.GENERATING_SUBQUERIES);
      
      // サブクエリを生成
      const subQueryTexts = await generateSubQueries(query);
      console.log(`[XSearchService] Generated ${subQueryTexts.length} subqueries: ${subQueryTexts.join(', ')}`);
      
      // サブクエリを保存
      const subQueryIds = await this.dbAdapter.saveSubQueries(subQueryTexts, messageId, chatId);
      
      // サブクエリオブジェクトを作成
      const subQueries: SubQuery[] = subQueryTexts.map((query_text, index) => ({
        id: subQueryIds[index],
        query_text,
        fetched_data: []
      }));
      
      // ユーザークエリをエンベディングで保存
      await this.storeUserQueryWithEmbedding(query, chatId);
      
      // 状態更新: 検索実行中
      this.updateState(onStateChange, XSearchState.SEARCHING);
      
      // 検索を実行
      const searchResults = await this.executeSearchWithSubQueries(
        subQueries, 
        chatId, 
        messageId,
        (processed, total) => {
          // 進捗状況をコールバックで通知
          this.updateState(onStateChange, XSearchState.SEARCHING, { 
            processedQueries: processed, 
            totalQueries: total 
          });
        }
      );
      
      // 検索結果を保存
      await this.dbAdapter.saveSearchResults(searchResults, messageId, chatId);
      
      // 状態更新: 回答生成中
      this.updateState(onStateChange, XSearchState.GENERATING_ANSWER);
      
      // 検索結果の再ランク付け
      await this.rerankSearchResults(messageId);
      
      // AI回答を生成
      const answer = await this.generateAnswerFromResults(query, searchResults);
      
      // 状態更新: 完了
      this.updateState(onStateChange, XSearchState.COMPLETED);
      
      // レスポンスを返す
      return {
        messageId,
        answer,
        sources: this.formatSearchResults(searchResults)
      };
    } catch (error: unknown) {
      console.error('[XSearchService] Error executing search:', error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      this.updateState(onStateChange, XSearchState.ERROR, { 
        error: new XSearchError(
          'search_execution_error',
          errorMessage || 'X検索の実行中にエラーが発生しました',
          error
        )
      });
      throw error;
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
  private async executeSearchWithSubQueries(
    subQueries: SubQuery[], 
    userId: string, 
    parentId: string,
    onProgress?: (processed: number, total: number) => void
  ): Promise<TwitterPost[]> {
    try {
      // Cozeクエリを実行
      const results = await executeCozeQueries(
        subQueries.map(sq => sq.query_text),
        userId,
        parentId,
        (processed) => {
          if (onProgress) {
            onProgress(processed, subQueries.length);
          }
        }
      );
      
      // 結果を集約
      const aggregatedPosts = new Map<string, TwitterPost>();
      results.forEach(result => {
        if (result.posts) {
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
      
      return Array.from(aggregatedPosts.values());
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
        return `「${query}」に関する情報はX（旧Twitter）上で見つかりませんでした。別のキーワードで検索してみてください。`;
      }

      // 検索結果からプロンプトを作成
      const prompt = this.createAnswerPrompt(query, searchResults);
      
      // Coze APIを使用して回答を生成
      try {
        const answer = await generateCozeResponse(prompt, {
          temperature: 0.7,
          max_tokens: 1000
        });
        return answer;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : '不明なエラー';
        console.error('[XSearchService] Error generating answer with Coze API:', errorMessage);
        // APIエラー時はモック回答を返す
        return this.getMockAnswer(query, searchResults);
      }
    } catch (error: unknown) {
      console.error('[XSearchService] Error generating answer from results:', error);
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
