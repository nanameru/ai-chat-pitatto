import { getNewsById, NewsItem, getRelatedNews } from "@/lib/newsData";
import { notFound } from 'next/navigation';
import { Metadata, ResolvingMetadata } from 'next';
import Link from 'next/link';
import { Clock3Icon, LinkIcon, ArrowLeftIcon, TagIcon } from 'lucide-react';
import ShareButtons from "../../../components/ui/ShareButtons";
import RelatedNews from "../../../components/RelatedNews";

type Props = {
  params: { id: string };
};

// メタデータを動的に生成
export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const id = params.id;
  const newsItem = await getNewsById(id);

  if (!newsItem) {
    return {
      title: '記事が見つかりません - 生成AIニュース',
    };
  }

  return {
    title: `${newsItem.title} - 生成AIニュース`,
    description: newsItem.description,
    openGraph: {
      title: newsItem.title,
      description: newsItem.description,
      // images: newsItem.imageUrl ? [newsItem.imageUrl] : [], // 必要に応じてOGP画像を設定
    },
  };
}

// JSON-LD生成関数
function generateNewsArticleJsonLd(newsItem: NewsItem) {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: newsItem.title,
    datePublished: newsItem.publishedAt,
    description: newsItem.description,
    author: {
      '@type': 'Organization',
      name: newsItem.source, 
    },
    publisher: {
      '@type': 'Organization',
      name: '生成AIニュース',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': newsItem.url, 
    },
  };
}

// 日付フォーマット関数（共通化推奨）
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric' 
  }).format(date);
};

export default async function NewsDetailPage({ params }: Props) {
  const newsItem = await getNewsById(params.id);

  if (!newsItem) {
    notFound(); // 記事が見つからない場合は404ページを表示
  }

  // 関連ニュースを取得
  const relatedNews = await getRelatedNews(newsItem);

  // JSON-LDデータを生成
  const jsonLd = generateNewsArticleJsonLd(newsItem);

  // 共有ボタン用のURL (環境変数などからベースURLを取得するのが望ましい)
  // ここでは newsItem.url が完全なURLであることを前提とする
  const shareUrl = newsItem.url; 

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="prose prose-gray dark:prose-invert max-w-none">
        {/* 一覧へ戻るボタン */} 
        <Link 
          href="/news"
          className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline mb-6 no-underline"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          ニュース一覧に戻る
        </Link>

        {/* タイトル (レスポンシブフォントサイズ) */} 
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          {newsItem.title}
        </h1>

        {/* 共有ボタン */} 
        <div className="mb-6 not-prose">
          <ShareButtons url={shareUrl} title={newsItem.title} />
        </div>

        {/* メタ情報 */} 
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
          <span className="flex items-center whitespace-nowrap">
            <Clock3Icon className="h-4 w-4 mr-1" />
            公開日: {formatDate(newsItem.publishedAt)}
          </span>
          <span className="flex items-center whitespace-nowrap">
            <LinkIcon className="h-4 w-4 mr-1" />
            ソース: 
            <a href={newsItem.url} target="_blank" rel="noopener noreferrer" className="ml-1 hover:underline">
              {newsItem.source}
            </a>
          </span>
          <span className="flex items-center whitespace-nowrap">
            カテゴリー: 
            <span className="ml-1 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">
              {newsItem.category}
            </span>
          </span>
        </div>

        {/* 画像 (あれば表示) */}
        {newsItem.imageUrl && (
          <div className="my-6 md:my-8">
            <img 
              src={newsItem.imageUrl} 
              alt={newsItem.title}
              className="rounded-lg w-full object-cover"
            />
          </div>
        )}

        {/* 本文 (レスポンシブフォントサイズ調整 - proseが基本スタイルを提供) */} 
        {/* prose自体がレスポンシブなタイポグラフィを持つことが多いが、必要なら上書き */}
        <div className="text-base md:text-lg leading-relaxed md:leading-loose">
          <p>{newsItem.content.split('\n').map((paragraph, index) => (
            <span key={index}>{paragraph}<br/></span> 
          ))}</p>
        </div>

        {/* タグ */} 
        <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold mb-2 text-gray-600 dark:text-gray-300">タグ</h3>
          <div className="flex flex-wrap gap-2">
            {newsItem.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1 rounded text-xs"
              >
                <TagIcon className="h-3 w-3 mr-1" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      </article>

      {/* 関連ニュースセクション */} 
      <RelatedNews relatedNews={relatedNews} />
    </>
  );
} 