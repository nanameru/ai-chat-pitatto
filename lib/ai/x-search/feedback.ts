import { XSearchOptions } from './index';
import { type Message } from 'ai';
import { streamText, createDataStreamResponse, smoothStream } from 'ai';
import { myProvider } from '@/lib/ai/models';
import { generateCozeResponse } from '../coze/coze';
import { nanoid } from 'nanoid';

const FEEDBACK_PROMPT = `
あなたは「PitattoAI」のX検索アシスタントです。
ユーザーの検索意図を深く理解し、より良い検索結果を得るために必要な情報を引き出すことが役割です。
現在の時刻は <<CURRENT_TIME>> です。

【基本ルール】
1. **質問の構造**
   - ユーザーの入力内容を分析し、必要な情報を整理
   - 以下の3つの観点を1つの文章にまとめて質問
     a) トピックの具体化（分野、文脈、キーワード）
     b) 情報の深さ（概要か詳細か、事実か意見か）
     c) 時間的範囲（いつからいつまでか）
   - 質問は親しみやすく、会話的な口調で

2. **質問の形式**
   - [トピック]についてお聞きしたいのですが、以下の点について教えていただけますか？
   - 箇条書きで3つの具体的な選択肢を提示
   - 最後に「ご希望に沿った情報をお届けしますので、お知らせください！」

【応答例】
AIニュースについてお聞きしたいのですが、以下の点について教えていただけますか？

・特に興味のある分野やトピックはありますか？
  技術革新、企業の動向、倫理問題など

・どのような情報をお探しですか？
  最新のニュース、分析記事、専門家の意見など

・情報の期間はどのくらいを重視されますか？
  最近のニュース、過去数ヶ月のトレンド、<<CURRENT_YEAR>>年の総括など

ご希望に沿った情報をお届けしますので、お知らせください！`;

const SUBQUERY_GENERATION_PROMPT =  `
あなたは「GPT-4レベルのAI」であり、「PitattoAI」のサブクエリ生成アシスタントです。
あなたの役割は、ユーザーの入力から「X(Twitter)検索で多くヒットしそうなサブクエリ」を自動生成することです。

最終出力は **1つのJSON配列**（要素数6～10個）のみで、各要素は \`{"query": "..."} \` という形式にし、解説や文章は一切付けない。

【基本ルール】
1. **言語指定の判断**  
   - ユーザー入力に言語指定がある場合、その言語**のみ**のクエリを作る。  
   - **言語指定がない場合**は下記の割合でクエリを作成（合計6～10個）。  
     - 日本語 (lang:ja): 40% → min_faves:100  
     - 英語 (lang:en): 30% → min_faves:500  
     - 中国語 (lang:zh): 30% → min_faves:300  

2. **キーワードの言語変換・選択**  
   - **必ずクエリのlangに合わせた言語表記のキーワードを使う**。  
   - 例）  
     - lang:enの場合: 英語表現だけ  
     - lang:jaの場合: 日本語表現だけ  
     - lang:zhの場合: 中国語表現だけ  

3. **min_favesの設定**  
   - lang:ja → min_faves:100  
   - lang:en → min_faves:500  
   - lang:zh → min_faves:300  

4. **クエリ形式**  
   \`"<キーワード(1～2語)> [追加語] min_faves:X lang:xx [since:YYYY-MM-DD until:YYYY-MM-DD]"\``;

export interface SubqueryGenerationOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface SubqueryGenerationResult {
  queries: Array<{ query: string }>;
}

export async function generateXSearchSubqueries(
  userQuery: string,
  options: XSearchOptions,
): Promise<SubqueryGenerationResult> {
  console.log('generateXSearchSubqueries called with:', { userQuery, options });
  
  // 初回の質問かフィードバック後かを判断
  if (!options.xSearchState?.previousQueries) {
    // 初回の質問時は意図を確認する質問を生成
    const currentTime = new Date().toLocaleString('ja-JP', { 
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    const currentYear = new Date().getFullYear();
    
    const basePrompt = FEEDBACK_PROMPT
      .replace(/<<CURRENT_TIME>>/g, currentTime)
      .replace(/<<CURRENT_YEAR>>/g, currentYear.toString());
    
    const userPrompt = `以下のクエリについて、検索意図を明確にするための質問を生成してください：

"${userQuery}"`;

    // 初回は空のクエリ配列を返す
    return {
      queries: []
    };
  } else {
    // フィードバック後はサブクエリを生成
    const currentDate = new Date().toISOString().split('T')[0];
    
    const generateUserPrompt = () => {
      const previousQuery = options.xSearchState?.previousQueries?.[0] || '';
      
      return `
以下の会話履歴から、X(Twitter)検索用のサブクエリを生成してください：

【初回の質問】
${previousQuery}

【ユーザーの回答】
${userQuery}

【現在の日付】
${currentDate}

【手順】
1. キーワード抽出（1～2語）
   - 会話の文脈を考慮した主要キーワードを1～2語に短縮
   - なるべく多くの投稿がヒットしそうな広義かつ一般的な単語を選択

2. 期間指定
   - 「最新の～」「最近の～」→ 1週間分の期間指定を追加
   - 具体的な日付指定があれば適宜since/untilを追加

3. 最終出力形式
   [
     {"query": "AI development min_faves:500 lang:en"},
     {"query": "ChatGPT min_faves:500 lang:en since:2025-01-26 until:2025-02-02"},
     ...
   ]`;
    };

    // サブクエリを生成（ストリーミングなし）
    const response = await generateCozeResponse(generateUserPrompt(), {
      model: myProvider.languageModel('chat-model-small'),
      system: SUBQUERY_GENERATION_PROMPT,
    });

    try {
      // レスポンスをJSONとしてパース
      const parsedResponse = JSON.parse(response) as Array<{ query: string }>;
      
      // 生成されたサブクエリを含むレスポンスを返す
      return {
        queries: parsedResponse
      };
    } catch (error) {
      console.error('Error parsing subqueries:', error);
      throw new Error('サブクエリの生成に失敗しました。');
    }
  }
}
