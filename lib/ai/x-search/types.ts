/**
 * X検索関連の型定義
 * 新しいデータベース構造に対応した型定義を提供します
 */

import type { TwitterPost } from '@/lib/ai/coze/coze';

/**
 * X検索のソース情報
 * UI表示用の検索結果フォーマット
 */
export interface XSearchSource {
  /** ソースのURL */
  url: string;
  /** ソースのタイトル */
  title: string;
  /** ソースの内容 */
  content: string;
  /** ソースの作成日時 */
  createdAt?: string;
  /** ソースの著者 */
  author?: string;
  /** エンベディングスコア (0-1) */
  embeddingScore?: number;
  /** 再ランク付けスコア (0-1) */
  rerankScore?: number;
  /** 最終スコア (0-1) */
  finalScore?: number;
}

/**
 * X検索のレスポンス
 * フロントエンドに返すレスポンス形式
 */
export interface XSearchResponse {
  /** メッセージID */
  messageId: string;
  /** AI生成の回答 */
  answer: string;
  /** 検索結果のソース */
  sources: XSearchSource[];
}

/**
 * X検索の状態
 * 検索処理の各段階を表す列挙型
 */
export enum XSearchState {
  /** 初期状態 */
  IDLE = 'idle',
  /** サブクエリ生成中 */
  GENERATING_SUBQUERIES = 'generating_subqueries',
  /** 検索実行中 */
  SEARCHING = 'searching',
  /** 回答生成中 */
  GENERATING_ANSWER = 'generating_answer',
  /** 完了 */
  COMPLETED = 'completed',
  /** エラー */
  ERROR = 'error'
}

/**
 * X検索のエラー
 * エラー情報を詳細に表現するクラス
 */
export class XSearchError extends Error {
  /** エラーコード */
  code: string;
  /** エラーの詳細情報 */
  details?: any;

  /**
   * XSearchErrorコンストラクタ
   * @param code エラーコード
   * @param message エラーメッセージ
   * @param details 詳細情報（オプション）
   */
  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'XSearchError';
    this.code = code;
    this.details = details;
  }
}

/**
 * 取得したデータの型定義
 * XSearchResultテーブルに対応
 */
export interface FetchedData {
  /** データID */
  id: string;
  /** X投稿ID */
  xPostId: string;
  /** コンテンツ */
  content: string;
  /** ソースタイトル */
  source_title: string;
  /** ソースURL */
  source_url: string;
  /** メタデータ（JSON文字列として保存） */
  metadata?: Record<string, any>;
  /** エンベディング配列 */
  embedding?: number[];
  /** 作成日時 */
  createdAt: string;
  /** 更新日時 */
  updatedAt: string;
}

/**
 * サブクエリの型定義
 * Messageテーブルのサブクエリに対応
 */
export interface SubQuery {
  /** クエリID */
  id: string;
  /** クエリテキスト */
  query_text: string;
  /** 親クエリID */
  parentId?: string;
  /** 取得したデータ */
  fetched_data: FetchedData[];
  /** 作成日時 */
  createdAt?: string;
}

/**
 * クエリタイプの列挙型
 */
export enum QueryType {
  /** ユーザークエリ */
  USER = 'user',
  /** 自動生成クエリ */
  AUTO = 'auto',
  /** X検索クエリ */
  X_SEARCH = 'x_search',
  /** X検索サブクエリ */
  X_SEARCH_SUBQUERY = 'x_search_subquery'
}

/**
 * X検索結果の型定義
 * XSearchResultテーブルに対応
 */
export interface XSearchResult {
  /** 結果ID */
  id: string;
  /** X投稿ID */
  xPostId: string;
  /** コンテンツ */
  content: string;
  /** ソースタイトル */
  source_title: string;
  /** ソースURL */
  source_url: string;
  /** メタデータ（JSON文字列として保存） */
  metadata?: Record<string, any>;
  /** エンベディング配列 */
  embedding?: number[];
  /** 作成日時 */
  createdAt: string;
  /** 更新日時 */
  updatedAt: string;
}

/**
 * X検索結果とメッセージの関連付け
 * XSearchResultMessageテーブルに対応
 */
export interface XSearchResultMessage {
  /** ID */
  id: string;
  /** メッセージID */
  messageId: string;
  /** 結果ID */
  resultId: string;
  /** エンベディングスコア */
  embeddingScore: number;
  /** 再ランク付けスコア */
  rerankScore: number;
  /** 最終スコア */
  finalScore: number;
  /** セッションID */
  sessionId: string;
  /** 作成日時 */
  createdAt: string;
}

/**
 * 処理済みTwitter投稿の集合
 * 重複排除のために使用
 */
export type ProcessedPosts = Set<TwitterPost>;

/**
 * メッセージの型定義
 * Messageテーブルに対応
 */
export interface Message {
  /** メッセージID */
  id: string;
  /** チャットID */
  chatId: string;
  /** 役割（user, system, assistant） */
  role: 'user' | 'system' | 'assistant';
  /** 親メッセージID */
  parentId?: string;
  /** コンテンツ（JSON文字列として保存） */
  content: string;
  /** 作成日時 */
  createdAt: string;
}

/**
 * X検索クエリのコンテンツ型定義
 * Messageテーブルのcontent（JSON）に対応
 */
export interface XSearchQueryContent {
  /** コンテンツタイプ */
  type: 'x_search_query';
  /** 検索テキスト */
  text: string;
  /** タイムスタンプ */
  timestamp: string;
}

/**
 * X検索サブクエリのコンテンツ型定義
 * Messageテーブルのcontent（JSON）に対応
 */
export interface XSearchSubQueryContent {
  /** コンテンツタイプ */
  type: 'x_search_subquery';
  /** 検索テキスト */
  text: string;
  /** タイムスタンプ */
  timestamp: string;
}

/**
 * 検索結果メタデータの型定義
 * XSearchResultテーブルのmetadata（JSON）に対応
 */
export interface XSearchResultMetadata {
  /** 著者情報 */
  author: {
    /** 名前 */
    name: string;
    /** ユーザー名 */
    username: string;
    /** 認証済みかどうか */
    verified?: boolean;
  };
  /** メトリクス情報 */
  metrics: {
    /** リツイート数 */
    retweets: number;
    /** いいね数 */
    likes: number;
    /** 返信数 */
    replies: number;
  };
  /** 作成日時 */
  created_at: string;
  /** 投稿ID */
  id: string;
}
