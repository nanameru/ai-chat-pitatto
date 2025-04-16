export interface NewsItem {
  id: string;
  title: string;
  description: string;
  content: string; // 詳細ページ用に全文を含む想定
  publishedAt: string;
  source: string;
  url: string;
  imageUrl?: string;
  category: 'ChatGPT' | 'Gemini' | 'Claude' | 'Cursor' | 'Kamui' | '生成AI' | 'その他'; // カテゴリーを型として定義
  tags: string[];
}

// モックデータ（生成AI関連に更新、カテゴリーも更新）
const mockNewsData: NewsItem[] = [
  {
    id: '1',
    title: 'OpenAI、GPT-5を発表間近か？噂と予想される新機能まとめ',
    description: '次世代大規模言語モデルGPT-5に関する最新の噂と、期待される性能向上について解説します。',
    content: 'OpenAIが開発中の次世代大規模言語モデル「GPT-5」について、その発表時期や新機能に関する憶測が飛び交っています。現行のGPT-4と比較して、推論能力、コーディング支援、多言語対応などが大幅に向上すると予想されています。特に、より複雑な問題解決能力や、人間のような自然な対話能力が期待されており、ビジネス応用や研究分野でのブレークスルーが注目されます。発表は2024年末から2025年初頭と噂されていますが、公式な情報はまだありません。',
    publishedAt: '2024-07-20T10:00:00Z',
    source: 'Tech Trends',
    url: 'https://example.com/news/genai/1',
    category: 'ChatGPT', 
    tags: ['生成AI', 'GPT-5', 'OpenAI', '大規模言語モデル']
  },
  {
    id: '2',
    title: 'Google、Gemini 2.0を発表 - マルチモーダル性能が大幅向上',
    description: 'Googleが最新AIモデル「Gemini 2.0」を発表。テキスト、画像、音声、動画を統合的に扱う能力が向上しました。',
    content: 'Googleは年次開発者会議で、最新のAIモデル「Gemini 2.0」を発表しました。前バージョンと比較して、特にマルチモーダル性能が大幅に強化され、画像や動画の内容理解、音声との連携がよりスムーズになりました。これにより、Google検索やWorkspaceなどの既存サービスとの連携が強化され、より高度なAI機能が利用可能になります。開発者向けには、Gemini APIもアップデートされ、新機能を利用したアプリケーション開発が促進される見込みです。',
    publishedAt: '2024-07-18T14:30:00Z',
    source: 'AI Frontier',
    url: 'https://example.com/news/genai/2',
    category: 'Gemini', 
    tags: ['生成AI', 'Google', 'Gemini', 'マルチモーダルAI']
  },
  {
    id: '3',
    title: 'Anthropic、Claude 3.5 Sonnetをリリース、ベンチマークで新記録',
    description: 'Anthropicが最新モデルClaude 3.5 Sonnetを発表。多くのベンチマークでGPT-4oを上回る性能を示しました。',
    content: 'Anthropicは、Claude 3ファミリーの最新モデル「Claude 3.5 Sonnet」を発表しました。このモデルは、特にコーディング、視覚、複雑な指示の理解において顕著な性能向上を達成し、多くの標準ベンチマークで競合モデルを凌駕しています。新しい「Artifacts」機能により、コードスニペットやドキュメントなどをプレビュー・編集できるサイドパネルも導入され、開発者やクリエイターの生産性向上が期待されます。API料金は従来のClaude 3 Sonnetと同等に設定されています。',
    publishedAt: '2024-07-15T11:45:00Z',
    source: 'AI Research Today',
    url: 'https://example.com/news/genai/3',
    category: 'Claude', 
    tags: ['生成AI', 'Claude', 'Anthropic', 'ベンチマーク']
  },
  {
    id: '4',
    title: 'AI搭載エディタCursorがv0.30にアップデート、新機能と改善点',
    description: '開発者向けAIコードエディタCursorがメジャーアップデート。新しいAI機能やUI改善が含まれます。',
    content: 'AIを活用したコーディング支援で人気のCursorエディタがv0.30にアップデートされました。今回のアップデートでは、インラインチャット機能の強化、より高速なコード生成、デバッグ支援機能の改善などが含まれています。また、UIも刷新され、より直感的で使いやすいインターフェースになりました。VSCode拡張機能との連携も強化され、既存の開発環境への導入もスムーズに行えます。',
    publishedAt: '2024-07-12T09:20:00Z',
    source: 'Developer Tools Weekly',
    url: 'https://example.com/news/genai/4',
    category: 'Cursor', 
    tags: ['生成AI', '開発ツール', 'Cursor', 'コードエディタ']
  },
  {
    id: '5',
    title: 'ピタットAI、次世代対話型AI「Kamui」を発表 - 自然言語処理能力を強化',
    description: '株式会社ピタットAIが、新たな対話型AIモデル「Kamui」を発表。より自然で文脈に沿った対話が可能に。',
    content: 'ピタットAIは、本日、最新の対話型AIモデル「Kamui」を発表しました。Kamuiは、高度な自然言語理解と生成能力を備え、複雑な質問応答や創造的なテキスト生成タスクにおいて優れたパフォーマンスを発揮します。特に、日本語のニュアンスや文脈理解に重点を置いて開発されており、国内ユーザーにとってより使いやすいAIとなることを目指しています。エンタープライズ向けのカスタマイズオプションも提供予定です。',
    publishedAt: '2024-07-10T16:00:00Z',
    source: 'Pitatto AI Press',
    url: 'https://example.com/news/genai/5',
    category: 'Kamui', 
    tags: ['生成AI', '対話型AI', 'Kamui', 'ピタットAI', '自然言語処理']
  },
  {
    id: '6',
    title: 'ChatGPT Enterprise導入事例：大手製造業での活用と効果',
    description: 'ChatGPT Enterpriseを導入した大手製造業A社の事例。業務効率化や知識共有にどのように貢献しているか。',
    content: '大手製造業A社は、ChatGPT Enterpriseを全社的に導入し、研究開発、設計、マーケティング部門などで活用しています。具体的なユースケースとして、技術文書の要約・翻訳、設計仕様書のドラフト作成、マーケティングコピーの生成などが挙げられます。導入により、各部門での作業時間が平均20%削減され、部門間の知識共有も促進されたとのことです。セキュリティとコンプライアンス要件を満たす点も導入の決め手となりました。',
    publishedAt: '2024-07-08T13:10:00Z',
    source: 'Business AI Strategy',
    url: 'https://example.com/news/genai/6',
    category: 'ChatGPT', 
    tags: ['生成AI', 'ChatGPT', '企業導入', '事例', '業務効率化']
  },
  // データ数を増やすためにいくつか追加
  {
    id: '7',
    title: 'Gemini APIを活用したアプリケーション開発コンテスト開催',
    description: 'Google Cloudが、Gemini APIの利用促進を目的とした開発コンテストを開催します。賞金総額は10万ドル。',
    content: 'Google Cloudは、開発者コミュニティの活性化とGemini APIの普及を目指し、アプリケーション開発コンテスト「Gemini Developer Challenge」を発表しました。革新的なアイデアや技術的に優れた実装が評価され、最優秀賞には5万ドルが贈られます。対象となるアプリケーションは、ビジネス、エンターテイメント、教育など多岐にわたります。応募期間は8月1日から9月30日まで。',
    publishedAt: '2024-07-22T09:00:00Z',
    source: 'Google Cloud Blog',
    url: 'https://example.com/news/genai/7',
    category: 'Gemini',
    tags: ['生成AI', 'Google', 'Gemini', 'API', '開発コンテスト']
  },
  {
    id: '8',
    title: 'Claude 3.5 Sonnet、医療分野での活用可能性を探る研究',
    description: '最新のClaudeモデルが、医療文書の分析や診断支援にどのように役立つかについての研究が進行中です。',
    content: 'スタンフォード大学の研究チームは、AnthropicのClaude 3.5 Sonnetを用いて、医療記録の分析や診断支援システムの開発可能性を探る研究を開始しました。モデルの高い言語理解能力と推論能力を活用し、医師の診断精度向上や、患者への説明資料作成の自動化を目指します。倫理的な配慮とデータのプライバシー保護が重要な課題とされています。',
    publishedAt: '2024-07-19T15:20:00Z',
    source: 'Medical AI Journal',
    url: 'https://example.com/news/genai/8',
    category: 'Claude',
    tags: ['生成AI', 'Claude', '医療AI', '診断支援', '研究']
  },
];

// カテゴリーの型定義を流用して、カテゴリーリストを生成
export const newsCategories: NewsItem['category'][] = ['ChatGPT', 'Gemini', 'Claude', 'Cursor', 'Kamui', '生成AI', 'その他']; // 型から生成
export const allCategories = ['すべて', ...newsCategories];

// すべてのニュースを取得する関数 (ソート機能を考慮)
export const getAllNews = async (sortBy: SortOption = 'newest'): Promise<NewsItem[]> => {
  try {
    // APIからデータを取得 - サーバーサイドとクライアントサイドの両方で動作するURLを構築
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 
                   (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
    
    // 絶対URLを構築して使用
    const apiUrl = new URL('/api/news', baseUrl).toString();
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error('ニュース記事の取得に失敗しました:', response.statusText);
      // APIが失敗した場合はモックデータにフォールバック
      return sortNews([...mockNewsData], sortBy);
    }
    
    const data = await response.json();
    
    // データが正しい形式であることを確認
    if (!Array.isArray(data)) {
      console.warn('APIからの応答が配列ではありません。モックデータを使用します。');
      return sortNews([...mockNewsData], sortBy);
    }
    
    // サーバーサイドでソート済みだが、念のため再ソート
    return sortNews(data, sortBy);
  } catch (error) {
    console.error('ニュースデータの取得中にエラーが発生しました:', error);
    // エラーが発生した場合はモックデータにフォールバック
    return sortNews([...mockNewsData], sortBy);
  }
};

// 特定IDのニュース記事を取得する関数
export const getNewsById = async (id: string): Promise<NewsItem | undefined> => {
  try {
    // APIから単一記事を取得 - サーバーサイドとクライアントサイドの両方で動作するURLを構築
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 
                   (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
    
    // 絶対URLを構築して使用
    const apiUrl = new URL(`/api/news/${id}`, baseUrl).toString();
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error(`ID ${id} の記事取得に失敗しました:`, response.statusText);
      // APIが失敗した場合はモックデータから検索
      return mockNewsData.find(item => item.id === id);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`ID ${id} の記事取得中にエラーが発生しました:`, error);
    // エラーが発生した場合はモックデータから検索
    return mockNewsData.find(item => item.id === id);
  }
};

// カテゴリーでニュースをフィルタリングする関数（クライアントサイドでの利用を想定）
export const filterNewsByCategory = (news: NewsItem[], category: string): NewsItem[] => {
  if (category === 'すべて') {
    return news;
  }
  return news.filter(item => item.category === category);
};

// 検索語でニュースをフィルタリングする関数（クライアントサイドでの利用を想定）
export const searchNews = (news: NewsItem[], searchTerm: string): NewsItem[] => {
  if (!searchTerm) {
    return news;
  }
  const lowercasedTerm = searchTerm.toLowerCase();
  return news.filter(
    item => 
      item.title.toLowerCase().includes(lowercasedTerm) || 
      item.description.toLowerCase().includes(lowercasedTerm) ||
      item.tags.some(tag => tag.toLowerCase().includes(lowercasedTerm))
  );
};

// ソートオプションの型 (SortSelector からも参照可能にするためエクスポート)
export type SortOption = 'newest' | 'oldest';

// ニュースをソートする関数
export const sortNews = (news: NewsItem[], sortBy: SortOption): NewsItem[] => {
  switch (sortBy) {
    case 'newest':
      return news.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    case 'oldest':
      return news.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
    default:
      return news;
  }
};

// 関連ニュースを取得する関数
export const getRelatedNews = async (
  currentItem: NewsItem,
  limit: number = 3 // 取得する最大件数
): Promise<NewsItem[]> => {
  try {
    // まずすべてのニュースを取得
    const allNews = await getAllNews('newest');
    
    // 同じカテゴリの記事を取得し、現在の記事を除外
    const related = allNews
      .filter(item => item.category === currentItem.category && item.id !== currentItem.id)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()); // 新しい順

    return related.slice(0, limit);
  } catch (error) {
    console.error('関連ニュースの取得中にエラーが発生しました:', error);
    // エラーが発生した場合はモックデータから検索
    const related = mockNewsData
      .filter(item => item.category === currentItem.category && item.id !== currentItem.id)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    return related.slice(0, limit);
  }
};

// 注目の記事を取得する関数
export const getFeaturedNews = async (limit: number = 2): Promise<NewsItem[]> => {
  try {
    // すべてのニュースを取得
    const allNews = await getAllNews('newest');
    
    // 最新のニュースを「注目の記事」として返す
    return allNews.slice(0, limit);
  } catch (error) {
    console.error('注目の記事の取得中にエラーが発生しました:', error);
    // エラーが発生した場合はモックデータを使用
    return mockNewsData.slice(0, limit);
  }
}; 