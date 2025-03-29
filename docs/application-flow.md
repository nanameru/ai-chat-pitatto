# ピタットチャットUIアプリケーションフロー詳細

## 概要

ピタットチャットUIは、高度な検索機能と推論機能を備えたチャットアプリケーションです。主に「通常チャットモード」と「X検索モード（Deep Research）」の2つの動作モードを持ち、ユーザーのニーズに応じて切り替えることができます。また、「Computer Useモード」も実装されています。

## 主要コンポーネントと役割

### 1. フロントエンド

#### 1.1 Chat コンポーネント (`/components/chat.tsx`)
- アプリケーションの中心的なコンポーネント
- チャットの状態管理、メッセージの表示、入力フォームの制御を担当
- 動作モード（通常/X検索/Computer Use）の切り替え機能を提供
- ReasoningSidebarの表示制御

#### 1.2 MultimodalInput コンポーネント (`/components/multimodal-input.tsx`)
- ユーザー入力の処理を担当
- テキスト入力、ファイル添付、送信ボタンなどのUI要素を提供
- X検索モードとComputer Useモードの切り替えボタンを提供
- 入力内容の検証と送信処理

#### 1.3 ReasoningSidebar コンポーネント (`/components/reasoning-sidebar.tsx`)
- X検索モード時に表示される推論過程を表示するサイドバー
- AIエージェントの思考プロセスを可視化
- 各ステップ（計画、検索、統合など）の詳細を表示

#### 1.4 Messages コンポーネント (`/components/messages.tsx`)
- チャット履歴の表示を担当
- ユーザーとAIのメッセージを時系列で表示
- メッセージのフォーマットと表示スタイルを制御

### 2. バックエンド

#### 2.1 Deep Research API (`/app/api/deep-research/route.ts`)
- X検索モード時のリクエスト処理
- Deep Research Agent V2を使用した高度な検索と文書生成
- 推論ステップの記録と管理
- 明確化が必要な場合のフローを制御

#### 2.2 Deep Research Agent V2 (`/lib/mastra/agents/deep-research-v2/index.ts`)
- Mastraフレームワークを使用した高度な検索エージェント
- 4段階の処理フロー（明確化、計画、調査、統合）を実装
- 各段階で特化したツールを使用

#### 2.3 通常チャットAPI (`/app/api/chat/route.ts`)
- 通常チャットモード時のリクエスト処理
- OpenAI APIを使用した応答生成

## 詳細フロー

### 1. アプリケーション初期化フロー

1. **初期化プロセス**:
   - ユーザーがアプリケーションにアクセス
   - セッション情報の確認
   - ローカルストレージからの設定読み込み（モード設定など）
   - チャットキーの生成（`${id}-${mode}-${timestamp}`形式）

2. **状態初期化**:
   - `isXSearchEnabled`、`isComputerUseEnabled`などの状態変数の初期化
   - `reasoningSteps`、`isReasoningLoading`、`showReasoningSidebar`の初期化
   - メッセージ履歴の初期化

### 2. 通常チャットモードのフロー

1. **ユーザー入力**:
   - MultimodalInputコンポーネントでユーザーが入力
   - 送信ボタンクリックまたはEnterキーで送信処理開始

2. **メッセージ送信処理**:
   - `append`関数を通じてメッセージをチャット履歴に追加
   - `/api/chat`エンドポイントにリクエスト送信

3. **応答生成**:
   - サーバーサイドでOpenAI APIを使用して応答を生成
   - ストリーミングレスポンスとしてクライアントに返送

4. **応答表示**:
   - 生成された応答をメッセージリストに追加
   - UIの更新（ローディング状態の解除など）

### 3. X検索モード（Deep Research）のフロー

1. **モード切替**:
   - X検索ボタンをクリック
   - `onXSearchToggle`イベントハンドラが実行
   - 状態更新（`isXSearchEnabled = true`）
   - チャットキーの再生成と`useChat`の再初期化
   - APIエンドポイントの切り替え（`/api/deep-research/feedback`）

2. **ユーザー入力**:
   - 検索クエリをMultimodalInputコンポーネントで入力
   - 送信処理開始

3. **Deep Research処理**:
   - クエリが`/api/deep-research`エンドポイントに送信
   - Deep Research Agent V2が起動
   - 推論ステップの記録開始（`reasoningSteps`配列に追加）
   - `isReasoningLoading`を`true`に設定

4. **4段階処理**:
   - **明確化段階**: クエリが曖昧な場合、明確化のための質問を生成
   - **計画段階**: アウトラインとセクション構造の生成
   - **調査段階**: 検索クエリの生成、検索実行、結果分析
   - **統合段階**: 情報の統合と最終文書の生成

5. **推論過程の可視化**:
   - 各ステップが`reasoningSteps`配列に追加
   - ReasoningSidebarコンポーネントに表示
   - ステップのタイプに応じたアイコンと背景色で視覚化

6. **応答表示**:
   - 最終的な応答がメッセージリストに追加
   - `isReasoningLoading`を`false`に設定

### 4. データフロー

1. **メッセージデータフロー**:
   - ユーザー入力 → MultimodalInput → Chat → API → 応答 → Messages

2. **推論ステップデータフロー**:
   - API → reasoningSteps配列 → ReasoningSidebar

3. **状態管理フロー**:
   - ローカルストレージ ↔ React状態（useLocalStorage）
   - React状態 → UI更新
   - カスタムイベント → 状態更新 → UI更新

### 5. エラーハンドリングフロー

1. **API通信エラー**:
   - エラー検出 → エラーログ出力 → トースト通知
   - 必要に応じてリトライロジック

2. **入力検証エラー**:
   - 入力検証 → エラー表示 → ユーザーへのフィードバック

## モード切替の詳細フロー

### 1. 通常モード → X検索モード

1. X検索ボタンクリック
2. `onXSearchToggle(true)`イベントハンドラ実行
3. 既存のComputer Useモードが有効な場合は無効化
4. `isXSearchEnabled`を`true`に設定
5. 既存のメッセージをクリア
6. 新しいチャットキーを生成（`${id}-xsearch-${timestamp}-reset`）
7. APIエンドポイントを`/api/deep-research/feedback`に切り替え
8. `useChat`を再初期化
9. ReasoningSidebarを表示（`showReasoningSidebar = true`）

### 2. X検索モード → 通常モード

1. X検索ボタンクリック
2. `onXSearchToggle(false)`イベントハンドラ実行
3. `isXSearchEnabled`を`false`に設定
4. 既存のメッセージをクリア
5. 新しいチャットキーを生成（`${id}-chat-${timestamp}-reset`）
6. APIエンドポイントを`/api/chat`に切り替え
7. `useChat`を再初期化
8. ReasoningSidebarを非表示（`showReasoningSidebar = false`）

## コンポーネント間の相互作用

### 1. Chat ↔ MultimodalInput

- Chat: 入力状態、送信ハンドラ、モード設定を提供
- MultimodalInput: ユーザー入力を処理し、送信イベントを発火

### 2. Chat ↔ ReasoningSidebar

- Chat: 推論ステップデータと表示状態を提供
- ReasoningSidebar: 推論ステップを視覚化し、閉じるイベントを発火

### 3. Chat ↔ Messages

- Chat: メッセージデータと表示設定を提供
- Messages: メッセージを表示し、インタラクションイベントを発火

## 技術スタック

1. **フロントエンド**:
   - Next.js（React）
   - TypeScript
   - Tailwind CSS
   - ai/react（useChat）
   - usehooks-ts

2. **バックエンド**:
   - Next.js API Routes
   - Mastra Framework
   - OpenAI API

3. **状態管理**:
   - React Hooks（useState, useEffect, useCallback）
   - useLocalStorage
   - SWR（データフェッチング）

4. **その他**:
   - nanoid（ID生成）
   - classnames/cx（条件付きクラス名）
   - sonner（トースト通知）

## パフォーマンス最適化

1. **メモ化**:
   - React.memo を使用したコンポーネントの再レンダリング最適化
   - useCallback を使用した関数の再生成防止

2. **非同期処理**:
   - ストリーミングレスポンスによる段階的UI更新
   - useOptimistic を使用した楽観的UI更新

3. **条件付きレンダリング**:
   - 必要なコンポーネントのみを表示（ReasoningSidebarなど）

## セキュリティ対策

1. **入力検証**:
   - ユーザー入力の検証
   - APIリクエストのバリデーション

2. **エラーハンドリング**:
   - 詳細なエラーログ
   - ユーザーフレンドリーなエラーメッセージ

## 今後の拡張性

1. **新機能追加**:
   - 新しいモードの追加（現在のコードベースでは容易に実装可能）
   - 追加のツールと統合

2. **パフォーマンス向上**:
   - キャッシュ戦略の最適化
   - コンポーネントの分割とコード分割

3. **UX改善**:
   - より詳細な推論過程の可視化
   - カスタマイズ可能なUI設定
