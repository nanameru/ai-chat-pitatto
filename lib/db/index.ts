/**
 * データベース接続とユーティリティ関数のエクスポート
 */

import { createClient } from './queries';

// データベースクライアントをエクスポート
export const db = {
  /**
   * Supabaseクライアントを作成する
   * @returns Supabaseクライアントインスタンス
   */
  getClient: async () => {
    return await createClient();
  }
};

// アダプターのエクスポート
export type { DatabaseAdapter } from './adapter';
export { XSearchAdapter } from './x-search-adapter';
