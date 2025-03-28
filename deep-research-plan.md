# Mastraを使用したDeep Research連鎖検索エージェント実装計画

## 1. 概要

このプロジェクトでは、Mastraフレームワークを使用して、高度な反復連鎖検索エージェント（Deep Research Agent）を実装します。このエージェントは、ユーザーの質問に対して以下のプロセスを実行します：

1. 初期検索：ユーザーの質問に基づいて初期検索を実行
2. 結果分析：検索結果を分析し、不足している情報や追加調査が必要な点を特定
3. 追加検索：分析結果に基づいて、より具体的な追加検索を実行
4. 情報充足度評価：収集した情報が十分かどうかを評価
5. 反復処理：情報が不十分な場合は手順2〜4を繰り返す（最大15回）
6. 結果統合：すべての検索結果を統合して、包括的な回答を生成

この反復的なアプローチにより、単一の検索では得られない深い洞察と包括的な情報を提供します。情報が十分になるまで検索を繰り返すことで、より完全で正確な回答を生成することができます。

## 2. 技術スタック

- **フレームワーク**: Mastra (@mastra/core)
- **言語モデル**: OpenAI GPT-4o-mini (@ai-sdk/openai)
- **スキーマ検証**: Zod
- **バックエンド**: Next.js API Routes
- **認証**: Supabase Auth

## 3. アーキテクチャ設計

### 3.1 プロジェクト構造

```
lib/
  └── mastra/
      ├── agents/
      │   └── deep-research-agent.ts  # 連鎖検索エージェント
      ├── tools/
      │   ├── search-tool.ts          # 検索ツール
      │   └── analysis-tool.ts        # 結果分析ツール
      ├── workflows/
      │   └── research-workflow.ts    # 研究ワークフロー
      └── index.ts                    # エクスポート
app/
  └── api/
      └── mastra/
          └── route.ts                # APIエンドポイント
scripts/
  └── test-deep-research.js           # テストスクリプト
```

### 3.2 コンポーネント詳細

#### 3.2.1 検索ツール (SearchTool)

Mastraの`createTool`関数を使用して、ウェブ検索を実行するツールを実装します。

```typescript
// lib/mastra/tools/search-tool.ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const searchTool = createTool({
  id: 'Web Search',
  inputSchema: z.object({
    query: z.string().describe('検索クエリ'),
  }),
  description: 'ウェブ検索を実行して情報を取得します',
  execute: async ({ context: { query } }) => {
    console.log(`検索実行: ${query}`);
    
    // 実際の検索APIを呼び出す実装
    // 開発段階ではモックデータを返す
    const mockResults = [
      { title: `${query}に関する情報1`, snippet: `これは${query}についての情報です。`, url: 'https://example.com/1' },
      { title: `${query}に関する情報2`, snippet: `${query}の詳細な解説です。`, url: 'https://example.com/2' },
    ];
    
    return {
      query,
      results: mockResults,
      timestamp: new Date().toISOString(),
    };
  },
});
```

#### 3.2.2 分析ツール (AnalysisTool)

```typescript
// lib/mastra/tools/analysis-tool.ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const analysisTool = createTool({
  id: 'Search Results Analysis',
  inputSchema: z.object({
    query: z.string().describe('元の検索クエリ'),
    results: z.array(z.object({
      title: z.string(),
      snippet: z.string(),
      url: z.string(),
    })).describe('検索結果'),
  }),
  description: '検索結果を分析し、不足している情報や追加調査が必要な点を特定します',
  execute: async ({ context: { query, results } }) => {
    console.log(`分析実行: ${query}の検索結果を分析`);
    
    return {
      originalQuery: query,
      missingInformation: ['追加情報1', '追加情報2'],
      followUpQueries: [
        `${query}の最新動向`,
        `${query}の具体的な応用例`
      ],
      analysisTimestamp: new Date().toISOString(),
    };
  },
});
```

#### 3.2.3 Deep Researchエージェント

```typescript
// lib/mastra/agents/deep-research-agent.ts
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import * as tools from '../tools';

export const deepResearchAgent = new Agent<typeof tools>({
  name: 'Deep Research Agent',
  instructions: `
    あなたは高度な反復連鎖検索を実行するリサーチエージェントです。
    ユーザーの質問に対して、以下のプロセスを実行してください：
    
    1. ユーザーの質問を理解し、適切な検索クエリを作成する
    2. 検索ツールを使用して初期検索を実行する
    3. 分析ツールを使用して検索結果を分析し、不足情報を特定する
    4. 不足情報に基づいて追加の検索クエリを作成し、検索を実行する
    5. 収集した情報が十分かどうかを評価する
    6. 情報が不十分な場合は、手順3〜5を繰り返す（最大15回まで）
    7. すべての検索結果を統合して、包括的な回答を生成する
    
    回答は事実に基づき、検索結果から得られた情報を正確に反映してください。
    不確かな情報には言及せず、検索結果に含まれていない情報は推測しないでください。
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    searchTool: tools.searchTool,
    analysisTool: tools.analysisTool,
  },
});
```

#### 3.2.4 研究ワークフロー

Mastraの`Workflow`クラスを使用して、連鎖検索のワークフローを定義します。

```typescript
// lib/mastra/workflows/research-workflow.ts
import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { deepResearchAgent } from '../agents/deep-research-agent';

// 初期検索ステップ
const initialSearchStep = new Step({
  id: 'initialSearch',
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: z.object({
    query: z.string(),
    results: z.array(z.object({
      title: z.string(),
      snippet: z.string(),
      url: z.string(),
    })),
    timestamp: z.string(),
  }),
  execute: async ({ context }) => {
    const query = context?.getStepResult<{ query: string }>('trigger')?.query;
    
    const response = await deepResearchAgent.tools.searchTool.execute({
      context: { query },
    });
    
    return response;
  },
});

// 結果分析ステップ
const analysisStep = new Step({
  id: 'analysisStep',
  outputSchema: z.object({
    originalQuery: z.string(),
    missingInformation: z.array(z.string()),
    followUpQueries: z.array(z.string()),
    analysisTimestamp: z.string(),
  }),
  execute: async ({ context }) => {
    const searchResults = context?.getStepResult('initialSearch');
    
    const response = await deepResearchAgent.tools.analysisTool.execute({
      context: {
        query: searchResults.query,
        results: searchResults.results,
      },
    });
    
    return response;
  },
});

// 追加検索ステップ
const followUpSearchStep = new Step({
  id: 'followUpSearch',
  outputSchema: z.object({
    additionalResults: z.array(z.object({
      query: z.string(),
      results: z.array(z.object({
        title: z.string(),
        snippet: z.string(),
        url: z.string(),
      })),
    })),
    iterationCount: z.number(),
    isInformationSufficient: z.boolean(),
  }),
  execute: async ({ context }) => {
    const analysis = context?.getStepResult('analysisStep');
    const previousIterations = context?.getStepResult('followUpSearch');
    const iterationCount = previousIterations?.iterationCount || 0;
    const additionalResults = [];
    
    // 最大反復回数のチェック
    if (iterationCount >= 15) {
      return { 
        additionalResults: previousIterations?.additionalResults || [],
        iterationCount: 15,
        isInformationSufficient: true // 最大反復回数に達したため強制終了
      };
    }
    
    for (const query of analysis.followUpQueries) {
      const response = await deepResearchAgent.tools.searchTool.execute({
        context: { query },
      });
      
      additionalResults.push({
        query,
        results: response.results,
      });
    }
    
    // 情報が十分かどうかを評価
    const evaluationPrompt = `
      以下の情報に基づいて、ユーザーの質問に十分に回答できるかどうかを評価してください：
      
      元の質問: ${analysis.originalQuery}
      不足していた情報: ${JSON.stringify(analysis.missingInformation)}
      追加で収集した情報: ${JSON.stringify(additionalResults)}
    `;
    
    const evaluationResponse = await deepResearchAgent.generate(evaluationPrompt, {
      output: z.object({
        isInformationSufficient: z.boolean(),
        reasonForDecision: z.string(),
      }),
    });
    
    return { 
      additionalResults: [...(previousIterations?.additionalResults || []), ...additionalResults],
      iterationCount: iterationCount + 1,
      isInformationSufficient: evaluationResponse.object.isInformationSufficient
    };
  },
});

// 結果統合ステップ
const resultIntegrationStep = new Step({
  id: 'resultIntegration',
  outputSchema: z.object({
    originalQuery: z.string(),
    initialResults: z.array(z.object({
      title: z.string(),
      snippet: z.string(),
      url: z.string(),
    })),
    additionalResults: z.array(z.object({
      query: z.string(),
      results: z.array(z.object({
        title: z.string(),
        snippet: z.string(),
        url: z.string(),
      })),
    })),
    summary: z.string(),
  }),
  execute: async ({ context }) => {
    const initialSearch = context?.getStepResult('initialSearch');
    const followUpSearch = context?.getStepResult('followUpSearch');
    
    const prompt = `
      以下の検索結果に基づいて、包括的な要約を作成してください：
      
      初期検索クエリ: ${initialSearch.query}
      初期検索結果: ${JSON.stringify(initialSearch.results)}
      
      追加検索結果: ${JSON.stringify(followUpSearch.additionalResults)}
    `;
    
    const response = await deepResearchAgent.generate(prompt);
    
    return {
      originalQuery: initialSearch.query,
      initialResults: initialSearch.results,
      additionalResults: followUpSearch.additionalResults,
      summary: response.text,
    };
  },
});

// ワークフローの定義
export const researchWorkflow = new Workflow({
  name: 'deep-research-workflow',
  triggerSchema: z.object({
    query: z.string(),
  }),
});

// ワークフローのステップを定義（反復処理を含む）
researchWorkflow
  .step(initialSearchStep)
  .then(analysisStep)
  .then(followUpSearchStep)
  .then(analysisStep, {
    when: { "followUpSearch.isInformationSufficient": false },
    after: "followUpSearch"
  })
  .then(followUpSearchStep, {
    when: { "followUpSearch.isInformationSufficient": false },
    after: "analysisStep"
  })
  .then(resultIntegrationStep, {
    when: { "followUpSearch.isInformationSufficient": true },
    after: "followUpSearch"
  });

researchWorkflow.commit();
```

#### 3.2.5 Mastraインスタンスの設定

```typescript
// lib/mastra/index.ts
import { Mastra } from '@mastra/core';
import { deepResearchAgent } from './agents/deep-research-agent';
import { researchWorkflow } from './workflows/research-workflow';

export const mastra = new Mastra({
  agents: { deepResearchAgent },
  workflows: { researchWorkflow },
});

export { deepResearchAgent } from './agents/deep-research-agent';
export { researchWorkflow } from './workflows/research-workflow';
export * as tools from './tools';
```

## 4. APIエンドポイントの実装

```typescript
// app/api/mastra/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { mastra } from '@/lib/mastra';

export async function POST(request: Request) {
  try {
    // 認証チェック
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // リクエストボディの解析
    const body = await request.json();
    const { query, mode = 'agent' } = body;
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    // モードに応じてエージェントまたはワークフローを実行
    if (mode === 'agent') {
      // エージェントモード
      const messages = [{ role: 'user', content: query }];
      const response = await mastra.agents.deepResearchAgent.generate(messages);
      
      return NextResponse.json({
        result: response.text,
        agent: 'Deep Research Agent',
      });
    } else if (mode === 'workflow') {
      // ワークフローモード
      const { runId, start } = mastra.getWorkflow('researchWorkflow').createRun();
      const runResult = await start({
        triggerData: { query },
      });
      
      return NextResponse.json({
        result: runResult.results.resultIntegration.summary,
        runId,
        workflow: 'Deep Research Workflow',
        details: runResult.results,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid mode. Use "agent" or "workflow"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
```

## 5. テストスクリプトの実装

```javascript
// scripts/test-deep-research.js
const fetch = require('node-fetch');

async function testDeepResearchAgent() {
  const query = 'AIエージェントの最新動向と応用例について教えてください';
  
  console.log(`テストクエリ: ${query}`);
  
  try {
    // エージェントモードのテスト
    const agentResponse = await fetch('http://localhost:3000/api/mastra', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        mode: 'agent',
      }),
    });
    
    const agentData = await agentResponse.json();
    console.log('エージェントモード結果:');
    console.log(agentData.result);
    
    // ワークフローモードのテスト
    const workflowResponse = await fetch('http://localhost:3000/api/mastra', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        mode: 'workflow',
      }),
    });
    
    const workflowData = await workflowResponse.json();
    console.log('\nワークフローモード結果:');
    console.log(workflowData.result);
    console.log('\n詳細情報:');
    console.log(JSON.stringify(workflowData.details, null, 2));
  } catch (error) {
    console.error('テスト実行エラー:', error);
  }
}

testDeepResearchAgent();
```

## 6. 実装フェーズ

### フェーズ1: 基本機能の実装
- 検索ツールとモックデータの実装
- 分析ツールの実装
- Deep Researchエージェントの基本実装
- APIエンドポイントの実装

### フェーズ2: ワークフローの実装
- 研究ワークフローの実装
- ステップ間のデータ連携の最適化
- 条件分岐の追加（検索結果の質に応じた追加検索の制御）

### フェーズ3: 実際の検索APIとの統合
- 実際の検索APIとの統合
- エラーハンドリングの強化
- パフォーマンス最適化

### フェーズ4: テストと改善
- ユニットテストの実装
- エンドツーエンドテスト
- ユーザーフィードバックに基づく改善

## 7. 拡張可能性

- **マルチモーダル検索**: 画像や動画も含めた検索の実装
- **ユーザーフィードバックループ**: ユーザーからのフィードバックを取り入れた検索精度の向上
- **検索履歴の保存**: ユーザーごとの検索履歴を保存し、パーソナライズされた検索体験の提供
- **複数の検索プロバイダー**: Google、Bing、DuckDuckGoなど複数の検索エンジンの結果を統合

```markdown

## 4. 連鎖検索のアルゴリズム

連鎖検索のプロセスは以下の手順で実行されます：

1. **初期検索**:
   - ユーザーの入力から検索クエリを生成
   - 検索ツールを使用して初期検索を実行

2. **反復検索**:
   - 検索結果を分析ツールで評価
   - 不足している情報を特定
   - 新しい検索クエリを生成
   - 追加の検索を実行
   - 十分な情報が集まるまで、または制限回数に達するまで繰り返す

3. **結果統合**:
   - 収集した情報を統合
   - 包括的な回答を生成
   - 情報源を引用

## 5. 実装フェーズ

### フェーズ1: 基本構造の実装
- 検索ツールの実装（モック版）
- 分析ツールの実装（モック版）
- DeepResearchエージェントの基本構造の実装

### フェーズ2: 連鎖検索ロジックの実装
- 反復検索のロジックを実装
- 結果の統合と最終回答生成の実装

### フェーズ3: 実際の検索APIとの連携
- 実際の検索API（Google、Bing、またはカスタムAPI）との連携
- エラーハンドリングの実装

### フェーズ4: APIエンドポイントとフロントエンド連携
- APIエンドポイントの実装
- フロントエンドからの呼び出しテスト

### フェーズ5: テストと最適化
- 様々なクエリでのテスト
- パフォーマンスの最適化
- エラーケースの処理

## 6. 今後の拡張可能性

1. **検索プロバイダーの拡張**:
   - 複数の検索エンジンをサポート
   - 専門分野に特化した検索APIの統合

2. **結果のパーソナライズ**:
   - ユーザーの過去の検索履歴に基づく結果のカスタマイズ
   - ユーザーの専門知識レベルに合わせた回答の調整

3. **マルチモーダル対応**:
   - 画像や動画の検索と分析
   - データの視覚化

4. **協調検索**:
   - 複数のエージェントが協力して検索を行う機能
   - 専門分野ごとに特化したエージェントの連携

## 7. 次のステップ

1. 基本的な検索ツールとDeepResearchエージェントの実装
2. モックデータを使用したテスト
3. 実際の検索APIとの連携
4. フロントエンドとの統合
