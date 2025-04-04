import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

/**
 * クエリ明確化ツール
 * ユーザーの曖昧なクエリに対して、より具体的な情報を求めるための質問を生成します
 */
export const queryClarifier = createTool({
  id: "Query Clarifier",
  description: "ユーザーのクエリが曖昧な場合に、より詳細な情報を求めるための質問を生成します",
  inputSchema: z.object({
    query: z.string().describe("ユーザーの元のクエリ"),
  }),
  execute: async ({ context }) => {
    const { query } = context;
    
    // クエリが十分に具体的かどうかをAIで判断
    const isSpecific = await isQuerySpecificAI(query);
    
    if (isSpecific) {
      return {
        needsClarification: false,
        message: "クエリは十分に具体的です。そのまま処理を続行します。",
        originalQuery: query
      };
    }
    
    // クエリのトピックを特定
    const topic = identifyTopic(query);
    
    // トピックに基づいて適切な質問を生成
    const clarificationQuestions = generateClarificationQuestions(topic);
    
    return {
      needsClarification: true,
      message: `${query}についてどのような情報をお求めでしょうか？以下のような観点を教えていただけると助かります。\n\n${clarificationQuestions.join("\n\n")}\n\nどの観点で深掘りすればよいか教えてください。`,
      originalQuery: query,
      topic
    };
  }
});

/**
 * クエリが十分に具体的かどうかをAIで判断する関数
 */
async function isQuerySpecificAI(query: string): Promise<boolean> {
  try {
    // 短すぎるクエリは即座に曖昧と判断
    if (query.length < 10) return false;
    
    // 新しいAgentを作成して判断を実行
    const querySpecificityAgent = new Agent({
      name: "Query Specificity Checker",
      instructions: `あなたはクエリの具体性を判断する専門家です。ユーザーが入力したクエリが十分に具体的か、あるいは曖昧でより詳細な情報が必要かを判断してください。

曖昧なクエリの例:
- 「人工知能について教えて」
- 「ブロックチェーンとは」
- 「量子コンピュータの基本」

具体的なクエリの例:
- 「人工知能が金融業界に与える影響と将来的な課題について」
- 「ブロックチェーン技術のサプライチェーン管理への応用事例」
- 「量子コンピュータの暗号技術への影響と対策」

判断基準:
1. クエリが具体的なトピックや焦点を含んでいるか
2. クエリが特定の文脈や分野を指定しているか
3. クエリが単なる定義や概要を超えた情報を求めているか

返答は「true」または「false」のみで、具体的なクエリなら「true」、曖昧なクエリなら「false」と返してください。`,
      model: openai("gpt-3.5-turbo"),
    });
    
    // エージェントにクエリを渡して判断を実行
    const response = await querySpecificityAgent.generate(
      `次のクエリは十分に具体的かどうか判断してください。trueからfalseだけで答えてください: "${query}"`
    );
    
    const result = response.text.trim().toLowerCase();
    console.log(`[AI判断] クエリ: "${query}" => 判断結果: ${result}`);
    
    return result.includes('true');
  } catch (error) {
    console.error('[AI判断エラー]', error);
    // APIエラーの場合はフォールバックとしてルールベースの判断を使用
    return isQuerySpecificRuleBased(query);
  }
}

/**
 * ルールベースでクエリが十分に具体的かどうかを判断する関数
 * AI判断が失敗した場合のバックアップとして使用
 */
function isQuerySpecificRuleBased(query: string): boolean {
  // 単純な長さチェック（短すぎるクエリは曖昧である可能性が高い）
  if (query.length < 15) return false;
  
  // 「～について教えて」パターンは明確に曖昧と判断
  if (query.includes("について教えて") || 
      query.includes("についておしえて") || 
      query.includes("を教えて") || 
      query.includes("をおしえて") || 
      query.includes("tell me about") || 
      query.includes("explain about")) {
    return false;
  }
  
  // 一般的すぎるキーワードパターンをチェック
  const generalPatterns = [
    "とは", "とは何", "とは何か", "の基本", "の概要", "の概要を", 
    "の基礎", "の全体", "の全体像", "の全体像を", "の特徴", "の特徴を",
    "what is", "explain", "tell me", "overview", "basics of", "fundamentals of"
  ];
  
  for (const pattern of generalPatterns) {
    if (query.includes(pattern)) return false;
  }
  
  // 特定のキーワードを含むかどうかをチェック
  const specificKeywords = [
    "方法", "手順", "比較", "違い", "メリット", "デメリット", 
    "事例", "例", "歴史", "開発", "将来", "予測", "影響", 
    "問題点", "課題", "解決策", "対策", "最新", "トレンド",
    "利点", "欠点", "適用", "実装", "技術", "アーキテクチャ", "プロトコル",
    "フレームワーク", "ライブラリ", "ツール", "実装方法", "実装例",
    "how", "why", "what", "when", "where", "compare", "difference",
    "advantage", "disadvantage", "example", "case", "history",
    "development", "future", "prediction", "impact", "problem",
    "solution", "measure", "latest", "trend", "benefit", "drawback",
    "application", "implementation", "technology", "architecture", "protocol",
    "framework", "library", "tool", "method", "example implementation"
  ];
  
  for (const keyword of specificKeywords) {
    if (query.includes(keyword)) return true;
  }
  
  // 疑問符を含むクエリは具体的な質問である可能性が高い
  if (query.includes("?") || query.includes("？")) return true;
  
  // デフォルトでは曖昧と判断
  return false;
}

/**
 * クエリのトピックを特定する関数
 */
function identifyTopic(query: string): string {
  // 簡易的なトピック抽出（実際の実装ではより高度な自然言語処理を使用）
  const topics = [
    "AI", "人工知能", "機械学習", "ディープラーニング", "生成AI",
    "ブロックチェーン", "暗号通貨", "仮想通貨", "NFT", "Web3",
    "量子コンピュータ", "量子暗号", "量子技術",
    "メタバース", "VR", "AR", "XR",
    "IoT", "5G", "6G", "通信技術",
    "サイバーセキュリティ", "情報セキュリティ", "プライバシー",
    "ロボティクス", "自動化", "ドローン",
    "宇宙技術", "宇宙開発", "宇宙旅行",
    "再生可能エネルギー", "持続可能性", "SDGs",
    "バイオテクノロジー", "遺伝子編集", "CRISPR"
  ];
  
  for (const topic of topics) {
    if (query.includes(topic)) return topic;
  }
  
  // デフォルトのトピック
  return "テクノロジー";
}

/**
 * トピックに基づいて適切な質問を生成する関数
 * 将来的にはこれもAIを使用して生成するように拡張可能
 */
function generateClarificationQuestions(topic: string): string[] {
  // 共通の質問
  const commonQuestions = [
    "基本的な仕組みや定義について知りたいのか？",
    "活用事例（ビジネス、教育、医療、芸術など）を知りたいのか？",
    "日本国内や海外の最新動向やトレンドを調べてほしいのか？",
    "倫理的課題や規制、リスクに関心があるのか？",
    "技術的な仕組みや実装方法に興味があるのか？"
  ];
  
  // トピック固有の質問
  const topicSpecificQuestions: Record<string, string[]> = {
    "AI": [
      "AIの種類や分類について知りたいのか？",
      "AIの学習方法や訓練データについて知りたいのか？",
      "AIの限界や課題について知りたいのか？"
    ],
    "人工知能": [
      "人工知能の歴史や発展について知りたいのか？",
      "人工知能の種類や分類について知りたいのか？",
      "人工知能の社会的影響について知りたいのか？"
    ],
    "生成AI": [
      "生成AIの種類（テキスト生成、画像生成、音声生成など）について知りたいのか？",
      "生成AIのビジネス活用事例について知りたいのか？",
      "生成AIの著作権や法的問題について知りたいのか？"
    ],
    "ブロックチェーン": [
      "ブロックチェーンの仕組みや技術的特徴について知りたいのか？",
      "ブロックチェーンの応用分野について知りたいのか？",
      "ブロックチェーンの課題や限界について知りたいのか？"
    ]
  };
  
  // トピックに固有の質問がある場合は追加
  const specificQuestions = topicSpecificQuestions[topic] || [];
  
  return [...commonQuestions, ...specificQuestions];
}

/**
 * ユーザーの回答を処理するツール
 * 明確化質問に対するユーザーの回答を処理し、より具体的なクエリを生成します
 */
export const clarificationProcessor = createTool({
  id: "Clarification Processor",
  description: "明確化質問に対するユーザーの回答を処理し、より具体的なクエリを生成します",
  inputSchema: z.object({
    originalQuery: z.string().describe("ユーザーの元のクエリ"),
    userResponse: z.string().describe("明確化質問に対するユーザーの回答"),
  }),
  execute: async ({ context }) => {
    const { originalQuery, userResponse } = context;
    
    // ユーザーの回答から具体的な関心事を抽出
    const interests = extractInterests(userResponse);
    
    // 元のクエリとユーザーの関心事を組み合わせて、より具体的なクエリを生成
    const enhancedQuery = generateEnhancedQuery(originalQuery, interests);
    
    return {
      enhancedQuery,
      interests,
      originalQuery
    };
  }
});

/**
 * ユーザーの回答から関心事を抽出する関数
 */
function extractInterests(userResponse: string): string[] {
  const interestKeywords = [
    { keyword: "基本", interest: "基本概念と定義" },
    { keyword: "仕組み", interest: "技術的仕組み" },
    { keyword: "定義", interest: "基本概念と定義" },
    { keyword: "活用", interest: "活用事例" },
    { keyword: "事例", interest: "活用事例" },
    { keyword: "ビジネス", interest: "ビジネス活用" },
    { keyword: "教育", interest: "教育分野での活用" },
    { keyword: "医療", interest: "医療分野での活用" },
    { keyword: "芸術", interest: "芸術分野での活用" },
    { keyword: "最新", interest: "最新動向" },
    { keyword: "動向", interest: "最新動向" },
    { keyword: "トレンド", interest: "最新トレンド" },
    { keyword: "日本", interest: "日本国内の状況" },
    { keyword: "海外", interest: "海外の状況" },
    { keyword: "倫理", interest: "倫理的課題" },
    { keyword: "課題", interest: "課題と問題点" },
    { keyword: "規制", interest: "法規制" },
    { keyword: "リスク", interest: "リスクと対策" },
    { keyword: "技術", interest: "技術的詳細" },
    { keyword: "モデル", interest: "モデルアーキテクチャ" },
    { keyword: "トレーニング", interest: "学習方法" },
    { keyword: "API", interest: "API活用" }
  ];
  
  const interests: string[] = [];
  
  for (const { keyword, interest } of interestKeywords) {
    if (userResponse.toLowerCase().includes(keyword.toLowerCase()) && !interests.includes(interest)) {
      interests.push(interest);
    }
  }
  
  return interests.length > 0 ? interests : ["一般的な情報"];
}

/**
 * 元のクエリとユーザーの関心事を組み合わせて、より具体的なクエリを生成する関数
 */
function generateEnhancedQuery(originalQuery: string, interests: string[]): string {
  if (interests.length === 0) return originalQuery;
  
  // 関心事を文字列に変換
  const interestsText = interests.join("、");
  
  // 元のクエリが疑問形かどうかを判断
  const isQuestion = originalQuery.endsWith("?") || originalQuery.endsWith("？");
  
  if (isQuestion) {
    // 疑問形の場合は、関心事を追加情報として付加
    return `${originalQuery.slice(0, -1)}について、特に${interestsText}の観点から教えてください？`;
  } else {
    // 疑問形でない場合は、関心事を含む新しいクエリを生成
    return `${originalQuery}について、${interestsText}の観点から詳しく調査してください。`;
  }
}
