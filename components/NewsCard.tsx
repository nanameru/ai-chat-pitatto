'use client';

import Link from 'next/link';
import { NewsItem } from '@/lib/newsData';
import { Clock3Icon, LinkIcon } from 'lucide-react';

interface NewsCardProps {
  newsItem: NewsItem;
}

// 日付をフォーマットする関数 (コンポーネント内で定義、またはutilsに移動してもOK)
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

export default function NewsCard({ newsItem }: NewsCardProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col h-full group">
      {newsItem.imageUrl && (
        <div className="w-full h-40 bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0">
          <img
            src={newsItem.imageUrl}
            alt={newsItem.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}
      <div className="p-4 flex flex-col flex-grow">
        {/* 詳細ページへのリンクをタイトルに設定 */}
        <Link href={`/news/${newsItem.id}`} className="block mb-1">
          <h2 className="text-lg font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2">
            {newsItem.title}
          </h2>
        </Link>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2 flex-grow">{newsItem.description}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mt-auto pt-2">
          <span className="flex items-center whitespace-nowrap">
            <Clock3Icon className="h-3 w-3 mr-1" />
            {formatDate(newsItem.publishedAt)}
          </span>
          <span className="flex items-center whitespace-nowrap">
            <LinkIcon className="h-3 w-3 mr-1" />
            {newsItem.source}
          </span>
          <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded whitespace-nowrap">
            {newsItem.category}
          </span>
          {newsItem.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded whitespace-nowrap"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
} 