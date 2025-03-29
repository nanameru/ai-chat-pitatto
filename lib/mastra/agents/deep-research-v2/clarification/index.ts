import { createTool } from "@mastra/core/tools";
import { z } from "zod";

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
    
    // クエリが十分に具体的かどうかを判断
    const isSpecific = isQuerySpecific(query);
    
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
 * クエリが十分に具体的かどうかを判断する関数
 */
function isQuerySpecific(query: string): boolean {
  // 単純な長さチェック（短すぎるクエリは曖昧である可能性が高い）
  if (query.length < 15) return false;
  
  // 特定のキーワードを含むかどうかをチェック
  const specificKeywords = [
    "方法", "手順", "比較", "違い", "メリット", "デメリット", 
    "事例", "例", "歴史", "開発", "将来", "予測", "影響", 
    "問題点", "課題", "解決策", "対策", "最新", "トレンド",
    "how", "why", "what", "when", "where", "compare", "difference",
    "advantage", "disadvantage", "example", "case", "history",
    "development", "future", "prediction", "impact", "problem",
    "solution", "measure", "latest", "trend"
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
