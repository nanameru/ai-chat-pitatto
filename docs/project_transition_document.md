# 検索フローをカスタムデータベース構造に移行するためのガイド

このガイドでは、`app/search/new/page.tsx`の検索機能をフロントエンドを除いた形で新しいデータベース構造に移行する方法を説明します。移行先のプロダクトではすでにチャットUIが実装されているため、バックエンド機能のみを移行します。

## プロンプト

Next.jsの検索ページコンポーネント（app/search/new/page.tsx）のバックエンド機能を新しいデータベース構造に移行してください。元のコードはTwitter検索とAI回答生成のフローを実装していますが、データベーステーブルが変更されています。移行先のプロダクトではすでにチャットUIが実装されているため、フロントエンド部分は不要です。

## データベース構造の変更

### 元のテーブル構造:
1. queries - ユーザークエリとサブクエリを保存
2. fetched_data - Twitter投稿データを保存
3. rags - 再ランク付けされたデータを保存

### 新しいテーブル構造:
1. Message - ユーザーとの対話を保存
2. XSearchResult - X（Twitter）投稿データを一意に保存
3. XSearchResultMessage - 検索結果とメッセージの関連付けを管理

### フィールド対応表:

#### fetched_data → XSearchResult
- id → id
- content → content
- source_title → source_title
- source_url → source_url
- metadata → metadata
- embedding → embedding
- created_at → createdAt
- updated_at → updatedAt
- 新規: xPostId (Twitter投稿の一意識別子)

#### rags → XSearchResultMessage
- id → id
- query_id → messageId
- fetched_data_id → resultId
- score → embeddingScore
- rank → rerankScore
- created_at → createdAt
- 新規: sessionId (セッションを参照)
- 新規: finalScore (最終スコア)

#### queries → Message
- id → id
- query_text → content (JSON内)
- query_type → role
- created_at → createdAt
- 新規: chatId (チャットセッションを参照)

## 実装要件

1. データベースアダプターを作成して、新しいテーブル構造に対応させる
2. サブクエリ生成から検索、再ランク付け、AI回答生成までのフローを維持する
3. フロントエンド関連のコードは削除し、純粋なバックエンド機能として実装する

## 削除すべきフロントエンド関連のコード

以下のフロントエンド関連のコードは削除してください:

1. React関連のインポート:
   - `import { Suspense } from 'react';`
   - `import { useEffect, useState, useCallback, useRef } from 'react';`
   - `import { useSearchParams } from 'next/navigation';`

2. UIコンポーネントのインポート:
   - `import SubQueries from '@/components/search/sub-queries';`
   - `import GeneratedAnswer from '@/components/search/generated-answer';`
   - `import ProcessDetails from '@/components/search/process-details';`
   - `import { SourceSidebar } from '@/components/search/source-sidebar';`
   - `import FooterInput from '@/components/search/footer-input';`
   - `import { Analytics } from "@vercel/analytics/react";`

3. React関連の関数とフック:
   - `useDebounce` フック
   - `SearchNewPage` コンポーネント
   - `SearchContent` コンポーネント

4. 状態管理関連のコード:
   - `useState` を使用するすべてのコード
   - `useEffect` を使用するすべてのコード
   - `useRef` を使用するすべてのコード

5. UIレンダリング関連のコード:
   - JSXを返すすべてのコード
   - CSSクラスやスタイリング関連のコード

## 具体的な変更点

1. バックエンドサービスとして実装:
   - React/Next.jsのページコンポーネントではなく、純粋なTypeScriptモジュールとして実装
   - 状態管理をReactフックから通常の変数やクラスプロパティに変更
   - UIレンダリングコードを削除

2. データベース操作の抽象化:
   - Supabaseクライアントの直接使用を避け、データベースアダプターを介してアクセスする
   - クエリ保存、サブクエリ保存、結果取得などの操作をアダプターメソッドに置き換える

3. データ構造の変換:
   - Message形式でのクエリ保存（JSONフォーマット）
   - XSearchResultへのTwitterデータの保存（xPostIdの生成）
   - XSearchResultMessageでの関連付けとスコアリング

4. 主要な関数の修正:
   - generateNewSubQueries: サブクエリ生成と保存ロジックの修正
   - executeCozeQueries: 結果保存ロジックの修正
   - rerankSimilarDocuments: 再ランク付けロジックの修正

## コード例

### データベースアダプター
```typescript
// lib/db/adapter.ts
export interface DatabaseAdapter {
  saveUserQuery(queryText: string, chatId: string): Promise<string>;
  saveSubQueries(subQueries: string[], messageId: string, chatId: string): Promise<string[]>;
  saveSearchResults(results: any[], messageId: string, sessionId: string): Promise<void>;
  rerankResults(messageId: string): Promise<void>;
  getTopResults(messageId: string, limit: number): Promise<any[]>;
}

// lib/db/new-db-adapter.ts
import { DatabaseAdapter } from './adapter';

export class NewDatabaseAdapter implements DatabaseAdapter {
  async saveUserQuery(queryText: string, chatId: string): Promise<string> {
    // Messageテーブルにユーザークエリを保存
    const messageId = crypto.randomUUID();
    await db.query(
      `INSERT INTO "Message" (id, chatId, role, content, createdAt) 
       VALUES ($1, $2, $3, $4, $5)`,
      [messageId, chatId, 'user', JSON.stringify({ text: queryText }), new Date()]
    );
    return messageId;
  }

  async saveSubQueries(subQueries: string[], messageId: string, chatId: string): Promise<string[]> {
    // サブクエリをMessageテーブルに保存
    const subQueryIds = [];
    for (const query of subQueries) {
      const subQueryId = crypto.randomUUID();
      await db.query(
        `INSERT INTO "Message" (id, chatId, role, content, createdAt) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          subQueryId, 
          chatId, 
          'system', 
          JSON.stringify({ 
            text: query, 
            type: 'subquery', 
            parentId: messageId 
          }), 
          new Date()
        ]
      );
      subQueryIds.push(subQueryId);
    }
    return subQueryIds;
  }

  async saveSearchResults(results: any[], messageId: string, sessionId: string): Promise<void> {
    // 結果をXSearchResultとXSearchResultMessageに保存
    for (const result of results) {
      // XSearchResultに保存（upsert）
      const xPostId = result.id;
      await db.query(
        `INSERT INTO "XSearchResult" (id, xPostId, content, source_title, source_url, metadata, embedding, createdAt, updatedAt)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (xPostId) DO UPDATE SET
           content = EXCLUDED.content,
           metadata = EXCLUDED.metadata,
           updatedAt = EXCLUDED.updatedAt`,
        [
          crypto.randomUUID(),
          xPostId,
          result.text,
          `Twitter Post by ${result.author.username}`,
          `https://twitter.com/${result.author.username}/status/${result.id}`,
          result.metadata || {},
          result.embedding || null,
          new Date(),
          new Date()
        ]
      );

      // XSearchResultMessageに関連付けを保存
      await db.query(
        `INSERT INTO "XSearchResultMessage" (id, resultId, messageId, sessionId, embeddingScore, createdAt)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          crypto.randomUUID(),
          result.id,
          messageId,
          sessionId,
          result.similarity_score || 0,
          new Date()
        ]
      );
    }
  }

  async rerankResults(messageId: string): Promise<void> {
    // 再ランク付け処理
    const results = await db.query(
      `SELECT xsr.*, xsrm.id as relation_id, xsrm.embeddingScore
       FROM "XSearchResultMessage" xsrm
       JOIN "XSearchResult" xsr ON xsr.id = xsrm.resultId
       WHERE xsrm.messageId = $1`,
      [messageId]
    );

    // 再ランク付け処理（実際のロジックに合わせて実装）
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const rerankScore = calculateRerankScore(result); // 実際の再ランク付け関数
      const finalScore = (result.embeddingScore + rerankScore) / 2;

      await db.query(
        `UPDATE "XSearchResultMessage"
         SET rerankScore = $1, finalScore = $2
         WHERE id = $3`,
        [rerankScore, finalScore, result.relation_id]
      );
    }
  }

  async getTopResults(messageId: string, limit: number): Promise<any[]> {
    // 最も関連性の高い結果を取得
    const results = await db.query(
      `SELECT xsr.*, xsrm.embeddingScore, xsrm.rerankScore, xsrm.finalScore
       FROM "XSearchResultMessage" xsrm
       JOIN "XSearchResult" xsr ON xsr.id = xsrm.resultId
       WHERE xsrm.messageId = $1
       ORDER BY xsrm.finalScore DESC
       LIMIT $2`,
      [messageId, limit]
    );
    
    return results;
  }
}
```

### バックエンドサービスとして実装
```typescript
// services/search-service.ts
import { generateSubQueries as generateSubQueriesGemini } from '@/utils/gemini-2.0-flash-001';
import { executeCozeQueries, rerankSimilarDocuments } from '@/utils/coze（移行先のプロジェクトではn「lib/ai/coze/coze.ts」を使用します。）';
import { getDbAdapter } from '@/lib/db';

export class SearchService {
  private dbAdapter = getDbAdapter();
  
  /**
   * 検索プロセスを実行する
   * @param searchQuery ユーザーの検索クエリ
   * @param chatId チャットID
   * @param progressCallback 進捗を報告するコールバック関数（オプション）
   */
  async executeSearch(
    searchQuery: string, 
    chatId: string,
    progressCallback?: (status: string, progress: number) => void
  ) {
    try {
      // 進捗報告
      if (progressCallback) {
        progressCallback('understanding', 0);
      }
      
      // ユーザークエリをMessageテーブルに保存
      const messageId = await this.dbAdapter.saveUserQuery(searchQuery, chatId);
      
      // セッションIDを生成
      const sessionId = crypto.randomUUID();
      
      // サブクエリを生成
      const subQueries = await generateSubQueriesGemini(searchQuery);
      
      // サブクエリをMessageテーブルに保存
      await this.dbAdapter.saveSubQueries(subQueries, messageId, chatId);
      
      // 進捗報告
      if (progressCallback) {
        progressCallback('thinking', 0.2);
      }
      
      // Coze APIを使用してクエリを実行
      const cozeResults = await executeCozeQueries(
        subQueries,
        chatId,
        messageId,
        (processed) => {
          if (progressCallback) {
            progressCallback('processing', 0.2 + (processed / subQueries.length) * 0.6);
          }
        }
      );
      
      // 結果を保存
      await this.dbAdapter.saveSearchResults(
        cozeResults.flatMap(r => r.posts), 
        messageId, 
        sessionId
      );
      
      // 進捗報告
      if (progressCallback) {
        progressCallback('ranking', 0.8);
      }
      
      // 再ランク付け
      await this.dbAdapter.rerankResults(messageId);
      
      // 上位の結果を取得
      const topResults = await this.dbAdapter.getTopResults(messageId, 20);
      
      // 進捗報告
      if (progressCallback) {
        progressCallback('completed', 1.0);
      }
      
      return {
        messageId,
        sessionId,
        results: topResults
      };
    } catch (error) {
      console.error('Error executing search:', error);
      
      // 進捗報告
      if (progressCallback) {
        progressCallback('error', 0);
      }
      
      throw error;
    }
  }
  
  /**
   * 特定のメッセージIDに関連する検索結果を取得する
   */
  async getSearchResults(messageId: string, limit: number = 20) {
    return this.dbAdapter.getTopResults(messageId, limit);
  }
  
  /**
   * 検索結果からAI回答を生成する
   */
  async generateAnswerFromResults(messageId: string, chatId: string) {
    // 上位の結果を取得
    const topResults = await this.dbAdapter.getTopResults(messageId, 10);
    
    // ここでDeepSeekまたはGemini APIを使用して回答を生成
    // 実際の実装はutils/deepseek-article.tsなどを参照
    
    // 生成された回答をMessageテーブルに保存
    const answerId = crypto.randomUUID();
    await db.query(
      `INSERT INTO "Message" (id, chatId, role, content, createdAt) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        answerId, 
        chatId, 
        'assistant', 
        JSON.stringify({ 
          text: '生成された回答', 
          sources: topResults.map(r => ({ 
            id: r.id, 
            url: r.source_url, 
            title: r.source_title 
          }))
        }), 
        new Date()
      ]
    );
    
    return answerId;
  }
}
```

### lib/ai/coze/coze.ts の修正
```typescript
// lib/ai/coze/coze.ts
// フロントエンド関連のインポートを削除
// import { useState, useEffect } from 'react';

// 必要なインポートのみ残す
import { getDbAdapter } from '@/lib/db';

// TwitterPost型定義は残す
export type TwitterPost = {
  // 既存の型定義
};

// FormattedResponse型定義は残す
export type FormattedResponse = {
  // 既存の型定義
};

// executeCozeQueries関数を修正
export async function executeCozeQueries(
  subQueries: string[],
  chatId: string,
  messageId: string,
  progressCallback?: (processed: number) => void
): Promise<FormattedResponse[]> {
  // フロントエンド関連のコードを削除し、純粋なバックエンド処理として実装
  // ...実装内容...
}

// rerankSimilarDocuments関数を修正
export async function rerankSimilarDocuments(
  messageId: string,
  dbAdapter: any
): Promise<void> {
  // フロントエンド関連のコードを削除し、純粋なバックエンド処理として実装
  // ...実装内容...
}

// storeDataWithEmbedding関数を修正
export async function storeDataWithEmbedding(
  posts: TwitterPost[],
  messageId: string,
  sessionId: string,
  dbAdapter: any
): Promise<void> {
  // フロントエンド関連のコードを削除し、純粋なバックエンド処理として実装
  // ...実装内容...
}
```

## 移行手順

1. フロントエンド関連のコードを削除する:
   - React/Next.jsのページコンポーネント
   - UIコンポーネントのインポート
   - 状態管理関連のコード
   - レンダリング関連のコード

2. バックエンドサービスとして実装する:
   - `services/search-service.ts`を作成
   - 検索フローのロジックを移行

3. データベースアダプターを実装する:
   - `lib/db/adapter.ts`インターフェースを作成
   - `lib/db/new-db-adapter.ts`実装を作成

4. ユーティリティ関数を修正する:
   - `lib/ai/coze/coze.ts`からフロントエンド関連のコードを削除
   - `utils/gemini-2.0-flash-001.ts`を必要に応じて修正

5. 既存のチャットUIとの統合:
   - 検索サービスをチャットUIから呼び出す方法を実装
   - 進捗状況の報告方法を実装

この移行により、元のコードのバックエンド機能を維持しながら、新しいデータベース構造に対応させ、既存のチャットUIと統合することができます。
```

## 移行のポイント

1. **フロントエンド削除**: 元のコードからReact/Next.js関連のフロントエンドコードをすべて削除し、純粋なバックエンドサービスとして実装します。

2. **データベースアダプター**: 新しいテーブル構造に対応するためのアダプターを実装し、データベース操作を抽象化します。

3. **サービスクラス**: 検索フローのロジックをサービスクラスとして実装し、既存のチャットUIから呼び出せるようにします。

4. **進捗報告**: 検索プロセスの進捗を報告するコールバック関数を提供し、UIで進捗状況を表示できるようにします。

5. **エラー処理**: 各ステップでのエラーを適切に処理し、UIに報告できるようにします。

## 既存チャットUIとの統合例

```typescript
// 既存のチャットUIコンポーネントでの使用例
import { SearchService } from '@/services/search-service';

// チャットUIコンポーネント内
const searchService = new SearchService();

// ユーザーが検索クエリを送信したときの処理
const handleSearchQuery = async (query: string) => {
  setLoading(true);
  
  try {
    // 検索プロセスを実行
    const { messageId, results } = await searchService.executeSearch(
      query,
      currentChatId,
      (status, progress) => {
        // 進捗状況をUIに反映
        setSearchStatus(status);
        setSearchProgress(progress);
      }
    );
    
    // 検索結果を表示
    setSearchResults(results);
    
    // AI回答を生成
    await searchService.generateAnswerFromResults(messageId, currentChatId);
    
  } catch (error) {
    console.error('Search error:', error);
    setError('検索中にエラーが発生しました');
  } finally {
    setLoading(false);
  }
};
```

このガイドに従って移行を進めることで、既存のチャットUIを活用しながら、元のコードのバックエンド機能を新しいデータベース構造に適応させることができます。 