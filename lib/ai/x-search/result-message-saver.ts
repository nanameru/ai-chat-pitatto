/**
 * XSearchResultMessageテーブルにデータを登録するための専用モジュール
 */

import { XSearchError } from './types';
import type { TwitterPost } from '@/lib/ai/coze/coze';
import { db } from '../../db';
import { nanoid } from 'nanoid';

/**
 * 指定されたミリ秒数待機するヘルパー関数
 * @param ms 待機時間（ミリ秒）
 */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * セッションのステータスをポーリングして確認する
 * @param supabase Supabaseクライアント
 * @param sessionId セッションID
 * @param targetStatus 目標ステータス
 * @param maxAttempts 最大試行回数
 * @param intervalMs ポーリング間隔（ミリ秒）
 * @returns ステータスが目標に達したかどうか
 */
async function waitForSessionStatus(
  supabase: any,
  sessionId: string,
  targetStatus: string,
  maxAttempts = 30,  // デフォルトは30回試行（30秒）
  intervalMs = 1000  // デフォルトは1秒間隔
): Promise<boolean> {
  console.log(`\x1b[46m\x1b[30m[XSearchService] ステータス確認\x1b[0m \x1b[36m'${targetStatus}' になるのを待機中...\x1b[0m`);
  console.log(`\x1b[36m----------------------------------------------------------\x1b[0m`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // セッション情報を取得
    const { data: session, error } = await supabase
      .from('XSearchSession')
      .select('status')
      .eq('id', sessionId)
      .single();
    
    if (error) {
      console.error(`[XSearchService] セッションステータス確認エラー:`, error);
      return false;
    }
    
    if (session && session.status === targetStatus) {
      console.log(`\x1b[42m\x1b[30m[XSearchService] ステータス確認成功\x1b[0m \x1b[32m'${targetStatus}' になりました\x1b[0m`);
    console.log(`\x1b[32m==========================================================\x1b[0m`);
      return true;
    }
    
    console.log(`\x1b[43m\x1b[30m[XSearchService] ステータス確認中\x1b[0m \x1b[33m'${session?.status || '不明'}' (試行 ${attempt + 1}/${maxAttempts})\x1b[0m`);
    await sleep(intervalMs);
  }
  
  console.warn(`\x1b[41m\x1b[37m[XSearchService] ステータス確認失敗\x1b[0m \x1b[31m'${targetStatus}' になりませんでした（タイムアウト）\x1b[0m`);
  console.log(`\x1b[31m==========================================================\x1b[0m`);
  return false;
}

/**
 * 検索結果をXSearchResultMessageテーブルに登録する
 * @param searchResults 検索結果の配列
 * @param messageId メッセージID
 * @param chatId チャットID
 */
export async function saveSearchResultMessages(
  searchResults: TwitterPost[], 
  messageId: string, 
  chatId: string
): Promise<void> {
  try {
    console.log(`\x1b[36m[XSearchService] 処理開始: ${searchResults.length}件の検索結果をXSearchResultMessageに登録します\x1b[0m`);
    
    // Supabaseクライアントを取得
    const supabase = await db.getClient();
    
    // セッション情報を取得
    const { data: session, error: sessionError } = await supabase
      .from('XSearchSession')
      .select('*')
      .eq('messageId', messageId)
      .single();
    
    if (sessionError) {
      console.error(`[XSearchService] セッション取得エラー:`, sessionError);
      throw new XSearchError('session_error', 'セッション情報の取得に失敗しました', sessionError);
    }
    
    if (!session) {
      console.error(`[XSearchService] セッションが見つかりません: messageId=${messageId}`);
      throw new XSearchError('session_not_found', 'セッション情報が見つかりません');
    }
    
    console.log(`\x1b[36m[XSearchService] セッション情報:\x1b[0m`, {
      sessionId: session.id,
      messageId: session.messageId,
      query: session.query,
      status: `\x1b[33m${session.status}\x1b[0m`
    });
    
    // XSearchResultテーブルへの保存が完了するのを待つ
    const resultsReady = await waitForSessionStatus(supabase, session.id, 'results_saved', 60, 1000);
    
    if (!resultsReady) {
      console.warn(`\x1b[43m\x1b[30m[XSearchService] 警告\x1b[0m \x1b[33mXSearchResultテーブルへの保存が完了していない可能性がありますが、処理を続行します\x1b[0m`);
      console.log(`\x1b[33m----------------------------------------------------------\x1b[0m`);
    } else {
      console.log(`\x1b[42m\x1b[30m[XSearchService] 成功\x1b[0m \x1b[32mXSearchResultテーブルへの保存が完了しました、XSearchResultMessageに登録を開始します\x1b[0m`);
      console.log(`\x1b[32m==========================================================\x1b[0m`);
    }
    
    console.log(`\x1b[44m\x1b[37m[XSearchService] XSearchResultMessage登録処理開始: ${searchResults.length}件\x1b[0m`);
    console.log(`\x1b[36m----------------------------------------------------------\x1b[0m`);
    
    // 一括挿入用のデータ配列
    const bulkInsertData: any[] = [];
    const resultMap: Map<string, string> = new Map(); // xPostId -> resultIdのマッピング
    
    // まず、全てのxPostIdを取得
    const xPostIds = searchResults.map(result => result.id);
    console.log(`\x1b[36m[XSearchService] 検索結果のxPostId数: ${xPostIds.length}\x1b[0m`);
    
    // XSearchResultから一括で結果データを取得
    const { data: resultDataArray, error: resultError } = await supabase
      .from('XSearchResult')
      .select('id, xPostId')
      .in('xPostId', xPostIds);
    
    if (resultError) {
      console.error(`\x1b[41m\x1b[37m[XSearchService] XSearchResult一括取得エラー\x1b[0m`);
      console.error(JSON.stringify(resultError, null, 2));
      throw new XSearchError('fetch_results_error', 'XSearchResultテーブルからのデータ取得に失敗しました', resultError);
    }
    
    console.log(`\x1b[36m[XSearchService] XSearchResultから取得したデータ数: ${resultDataArray?.length || 0}\x1b[0m`);
    
    // xPostId -> resultId のマップを作成
    if (resultDataArray && resultDataArray.length > 0) {
      resultDataArray.forEach(item => {
        if (item.xPostId && item.id) {
          resultMap.set(item.xPostId, item.id);
        }
      });
    }
    
    console.log(`\x1b[36m[XSearchService] マップに登録された結果データ数: ${resultMap.size}\x1b[0m`);
    
    // 各検索結果に対して処理
    for (const result of searchResults) {
      try {
        const resultId = resultMap.get(result.id);
        
        if (!resultId) {
          console.warn(`\x1b[33m[XSearchService] 結果データが見つかりません: xPostId=${result.id}\x1b[0m`);
          continue;
        }
        
        // スコア情報を取得
        const embeddingScore = (result as any).embeddingScore || 0;
        const rerankScore = (result as any).rerankScore || null;
        const finalScore = (result as any).finalScore || embeddingScore; // 初期値としてembeddingScoreを使用
        
        // 挿入データを作成
        bulkInsertData.push({
          id: nanoid(),
          resultId: resultId,
          sessionId: session.id,
          messageId: messageId,
          embeddingScore: embeddingScore,
          rerankScore: rerankScore,
          finalScore: finalScore,
          createdAt: new Date()
        });
      } catch (itemError) {
        console.error(`\x1b[31m[XSearchService] 検索結果処理エラー: ${(itemError as Error).message}\x1b[0m`);
      }
    }
    
    console.log(`\x1b[36m[XSearchService] 一括挿入用データ数: ${bulkInsertData.length}\x1b[0m`);
    
    // データがあれば一括挿入を実行
    if (bulkInsertData.length > 0) {
      try {
        console.log(`\x1b[44m\x1b[37m[XSearchService] XSearchResultMessage一括挿入開始\x1b[0m`);
        
        // 一括挿入の実行
        const { data: messageData, error: messageError } = await supabase
          .from('XSearchResultMessage')
          .insert(bulkInsertData)
          .select();
        
        if (messageError) {
          console.error(`\x1b[41m\x1b[37m[XSearchService] XSearchResultMessage一括挿入エラー\x1b[0m`);
          console.error(JSON.stringify({
            code: messageError.code,
            details: messageError.details,
            message: messageError.message
          }, null, 2));
          console.log(`\x1b[31m==========================================================\x1b[0m`);
          
          // エラーが発生した場合、個別に挿入を試みる
          console.log(`\x1b[33m[XSearchService] 一括挿入に失敗しました。個別に挿入を試みます...\x1b[0m`);
          
          let successCount = 0;
          for (const insertData of bulkInsertData) {
            try {
              const { data, error } = await supabase
                .from('XSearchResultMessage')
                .insert(insertData)
                .select();
              
              if (error) {
                console.error(`\x1b[31m[XSearchService] 個別挿入エラー: resultId=${insertData.resultId}\x1b[0m`);
              } else {
                successCount++;
              }
            } catch (err) {
              console.error(`\x1b[31m[XSearchService] 個別挿入例外: ${(err as Error).message}\x1b[0m`);
            }
          }
          
          console.log(`\x1b[33m[XSearchService] 個別挿入結果: ${successCount}/${bulkInsertData.length}件成功\x1b[0m`);
        } else {
          console.log(`\x1b[42m\x1b[30m[XSearchService] XSearchResultMessage一括挿入成功\x1b[0m \x1b[32m${messageData?.length || 0}件\x1b[0m`);
          console.log(`\x1b[32m==========================================================\x1b[0m`);
        }
      } catch (bulkError) {
        console.error(`\x1b[41m\x1b[37m[XSearchService] XSearchResultMessage一括挿入例外\x1b[0m`);
        console.error((bulkError as Error).message);
        console.log(`\x1b[31m==========================================================\x1b[0m`);
      }
    } else {
      console.warn(`\x1b[43m\x1b[30m[XSearchService] 警告\x1b[0m \x1b[33m挿入するデータがありません\x1b[0m`);
      console.log(`\x1b[33m==========================================================\x1b[0m`);
    }
    
    console.log(`\x1b[32m[XSearchService] 処理完了: XSearchResultMessageへの登録が完了しました\x1b[0m`);
  } catch (error) {
    console.error(`[XSearchService] saveSearchResultMessagesエラー:`, error);
    throw new XSearchError('save_result_messages_error', 'XSearchResultMessageテーブルへの登録に失敗しました', error);
  }
}
