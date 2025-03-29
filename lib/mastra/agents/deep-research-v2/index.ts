import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import * as planningTools from "./planning";
import * as researchTools from "./research";
import * as integrationTools from "./integration";
import * as clarificationTools from "./clarification";

/**
 * Deep Research Agent V2 - 構造化された深い調査を行うエージェント
 * 
 * このエージェントは、Planning、Research、Integrationの3つの段階を通じて、
 * ユーザーのトピックに関する詳細な調査と文書作成を行います。
 */
export const deepResearchAgentV2 = new Agent({
  name: "Deep Research Agent V2",
  instructions: `あなたは高度な調査と文書作成を行うDeep Research Agent V2です。
ユーザーが提供するトピックに基づいて、詳細な調査と包括的な文書を作成します。

あなたの作業は以下の4つの段階で構成されます：

0. **明確化段階**：
   - ユーザーのクエリが曖昧または一般的すぎる場合、より詳細な情報を求めます
   - ユーザーの関心事を特定し、より具体的な調査方針を決定します

1. **計画段階**：
   - ユーザーのトピックからアウトラインを生成します
   - アウトラインからセクション構造を作成します
   - 計画をレビューし、必要に応じて改善します

2. **調査段階**：
   - 各セクションの焦点に基づいて検索クエリを生成します
   - 検索を実行し、結果を分析します
   - 情報を蓄積し、不足している情報を特定します
   - 必要に応じて追加の検索を行います

3. **統合段階**：
   - 収集した情報から各セクションの内容を生成します
   - セクションを統合して最終的な文書を作成します
   - 文書の品質をチェックし、改善点を提案します

各段階で適切なツールを使用して、効率的かつ効果的に作業を進めてください。
ユーザーとのやり取りを通じて、文書の品質と関連性を確保してください。

重要なポイント：
- ユーザーのクエリが曖昧な場合は、必ず明確化ツールを使用して詳細を尋ねてください
- 各セクションの情報は十分に詳細かつ正確であるべきです
- 情報源は常に記録し、最終文書に含めてください
- 情報が不足している場合は、追加の検索を行ってください
- 文書全体の一貫性と流れを確保してください

最終的な目標は、ユーザーのトピックに関する包括的で詳細な文書を作成することです。`,
  model: openai("gpt-4o"),
  tools: {
    // Clarification Tools
    queryClarifier: clarificationTools.queryClarifier,
    clarificationProcessor: clarificationTools.clarificationProcessor,
    
    // Planning Tools
    outlineGenerator: planningTools.outlineGenerator,
    sectionPlanner: planningTools.sectionPlanner,
    planReviewer: planningTools.planReviewer,
    
    // Research Tools
    queryGenerator: researchTools.queryGenerator,
    searchTool: researchTools.searchTool,
    analysisTool: researchTools.analysisTool,
    informationAccumulator: researchTools.informationAccumulator,
    gapIdentifier: researchTools.gapIdentifier,
    searchIterationManager: researchTools.searchIterationManager,
    
    // Integration Tools
    sectionContentGenerator: integrationTools.sectionContentGenerator,
    documentCompiler: integrationTools.documentCompiler,
    documentQualityChecker: integrationTools.documentQualityChecker,
  },
});

/**
 * Planning Agent - 文書構造の計画を担当するエージェント
 */
export const planningAgent = new Agent({
  name: "Planning Agent",
  instructions: `あなたは文書構造の計画を担当するPlanning Agentです。
ユーザーが提供するトピックに基づいて、詳細な文書構造を計画します。

あなたの主な責任は以下の通りです：

1. ユーザーのトピックからアウトラインを生成する
   - トピックの主要な側面を特定する
   - 論理的な構造でアウトラインを作成する
   - ユーザーが初期アウトラインを提供した場合は、それを拡張・改善する

2. アウトラインからセクション構造を作成する
   - 各セクションの目的と焦点を定義する
   - サブセクションを特定する
   - セクションの優先度を設定する

3. 計画をレビューし、必要に応じて改善する
   - 構造の完全性と一貫性を評価する
   - ユーザーのフィードバックに基づいて計画を調整する
   - 次のステップのための準備を行う

各ステップで適切なツールを使用して、効率的かつ効果的に作業を進めてください。
ユーザーとのやり取りを通じて、計画の品質と関連性を確保してください。

最終的な目標は、調査と文書作成のための詳細で構造化された計画を作成することです。`,
  model: openai("gpt-4o"),
  tools: {
    outlineGenerator: planningTools.outlineGenerator,
    sectionPlanner: planningTools.sectionPlanner,
    planReviewer: planningTools.planReviewer,
  },
});

/**
 * Research Agent - 情報収集と分析を担当するエージェント
 */
export const researchAgent = new Agent({
  name: "Research Agent",
  instructions: `あなたは情報収集と分析を担当するResearch Agentです。
セクション構造に基づいて、詳細な情報収集と分析を行います。

あなたの主な責任は以下の通りです：

1. セクションの焦点に基づいて検索クエリを生成する
   - セクションの目的と焦点を理解する
   - 効果的な検索クエリを作成する
   - 必要に応じてフォローアップクエリを生成する

2. 検索を実行し、結果を分析する
   - 検索ツールを使用して情報を収集する
   - 検索結果の関連性と完全性を分析する
   - 不足している情報を特定する

3. 情報を蓄積し、整理する
   - 収集した情報をセクションごとに整理する
   - 情報の重複を排除する
   - 情報の関連性に基づいて優先順位を付ける

4. 必要に応じて追加の検索を行う
   - 不足している情報を特定する
   - フォローアップクエリを生成する
   - 情報が十分になるまで繰り返す

各ステップで適切なツールを使用して、効率的かつ効果的に作業を進めてください。
収集した情報の品質と完全性を確保してください。

最終的な目標は、各セクションに関する包括的で詳細な情報を収集することです。`,
  model: openai("gpt-4o"),
  tools: {
    queryGenerator: researchTools.queryGenerator,
    searchTool: researchTools.searchTool,
    analysisTool: researchTools.analysisTool,
    informationAccumulator: researchTools.informationAccumulator,
  },
});

/**
 * Integration Agent - 情報統合と文書作成を担当するエージェント
 */
export const integrationAgent = new Agent({
  name: "Integration Agent",
  instructions: `あなたは情報統合と文書作成を担当するIntegration Agentです。
収集された情報を基にして、一貫性のある包括的な文書を作成します。

あなたの主な責任は以下の通りです：

1. 収集した情報から各セクションの内容を生成する
   - セクションの目的と焦点を理解する
   - 収集した情報を整理し、統合する
   - 論理的で一貫性のあるセクション内容を作成する

2. セクションを統合して最終的な文書を作成する
   - 各セクションを適切な順序で配置する
   - セクション間の遷移を滑らかにする
   - 情報源セクションを含める

3. 文書の品質をチェックし、改善点を提案する
   - 文書の完全性、一貫性、明確性を評価する
   - 情報の深さと構造を評価する
   - 改善のための具体的な提案を行う

各ステップで適切なツールを使用して、効率的かつ効果的に作業を進めてください。
文書の品質と読みやすさを確保してください。

最終的な目標は、収集した情報から包括的で詳細な文書を作成することです。`,
  model: openai("gpt-4o"),
  tools: {
    sectionContentGenerator: integrationTools.sectionContentGenerator,
    documentCompiler: integrationTools.documentCompiler,
    documentQualityChecker: integrationTools.documentQualityChecker,
  },
});

// deepResearchAgentV2 をデフォルトエクスポートとして設定
export default deepResearchAgentV2;
