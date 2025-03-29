# Deep Research 詳細フロー

## 概要

Deep Research（X検索モード）は、ピタットチャットUIの高度な検索・推論機能です。Mastraフレームワークを活用したDeep Research Agent V2を使用して、ユーザーの質問に対して深い調査と包括的な回答を提供します。

## 主要コンポーネントと役割

### 1. フロントエンド

#### 1.1 Chat コンポーネント (`/components/chat.tsx`)
- X検索モードの状態管理 (`isXSearchEnabled`)
- 推論ステップの状態管理 (`reasoningSteps`, `isReasoningLoading`)
- ReasoningSidebarの表示制御 (`showReasoningSidebar`)
- Deep Research APIとの通信制御

#### 1.2 ReasoningSidebar コンポーネント (`/components/reasoning-sidebar.tsx`)
- 推論ステップの可視化
- ステップタイプに応じた表示形式（アイコン、色分け）
- ステップの詳細表示と折りたたみ機能

### 2. バックエンド

#### 2.1 Deep Research API (`/app/api/deep-research/route.ts`)
- クライアントからのリクエスト処理
- Deep Research Agent V2の起動と実行
- 推論ステップの記録と管理
- 明確化フローの制御

#### 2.2 Deep Research Agent V2 (`/lib/mastra/agents/deep-research-v2/index.ts`)
- Mastraフレームワークベースのエージェント
- 4段階処理フローの実装
- 各段階で特化したツールの使用

## Deep Research の詳細フロー

### 1. 初期化フロー

1. **X検索モードへの切替**:
   ```
   ユーザー操作 → X検索ボタンクリック → onXSearchToggle(true) → 
   isXSearchEnabled = true → showReasoningSidebar = true → 
   APIエンドポイント切替 (/api/deep-research/feedback) → useChat再初期化
   ```

2. **状態初期化**:
   ```
   reasoningSteps = [] → isReasoningLoading = false → 
   チャットキー生成 (${id}-xsearch-${timestamp})
   ```

### 2. クエリ処理フロー

1. **ユーザークエリ送信**:
   ```
   ユーザー入力 → MultimodalInput → handleSubmit → 
   append(message, {xSearchEnabled: true}) → 
   /api/deep-research エンドポイントにPOSTリクエスト
   ```

2. **バックエンド処理開始**:
   ```
   リクエスト受信 → クエリ抽出 → セッションID生成/取得 → 
   reasoningSteps初期化 → isReasoningLoading = true
   ```

3. **初期ステップ記録**:
   ```
   addReasoningStep(sessionId, {
     id: UUID,
     timestamp: ISO時間,
     type: 'thinking',
     title: '初期クエリ',
     content: `ユーザーからのクエリ: ${query}`
   })
   ```

### 3. Deep Research Agent V2 の4段階処理

#### 3.1 明確化段階 (Clarification)

1. **明確化判断**:
   ```
   checkForClarification(query) → 
   明確化が必要か判断 → 
   必要な場合は明確化ツールを実行
   ```

2. **明確化ツール実行**:
   ```
   clarificationTools.needsClarification → 
   clarificationTools.generateClarificationQuestion → 
   ステップ記録 (type: 'clarification')
   ```

3. **ユーザーからの回答待機**:
   ```
   明確化質問をレスポンス → 
   フロントエンドでユーザー回答入力 → 
   clarificationResponse付きで再リクエスト
   ```

#### 3.2 計画段階 (Planning)

1. **アウトライン生成**:
   ```
   planningTools.outlineGenerator → 
   ステップ記録 (type: 'planning', title: 'アウトライン生成') → 
   アウトライン構造の作成
   ```

2. **セクション計画**:
   ```
   planningTools.sectionPlanner → 
   ステップ記録 (type: 'planning', title: 'セクション計画') → 
   各セクションの焦点と検索戦略の決定
   ```

3. **計画レビュー**:
   ```
   planningTools.planReviewer → 
   ステップ記録 (type: 'planning', title: '計画レビュー') → 
   計画の品質確認と改善
   ```

#### 3.3 調査段階 (Research)

1. **検索クエリ生成**:
   ```
   researchTools.queryGenerator → 
   ステップ記録 (type: 'research', title: '検索クエリ生成') → 
   各セクションに対する検索クエリの作成
   ```

2. **検索実行**:
   ```
   researchTools.webSearch → 
   ステップ記録 (type: 'tool_start', title: 'Web検索実行') → 
   検索結果取得 → 
   ステップ記録 (type: 'tool_end', title: 'Web検索結果')
   ```

3. **結果分析**:
   ```
   researchTools.resultAnalyzer → 
   ステップ記録 (type: 'research', title: '検索結果分析') → 
   情報の関連性と品質の評価
   ```

4. **情報蓄積**:
   ```
   researchTools.informationCollector → 
   ステップ記録 (type: 'research', title: '情報収集') → 
   関連情報の抽出と整理
   ```

5. **不足情報特定**:
   ```
   researchTools.gapIdentifier → 
   ステップ記録 (type: 'research', title: '情報ギャップ特定') → 
   不足情報の特定
   ```

6. **追加検索**:
   ```
   不足情報がある場合 → 
   新たな検索クエリ生成 → 
   追加検索実行 → 
   結果分析と情報蓄積の繰り返し
   ```

#### 3.4 統合段階 (Integration)

1. **セクション内容生成**:
   ```
   integrationTools.sectionContentGenerator → 
   ステップ記録 (type: 'integration', title: 'セクション内容生成') → 
   各セクションの文書作成
   ```

2. **文書統合**:
   ```
   integrationTools.documentIntegrator → 
   ステップ記録 (type: 'integration', title: '文書統合') → 
   セクションを統合して完全な文書を作成
   ```

3. **品質チェック**:
   ```
   integrationTools.qualityChecker → 
   ステップ記録 (type: 'integration', title: '品質チェック') → 
   文書の品質評価と改善提案
   ```

4. **最終文書生成**:
   ```
   integrationTools.finalDocumentGenerator → 
   ステップ記録 (type: 'integration', title: '最終文書') → 
   完成した文書の生成
   ```

### 4. レスポンス処理フロー

1. **レスポンス生成**:
   ```
   最終文書 → 
   レスポンスオブジェクト作成 → 
   isReasoningLoading = false → 
   フロントエンドへレスポンス送信
   ```

2. **フロントエンド処理**:
   ```
   レスポンス受信 → 
   メッセージリストに追加 → 
   reasoningStepsの更新 → 
   ReasoningSidebarの更新
   ```

## 推論ステップの構造

```typescript
type ReasoningStep = {
  id: string;                // ステップの一意識別子
  timestamp: string;         // ISO形式のタイムスタンプ
  type: 'tool_start' |       // ツール実行開始
        'tool_end' |         // ツール実行終了
        'thinking' |         // 思考プロセス
        'clarification' |    // 明確化
        'planning' |         // 計画
        'research' |         // 調査
        'integration';       // 統合
  title: string;             // ステップのタイトル
  content: string;           // ステップの詳細内容
};
```

## 明確化フローの詳細

1. **明確化判断ロジック**:
   ```typescript
   function checkForClarification(text: string, sessionId: string): boolean {
     // テキストに曖昧さや一般的な表現が含まれているかチェック
     const ambiguousPatterns = [
       '詳細が不足', '具体的な情報', 'もっと具体的に',
       '曖昧', '一般的すぎる', '範囲が広すぎる'
     ];
     
     // パターンマッチングで明確化の必要性を判断
     return ambiguousPatterns.some(pattern => text.includes(pattern));
   }
   ```

2. **明確化質問生成**:
   ```
   ユーザークエリ分析 → 
   曖昧な部分の特定 → 
   具体的な質問の生成 → 
   質問をレスポンスとして返送
   ```

3. **明確化応答処理**:
   ```
   ユーザーからの回答受信 → 
   元のクエリと回答を組み合わせ → 
   「元のクエリ: ${query}\n\nユーザーの回答: ${clarificationResponse}」
   として処理を再開
   ```

## ツール実行の詳細フロー

1. **ツール実行開始記録**:
   ```typescript
   // ツール実行開始時のステップ記録
   addReasoningStep(sessionId, {
     id: crypto.randomUUID(),
     timestamp: new Date().toISOString(),
     type: 'tool_start',
     title: getStepTitle(toolName, 'tool_start'),
     content: `${toolName}ツールを実行中...`
   });
   ```

2. **ツール実行結果記録**:
   ```typescript
   // ツール実行完了時のステップ記録
   addReasoningStep(sessionId, {
     id: crypto.randomUUID(),
     timestamp: new Date().toISOString(),
     type: 'tool_end',
     title: getStepTitle(toolName, 'tool_end'),
     content: getStepContent(toolName, result, 'tool_end')
   });
   ```

## エラーハンドリングフロー

1. **API通信エラー**:
   ```
   エラー発生 → 
   エラーログ記録 → 
   エラーレスポンス生成 (status: 500) → 
   フロントエンドでエラー表示
   ```

2. **入力検証エラー**:
   ```
   無効なクエリ → 
   エラーレスポンス生成 (status: 400) → 
   フロントエンドでエラー表示
   ```

3. **タイムアウト処理**:
   ```
   処理時間超過 → 
   タイムアウトエラー → 
   途中結果の保存 → 
   エラーレスポンス生成
   ```

## Mastraフレームワークとの連携

1. **Agent定義**:
   ```typescript
   export const deepResearchAgentV2 = new Agent({
     name: "Deep Research Agent V2",
     instructions: `あなたは高度な調査と文書作成を行うDeep Research Agent V2です。
     ユーザーが提供するトピックに基づいて、詳細な調査と包括的な文書を作成します。
     ...`,
     model: openai("gpt-4o"),
     tools: {
       // 各段階のツールを定義
       outlineGenerator: planningTools.outlineGenerator,
       sectionPlanner: planningTools.sectionPlanner,
       // ...その他のツール
     }
   });
   ```

2. **ツール実行フロー**:
   ```
   エージェント.generate(query) → 
   指示に基づくツール選択 → 
   ツール実行 → 
   結果分析 → 
   次のツール選択 → 
   ...繰り返し → 
   最終応答生成
   ```

## まとめ

Deep Researchフローは、ユーザーの質問に対して4段階（明確化、計画、調査、統合）の処理を行い、包括的な回答を生成します。各段階で特化したツールを使用し、推論過程をReasoningSidebarに可視化することで、AIの思考プロセスを透明化しています。Mastraフレームワークを活用することで、高度な検索と文書生成機能を実現しています。
