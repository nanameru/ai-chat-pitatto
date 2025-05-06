# GoT (Graph of Thoughts) リサーチ機能 設計概要

ユーザーからの多様な問いに対して、深く多角的なリサーチを行うための GoT アプローチに基づく Mastra コンポーネント構成案。

## 1. 全体構成要素

### 1.1. ワークフロー (Workflow): 1個

*   **名称:** `GoTResearchWorkflow`
*   **役割:**
    *   リサーチプロセス全体の流れを制御するオーケストレーター。
    *   ユーザー入力の明確さ判断、思考グラフの状態管理、各エージェント/ツールの呼び出し、ループ制御、Human-in-the-Loop (ユーザー確認) の管理を行う。
    *   **思考処理サブワークフロー (`ProcessThoughtsSubWorkflow`)** を呼び出す。

### 1.2. エージェント (Agent): 合計 6個

1.  **名称:** `ClarityCheckAgent`
    *   **役割:** ユーザーの初期質問の明確さを判断 (`isClear: true/false`)。
2.  **名称:** `ClarificationPromptAgent`
    *   **役割:** (質問が不明瞭な場合) ユーザーに追加情報や確認を促す質問文を生成。
3.  **名称:** `ThoughtGeneratorAgent`
    *   **役割:** 明確化された質問に基づき、初期の多様な思考、視点、サブクエスチョンを生成 (思考グラフの起点)。
4.  **名称:** `ThoughtTransformerAgent`
    *   **役割:** `ProcessThoughtsSubWorkflow` 内で呼び出され、思考グラフ内の選択されたノードを展開・変換する。内部推論、新規アイデア生成、適切なツールの選択と呼び出し指示を行う GoT の中核。
5.  **名称:** `ThoughtEvaluatorAgent`
    *   **役割:** 生成された思考ノードやパスの質、関連性、新規性などを評価し、スコア付けする (探索戦略に使用)。
6.  **名称:** `SynthesizerAgent`
    *   **役割:** 思考展開ループ終了後、最終的な思考グラフ全体を分析し、構造化された回答やレポートを生成する。

### 1.3. ツール (Tool): 合計 7個 (+ オプション 2個)

1.  **名称:** `WebSearchTool` (**必須**)
    *   **役割:** 汎用的なインターネット検索を実行。
    *   **情報源:** 主要検索エンジン (Google, Bing など)
2.  **名称:** `ArxivSearchTool` (**必須**)
    *   **役割:** 学術論文 (プレプリント) を検索。
    *   **情報源:** arXiv.org
3.  **名称:** `XSearchTool` (**推奨**)
    *   **役割:** X (旧Twitter) のリアルタイム投稿を検索。
    *   **情報源:** X / Twitter API
4.  **名称:** `RedditSearchTool` (**推奨**)
    *   **役割:** Reddit の投稿やコメントを検索。
    *   **情報源:** Reddit API
5.  **名称:** `YouTubeSearchTool` (**推奨**)
    *   **役割:** YouTube 動画 (解説、ニュース、講演など) を検索。
    *   **情報源:** YouTube API
6.  **名称:** `MediumSearchTool` (**推奨**)
    *   **役割:** Medium のブログ記事を検索。
    *   **情報源:** Medium (または検索エンジン経由)
7.  **名称:** `NoteSearchTool` (**推奨**)
    *   **役割:** note のブログ記事を検索。
    *   **情報源:** note (または検索エンジン経由)
---
8.  **名称:** `DocumentAnalysisTool` (**オプション**)
    *   **役割:** 取得した文書 (PDF, HTML等) の要約や情報抽出。
9.  **名称:** `DatabaseQueryTool` (**オプション**)
    *   **役割:** 内部データベースへのクエリ実行。

## 2. 処理フロー概要 (Mermaid図)

```mermaid
graph TD
    A[ユーザー初期入力] --> ClarityCheck{0. 明確さ判断 Step};

    subgraph ClarityCheck [エージェントによる判断]
      direction LR
      ClarityCheck -- 質問テキスト --> ClarityAgent((ClarityCheck Agent));
      ClarityAgent -- 判断結果 (isClear) --> ClarityCheck;
    end

    ClarityCheck -- isClear --> Branching{1. 条件分岐};

    subgraph Branching [条件分岐 .if()]
        Branching -- isClear=false (不明瞭) --> UserClarification(1a. ユーザー確認/深掘り Step);
        UserClarification -- Calls ClarificationPromptAgent & await suspend() --> WaitForUserInput((ユーザー入力待ち));
        UserInput(外部から run.resume()) -- ユーザー応答 --> ResumePoint(( )) -- 再開 --> InitialThoughts(1b. 初期思考生成 Step);
        Branching -- isClear=true (明瞭) --> InitialThoughts;
    end

    subgraph GoT_Process [GoT リサーチプロセス]
        InitialThoughts -- Calls --> ThoughtGeneratorAgent((ThoughtGenerator Agent));
        InitialThoughts -- 思考グラフ初期状態 --> ExpansionLoop(2. 思考展開ループ);

        subgraph ExpansionLoop [思考展開ループ .while()]
             direction TB
             LoopStart(ループ開始) --> SelectNode(2a. 展開ノード選択);
             SelectNode -- 選択ノード --> ProcessThoughtsSub(2b. 思考処理サブワークフロー);

             subgraph ProcessThoughtsSub [ProcessThoughtsSubWorkflow]
                direction TB
                SubStart(入力: 選択ノード) --> TransformThought(思考変換 Step);
                TransformThought -- Calls --> ThoughtTransformerAgent((ThoughtTransformer Agent));

                %% ツール利用
                ThoughtTransformerAgent -- May Call --> WebSearchTool([WebSearch Tool]);
                ThoughtTransformerAgent -- May Call --> ArxivSearchTool([ArxivSearch Tool]);
                ThoughtTransformerAgent -- May Call --> XSearchTool([XSearch Tool]);
                ThoughtTransformerAgent -- May Call --> RedditSearchTool([RedditSearch Tool]);
                ThoughtTransformerAgent -- May Call --> YouTubeSearchTool([YouTubeSearch Tool]);
                ThoughtTransformerAgent -- May Call --> MediumSearchTool([MediumSearch Tool]);
                ThoughtTransformerAgent -- May Call --> NoteSearchTool([NoteSearch Tool]);
                ThoughtTransformerAgent -- May Call --> OtherTools([...]);

                TransformThought -- 新思考/結果 --> SubEnd(出力: 新思考/結果);
             end

             ProcessThoughtsSub -- 新思考/結果 --> UpdateGraph(2c. グラフ状態更新);
             UpdateGraph -- 更新後グラフ --> EvaluateThoughts(2d. 思考評価 Step);
             EvaluateThoughts -- Calls --> ThoughtEvaluatorAgent((ThoughtEvaluator Agent));
             EvaluateThoughts -- 評価済みグラフ --> CheckTermination(2e. 終了条件チェック);
             CheckTermination -- 継続 --> LoopStart;
        end

        CheckTermination -- 終了 --> Synthesize(3. 結果統合 Step);
        Synthesize -- Calls --> SynthesizerAgent((Synthesizer Agent));
        Synthesize -- 統合結果 --> FormatOutput(4. 出力整形 Step);
        FormatOutput --> FinalOutput[最終結果];
    end

    style ClarityAgent fill:#DDF,stroke:#333
    style ClarificationPromptAgent fill:#DDF,stroke:#333
    style ThoughtGeneratorAgent fill:#DDF,stroke:#333
    style ThoughtTransformerAgent fill:#DDF,stroke:#333
    style ThoughtEvaluatorAgent fill:#DDF,stroke:#333
    style SynthesizerAgent fill:#DDF,stroke:#333
    style WebSearchTool fill:#DFD,stroke:#333
    style ArxivSearchTool fill:#DFD,stroke:#333
    style XSearchTool fill:#DFD,stroke:#333
    style RedditSearchTool fill:#DFD,stroke:#333
    style YouTubeSearchTool fill:#DFD,stroke:#333
    style MediumSearchTool fill:#DFD,stroke:#333
    style NoteSearchTool fill:#DFD,stroke:#333
    style OtherTools fill:#DFD,stroke:#333
    style WaitForUserInput fill:#FFA,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5
    style ProcessThoughtsSub fill:#EEE,stroke:#666,stroke-dasharray: 5 5
```

## 3. 段階的な開発計画（案）

1.  **フェーズ1: 必須コンポーネントの実装**
    *   `WebSearchTool`, `ArxivSearchTool`
    *   `ClarityCheckAgent`, `ThoughtGeneratorAgent`, `ThoughtTransformerAgent`, `SynthesizerAgent`
    *   `GoTResearchWorkflow` の基本骨格（明確化判断、初期生成、シンプルなループ、統合）
    *   `ProcessThoughtsSubWorkflow` の初期実装
2.  **フェーズ2: 推奨ツールの追加と連携強化**
    *   `XSearchTool`, `RedditSearchTool`, `YouTubeSearchTool`, `MediumSearchTool`, `NoteSearchTool` を実装。
    *   `ThoughtTransformerAgent` が状況に応じてこれらのツールを選択・利用できるように指示を改良 (`ProcessThoughtsSubWorkflow` 内)。
3.  **フェーズ3: 高度化**
    *   `ClarificationPromptAgent` と Human-in-the-Loop (`suspend`/`resume`) の実装。
    *   `ThoughtEvaluatorAgent` による評価ロジックと、それを利用した探索戦略の導入。
    *   オプションツールの実装（必要であれば）。
    *   エラーハンドリング、ロギングの強化。

この設計図を元に、まずはフェーズ1の必須コンポーネントから開発を進めていくことをお勧めします。 