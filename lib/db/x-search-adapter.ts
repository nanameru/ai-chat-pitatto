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
      
      // セッションの状態を更新（保存開始）
      await supabase
        .from('XSearchSession')
        .update({
          status: 'saving_results',
          progress: 50,
          updatedAt: new Date().toISOString()
        })
        .eq('id', sessionId);
      
      console.log(`\x1b[43m\x1b[30m[XSearchAdapter] ステータス変更\x1b[0m \x1b[33m'saving_results' → 検索結果の保存中\x1b[0m (sessionId=${sessionId})`);
      console.log(`\x1b[33m==========================================================\x1b[0m`);
      
      console.log(`\x1b[44m\x1b[37m[XSearchAdapter] XSearchResult一括登録処理開始: ${results.length}件\x1b[0m`);
      console.log(`\x1b[36m----------------------------------------------------------\x1b[0m`);
      
      // 全てのxPostIdを取得
      const xPostIds = results.map(post => post.id);
      
      // 既存のレコードを一括で確認
      const { data: existingResults, error: fetchError } = await supabase
        .from('XSearchResult')
        .select('id, xPostId')
        .in('xPostId', xPostIds);
      
      if (fetchError) {
        console.error(`\x1b[41m\x1b[37m[XSearchAdapter] 既存レコード一括取得エラー\x1b[0m`, fetchError);
        throw fetchError;
      }
      
      // xPostId -> id のマップを作成
      const existingMap = new Map<string, string>();
      if (existingResults && existingResults.length > 0) {
        existingResults.forEach(item => {
          if (item.xPostId) {
            existingMap.set(item.xPostId, item.id);
          }
        });
      }
      
      console.log(`\x1b[36m[XSearchAdapter] 既存レコード数: ${existingMap.size}/${xPostIds.length}\x1b[0m`);
      
      // 更新用と新規作成用のデータを分布
      const updateData: { id: string; data: any }[] = [];
      const insertData: any[] = [];
      const resultIdMap = new Map<string, string>(); // xPostId -> resultIdのマップ
      
      // XSearchResultMessage用のデータ配列
      const resultMessageData: any[] = [];
      
      // 各検索結果を処理
      for (const post of results) {
        const xPostId = post.id;
        let resultId: string;
        
        // 共通のデータを作成
        const commonData = {
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
        };
        
        if (existingMap.has(xPostId)) {
          // 既存レコードの更新
          const existingId = existingMap.get(xPostId);
          // existingMap.has(xPostId)で確認しているので存在するはずだが安全のために再確認
          if (!existingId) {
            console.warn(`\x1b[33m[XSearchAdapter] 予期せず存在しないレコード: xPostId=${xPostId}\x1b[0m`);
            continue;
          }
          resultId = existingId;
          updateData.push({
            id: resultId,
            data: commonData
          });
        } else {
          // 新規レコードの作成
          resultId = uuidv4();
          insertData.push({
            id: resultId,
            xPostId: xPostId,
            ...commonData,
            createdAt: new Date()
          });
        }
        
        // resultIdをマップに保存
        resultIdMap.set(xPostId, resultId);
        
        // スコア情報を取得
        const embeddingScore = (post as any).embeddingScore || 0;
        const rerankScore = (post as any).rerankScore || 0;
        const finalScore = (post as any).finalScore || 0;
        
        // XSearchResultMessage用のデータを作成
        resultMessageData.push({
          id: uuidv4(),
          messageId: messageId,
          resultId: resultId,
          embeddingScore: embeddingScore,
          rerankScore: rerankScore,
          finalScore: finalScore,
          sessionId: sessionId,
          createdAt: new Date()
        });
      }
      
      // 新規レコードの一括挿入
      if (insertData.length > 0) {
        console.log(`\x1b[36m[XSearchAdapter] 新規レコード数: ${insertData.length}\x1b[0m`);
        const { error: insertError } = await supabase
          .from('XSearchResult')
          .insert(insertData);
        
        if (insertError) {
          console.error(`\x1b[41m\x1b[37m[XSearchAdapter] XSearchResult一括挿入エラー\x1b[0m`, insertError);
          throw insertError;
        }
        console.log(`\x1b[42m\x1b[30m[XSearchAdapter] XSearchResult新規レコード一括挿入成功\x1b[0m`);
      }
      
      // 既存レコードの更新
      if (updateData.length > 0) {
        console.log(`\x1b[36m[XSearchAdapter] 更新レコード数: ${updateData.length}\x1b[0m`);
        
        // 一括更新はサポートされていないため、バッチ処理で更新
        const updatePromises = updateData.map(item => {
          return supabase
            .from('XSearchResult')
            .update(item.data)
            .eq('id', item.id);
        });
        
        const updateResults = await Promise.all(updatePromises);
        const updateErrors = updateResults.filter(result => result.error);
        
        if (updateErrors.length > 0) {
          console.error(`\x1b[43m\x1b[30m[XSearchAdapter] XSearchResult更新エラー: ${updateErrors.length}件\x1b[0m`);
          updateErrors.forEach(result => console.error(result.error));
        } else {
          console.log(`\x1b[42m\x1b[30m[XSearchAdapter] XSearchResult更新成功: ${updateData.length}件\x1b[0m`);
        }
      }
      
      // XSearchResultMessageの一括挿入は別の処理で行うため、ここではデータのみ返す
      console.log(`\x1b[36m[XSearchAdapter] XSearchResult一括処理完了: 合計${results.length}件\x1b[0m`);
      console.log(`\x1b[36m==========================================================\x1b[0m`);
      
      console.log(`[XSearchAdapter] Saved ${results.length} search results for message ${messageId}`);
      
      // すべての検索結果の保存が完了したらセッションの状態を更新
      await supabase
        .from('XSearchSession')
        .update({
          status: 'results_saved', // 新しいステータス：結果保存完了
          progress: 70,
          updatedAt: new Date().toISOString()
        })
        .eq('id', sessionId);
      
      console.log(`\x1b[42m\x1b[30m[XSearchAdapter] ステータス変更\x1b[0m \x1b[32m'results_saved' → 検索結果の保存完了\x1b[0m (sessionId=${sessionId})`);
      console.log(`\x1b[32m==========================================================\x1b[0m`);
    } catch (error) {
      console.error('[XSearchAdapter] Error saving search results:', error);
      throw error;
    }
  }
}
