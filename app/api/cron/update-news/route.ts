import { NextResponse } from 'next/server';
import { cozeTool } from '@/lib/mastra/tools';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import Anthropic from '@anthropic-ai/sdk';

// 簡易的な認証トークン (本番環境ではより安全な方法を使用してください)
const AUTH_TOKEN = process.env.CRON_SECRET || 'default-secret-token';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Anthropicクライアントの初期化
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

/**
 * 生成AI関連のニュースを取得して記事を生成するジョブ
 */
export async function GET(request: Request) {
  // 認証チェック
  const authHeader = request.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    console.log('📰 生成AIニュース自動更新を開始します...');
    
    // 既に過去24時間以内に作成された記事の数を確認
    const lastDay = new Date();
    lastDay.setHours(lastDay.getHours() - 24);
    
    const recentArticlesCount = await db.news.count({
      where: {
        source: 'AI News Bot',
        publishedAt: {
          gte: lastDay.toISOString() // ISO文字列に変換
        }
      }
    });
    
    console.log(`過去24時間に生成された記事数: ${recentArticlesCount}`);
    
    // 1日の上限を40記事に制限（4倍に増加）
    if (recentArticlesCount >= 40) {
      console.log('24時間の記事生成上限に達しました。次の実行を待ちます。');
      return NextResponse.json({ 
        success: true, 
        message: '24時間の記事生成上限に達しました',
        skipped: true
      });
    }

    // Coze Toolを使用して最新の生成AI関連の情報を取得（Twitter/X投稿など）
    console.log('Coze APIでデータを取得中...');
    const result = await cozeTool.execute({
      context: {
        prompt: 'AI',  // プロンプトは固定値「AI」を使用（Coze Workflow側で処理）
        options: {
          format: 'json'
        }
      }
    });

    console.log('Cozeからのレスポンス:');
    console.log('----------------------------------------');
    console.log(typeof result.content, result.content ? result.content.length : 0);
    console.log('----------------------------------------');
    console.log(result.content ? result.content.substring(0, 1000) + '...' : 'コンテンツなし');
    console.log('----------------------------------------');

    // レスポンスがJSON文字列の場合はオブジェクトに変換
    let cozeData = result.content;
    try {
      // すでにJSON文字列の場合はパース
      if (typeof result.content === 'string') {
        cozeData = JSON.parse(result.content);
        console.log('Cozeレスポンスを正常にJSONとしてパースしました');
      }
    } catch (error) {
      console.log('CozeレスポンスのJSONパースに失敗しました、テキストとして処理します:', error);
      // パースに失敗した場合はそのまま文字列として使用
      cozeData = result.content;
    }

    // Cozeから取得したデータをもとに、Anthropic Claudeで記事を生成
    console.log('Claudeを使用して記事を生成中...');
    
    const claudePrompt = `
    あなたは生成AI技術に関するニュース記事を書くプロフェッショナルライターです。
    以下のデータを元に、5つの異なる生成AI関連の記事を作成してください。
    
    <収集データ>
    ${typeof cozeData === 'string' ? cozeData : JSON.stringify(cozeData, null, 2)}
    </収集データ>
    
    <重要な要件>
    - 必ずAIに関する記事のみを作成してください。
    - 記事は必ず日本語で書いてください。
    - カテゴリはAI関連の適切なカテゴリを自由に設定してください。例えば「ChatGPT」「Gemini」「Claude」「生成AI」「機械学習」「深層学習」「自然言語処理」「音声AI」「画像生成」「ロボティクス」などが考えられます。
    - 記事内容はAI技術、特に生成AI、大規模言語モデル、チャットボット、AIアシスタントに関するものに限定してください。
    - 一般的なテクノロジーや非AI関連の話題は避けてください。
    - データ内のTwitter/X投稿から最新のAI関連情報を抽出し、まとめてください。
    - 重要なアップデート、製品発表、技術進歩などを優先してください。
    </重要な要件>
    
    各記事は以下の形式のJSONで返してください：
    
    [
      {
        "title": "記事のタイトル（必ず日本語）",
        "description": "記事の概要（100-150文字、必ず日本語）",
        "content": "記事の本文（300-500文字、必ず日本語）",
        "source": "情報源",
        "sourceUrl": "参照URL",
        "category": "カテゴリ（ChatGPT、Gemini、Claude、Cursor、Kamui、生成AIのいずれか）",
        "tags": ["生成AI", "関連キーワード2", "関連キーワード3"]
      },
      ...（5つの記事）
    ]
    
    記事は事実に基づいた内容にし、最新の情報を反映させてください。
    各記事は独自性があり、重複しないようにしてください。
    JSON形式のみを返してください。説明は不要です。
    `;
    
    console.log('Claudeプロンプト:');
    console.log('----------------------------------------');
    console.log(claudePrompt.substring(0, 500) + '...');
    console.log('----------------------------------------');
    
    const claudeResponse = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 4000,
      messages: [
        { role: "user", content: claudePrompt }
      ],
      temperature: 0.7,
    });
    
    console.log('Claudeの応答を受信しました');
    
    // Claude からの応答をパース
    let newsItems;
    try {
      // 応答テキストからJSON部分を抽出
      const responseContent = claudeResponse.content[0].text;
      const jsonMatch = responseContent.match(/\[\s*\{.*\}\s*\]/s);
      
      if (jsonMatch) {
        // JSONを解析
        newsItems = JSON.parse(jsonMatch[0]);
      } else {
        // コンテンツ全体をJSONとして解析を試みる
        newsItems = JSON.parse(responseContent);
      }
      
      if (!Array.isArray(newsItems)) {
        throw new Error('ニュースアイテムの配列が見つかりませんでした');
      }
      
      console.log(`${newsItems.length}件のニュース記事を生成しました`);
    } catch (error) {
      console.error('JSONパースエラー:', error);
      console.log('Claudeの応答:', claudeResponse.content[0].text);
      return NextResponse.json({ 
        success: false, 
        message: 'レスポンスの解析に失敗しました',
        error: (error as Error).message
      }, { status: 500 });
    }

    // ニュース記事をデータベースに保存
    const savedArticles = [];
    for (const item of newsItems) {
      const now = new Date();
      const isoDate = now.toISOString();
      
      // タグの正規化: 最大5つまで、小文字に変換
      const normalizedTags = (item.tags || [])
        .map((tag: string) => tag.toLowerCase().trim())
        .filter((tag: string) => tag.length > 0)
        .slice(0, 5);
      
      try {
        console.log(`記事「${item.title}」を保存中...`);
        
        const article = await db.news.create({
          id: nanoid(),
          title: item.title,
          description: item.description,
          content: item.content,
          source: 'AI News Bot',
          url: item.sourceUrl || 'https://example.com/ai-news',
          category: item.category || '生成AI',
          tags: normalizedTags,
          publishedAt: isoDate,
          featured: false,
          imageUrl: null
        });
        
        savedArticles.push(article);
        console.log(`記事を保存しました: ${article.title}`);
      } catch (error) {
        console.error(`記事の保存に失敗しました: ${item.title}`, error);
        console.error(JSON.stringify(error));
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `${savedArticles.length}件の記事を生成しました`,
      articles: savedArticles.map(a => a.id)
    });
    
  } catch (error) {
    console.error('ニュース生成エラー:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'ニュース生成中にエラーが発生しました',
      error: (error as Error).message
    }, { status: 500 });
  }
} 