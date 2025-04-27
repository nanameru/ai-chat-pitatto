/**
 * データベース接続とユーティリティ関数のエクスポート
 */

import { createClient } from './queries';
import { news } from './schema';

// データベースクライアントをエクスポート
export const db = {
  /**
   * Supabaseクライアントを作成する
   * @returns Supabaseクライアントインスタンス
   */
  getClient: async () => {
    return await createClient();
  },
  
  /**
   * ニュース記事関連の操作
   */
  news: {
    /**
     * 条件に一致するニュース記事の数をカウント
     */
    count: async (options: { where?: any }) => {
      const supabase = await createClient();
      let query = supabase.from('News').select('id', { count: 'exact' });
      
      if (options.where) {
        // whereの条件を処理
        Object.entries(options.where).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            // 比較演算子がある場合（例: { gte: date }）
            Object.entries(value).forEach(([op, val]) => {
              switch(op) {
                case 'gte':
                  query = query.gte(key, val);
                  break;
                case 'lte':
                  query = query.lte(key, val);
                  break;
                case 'gt':
                  query = query.gt(key, val);
                  break;
                case 'lt':
                  query = query.lt(key, val);
                  break;
                default:
                  console.warn(`Unsupported operator: ${op}`);
              }
            });
          } else {
            // 単純な等価条件
            query = query.eq(key, value);
          }
        });
      }
      
      const { count, error } = await query;
      
      if (error) {
        console.error('Failed to count news:', error);
        throw error;
      }
      
      return count || 0;
    },
    
    /**
     * ニュース記事を作成
     */
    create: async (data: any) => {
      const supabase = await createClient();
      
      // 日付オブジェクトをPostgreSQLと互換性のあるISO文字列に変換
      const preparedData = { ...data };
      
      // 日付文字列を正規化（PostgreSQLが理解できるISO形式にする）
      if (preparedData.publishedAt) {
        // 日付オブジェクトをISO形式に変換（既にISO形式なら変更なし）
        try {
          if (preparedData.publishedAt instanceof Date) {
            preparedData.publishedAt = preparedData.publishedAt.toISOString();
          } else if (typeof preparedData.publishedAt === 'string') {
            // 日本語のロケール形式などが含まれる場合は一度Dateを通してISOに変換
            if (preparedData.publishedAt.includes('日本標準時')) {
              preparedData.publishedAt = new Date(preparedData.publishedAt).toISOString();
            }
            // すでにISO形式ならそのまま
          }
          console.log(`正規化された日付: ${preparedData.publishedAt}`);
        } catch (error) {
          console.error('日付変換エラー:', error);
        }
      }
      
      const { data: result, error } = await supabase.from('News').insert(preparedData).select().single();
      
      if (error) {
        console.error('Failed to create news:', error);
        console.error('Attempted to insert data:', JSON.stringify(preparedData));
        throw error;
      }
      
      return result;
    }
  }
};

// アダプターのエクスポート
export type { DatabaseAdapter } from './adapter';
export { XSearchAdapter } from './x-search-adapter';
