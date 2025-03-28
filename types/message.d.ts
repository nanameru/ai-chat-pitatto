import type { Message as AIMessage } from 'ai';

// AIのMessage型を拡張
declare module 'ai' {
  interface Message extends AIMessage {
    // X検索結果の型
    xSearchResults?: Array<{
      id: string;
      title: string;
      url: string;
      content: string;
      source: string;
    }>;
    // X検索クエリ
    xSearchQuery?: string;
    // 推論プロセス
    reasoning?: string;
  }
}
