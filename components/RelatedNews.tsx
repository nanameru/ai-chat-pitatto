'use client';

import Link from 'next/link';
import { NewsItem } from '@/lib/newsData';
import { ArrowRightIcon } from 'lucide-react';

interface RelatedNewsProps {
  relatedNews: NewsItem[];
}

// 日付フォーマット関数（ここでも必要）
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

export default function RelatedNews({ relatedNews }: RelatedNewsProps) {
  if (relatedNews.length === 0) {
    return null; // 関連ニュースがない場合は表示しない
  }

  return (
    <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 not-prose">
      <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
        関連ニュース
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {relatedNews.map((item) => (
          <Link 
            href={`/news/${item.id}`} 
            key={item.id} 
            className="block border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
          >
            <h4 className="font-semibold text-base mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-2">
              {item.title}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
              {item.description}
            </p>
            <div className="flex justify-between items-center text-xs text-gray-400 dark:text-gray-500">
              <span>{formatDate(item.publishedAt)}</span>
              <ArrowRightIcon className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
} 