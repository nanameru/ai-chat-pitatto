/**
 * データベースアダプターのインターフェース
 * X検索機能に必要なデータベース操作を抽象化します
 */
export interface DatabaseAdapter {
  /**
   * ユーザークエリを保存する
   * @param queryText ユーザーが入力した検索クエリテキスト
   * @param chatId チャットセッションのID
   * @returns 保存されたメッセージのID
   */
  saveUserQuery(queryText: string, chatId: string): Promise<string>;

  /**
   * サブクエリを保存する
   * @param subQueries 生成されたサブクエリの配列
   * @param messageId 親メッセージのID
   * @param chatId チャットセッションのID
   * @returns 保存されたサブクエリのID配列
   */
  saveSubQueries(subQueries: string[], messageId: string, chatId: string): Promise<string[]>;

  /**
   * 検索結果を保存する
   * @param results 検索結果の配列
   * @param messageId 親メッセージのID
   * @param sessionId セッションID
   */
  saveSearchResults(results: any[], messageId: string, sessionId: string): Promise<void>;
}
