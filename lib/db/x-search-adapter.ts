import { DatabaseAdapter } from './adapter';
import { db } from './index';
import { v4 as uuidv4 } from 'uuid';
import { TwitterPost } from '@/lib/ai/coze/coze';
import { XSearchResult, XSearchResultMessage } from '@/lib/ai/x-search/types';

/**
 * X検索用のデータベースアダプター実装
 * DatabaseAdapterインターフェースを実装し、X検索に必要なデータベース操作を提供します
 */
export class XSearchAdapter implements DatabaseAdapter {
  /**
   * ユーザークエリを保存する
   * @param queryText ユーザーが入力した検索クエリテキスト
   * @param chatId チャットセッションのID
   * @returns 保存されたメッセージのID
   */
  async saveUserQuery(queryText: string, chatId: string): Promise<string> {
    const messageId = uuidv4();
    
    try {
      // Supabaseクライアントを取得
      const supabase = await db.getClient();
      
      // Messageテーブルにユーザークエリを保存
      await supabase
        .from('Message')
        .insert({
          id: messageId,
          chatId: chatId,
          role: 'user',
          content: JSON.stringify({
            type: 'x_search_query',
            text: queryText,
            timestamp: new Date().toISOString()
          }),
          createdAt: new Date()
        });
      
      console.log(`[XSearchAdapter] Saved user query: ${queryText} for chat ${chatId} with ID ${messageId}`);
      return messageId;
    } catch (error) {
      console.error('[XSearchAdapter] Error saving user query:', error);
      throw error;
    }
  }

  /**
   * サブクエリを保存する
   * @param subQueries 生成されたサブクエリの配列
   * @param messageId 親メッセージのID
   * @param chatId チャットセッションのID
   * @returns 保存されたサブクエリのID配列
   */
  async saveSubQueries(subQueries: string[], messageId: string, chatId: string): Promise<string[]> {
    const subQueryIds: string[] = [];
    
    try {
      // Supabaseクライアントを取得
      const supabase = await db.getClient();
      
      // サブクエリごとにIDを生成し、Messageテーブルに保存
      for (const subQuery of subQueries) {
        const subQueryId = uuidv4();
        
        await supabase
          .from('Message')
          .insert({
            id: subQueryId,
            chatId: chatId,
            role: 'system',
            parentId: messageId,
            content: JSON.stringify({
              type: 'x_search_subquery',
              text: subQuery,
              timestamp: new Date().toISOString()
            }),
            createdAt: new Date()
          });
        
        subQueryIds.push(subQueryId);
      }
      
      console.log(`[XSearchAdapter] Saved ${subQueries.length} subqueries for message ${messageId}`);
      return subQueryIds;
    } catch (error) {
      console.error('[XSearchAdapter] Error saving subqueries:', error);
      throw error;
    }
  }

  /**
   * 検索結果を保存する
   * @param results 検索結果の配列
   * @param messageId 親メッセージのID
   * @param sessionId セッションID
   */
  async saveSearchResults(results: TwitterPost[], messageId: string, sessionId: string): Promise<void> {
    try {
      // Supabaseクライアントを取得
      const supabase = await db.getClient();
      
      // 各検索結果をXSearchResultテーブルに保存し、XSearchResultMessageで関連付け
      for (let i = 0; i < results.length; i++) {
        const post = results[i];
        
        // XSearchResultに保存（既存のものがあれば更新）
        const xPostId = post.id;
        
        // 既存のレコードを確認
        const { data: existingResult } = await supabase
          .from('XSearchResult')
          .select('id')
          .eq('xPostId', xPostId)
          .maybeSingle();
        
        let resultId: string;
        
        if (existingResult) {
          // 既存のレコードを更新
          resultId = existingResult.id;
          
          await supabase
            .from('XSearchResult')
            .update({
              content: post.text,
              source_title: `${post.author.name} (@${post.author.username})`,
              source_url: `https://x.com/${post.author.username}/status/${post.id}`,
              metadata: JSON.stringify({
                author: post.author,
                metrics: post.metrics,
                created_at: post.created_at,
                id: post.id
              }),
              updatedAt: new Date()
            })
            .eq('id', resultId);
        } else {
          // 新しいレコードを作成
          resultId = uuidv4();
          
          await supabase
            .from('XSearchResult')
            .insert({
              id: resultId,
              xPostId: xPostId,
              content: post.text,
              source_title: `${post.author.name} (@${post.author.username})`,
              source_url: `https://x.com/${post.author.username}/status/${post.id}`,
              metadata: JSON.stringify({
                author: post.author,
                metrics: post.metrics,
                created_at: post.created_at,
                id: post.id
              }),
              createdAt: new Date(),
              updatedAt: new Date()
            });
        }
        
        // スコア情報を取得（存在する場合）
        const embeddingScore = (post as any).embeddingScore || 0;
        const rerankScore = (post as any).rerankScore || 0;
        const finalScore = (post as any).finalScore || 0;
        
        // XSearchResultMessageに関連付け
        const resultMessageId = uuidv4();
        
        await supabase
          .from('XSearchResultMessage')
          .insert({
            id: resultMessageId,
            messageId: messageId,
            resultId: resultId,
            embeddingScore: embeddingScore,
            rerankScore: rerankScore,
            finalScore: finalScore,
            sessionId: sessionId,
            createdAt: new Date()
          });
      }
      
      console.log(`[XSearchAdapter] Saved ${results.length} search results for message ${messageId}`);
    } catch (error) {
      console.error('[XSearchAdapter] Error saving search results:', error);
      throw error;
    }
  }
}
