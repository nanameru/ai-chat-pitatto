'use client';

import Link from 'next/link';
import { NewsItem } from '@/lib/newsData';
import { ArrowRightIcon } from 'lucide-react';

interface FeaturedNewsSectionProps {
  featuredNews: NewsItem[];
}

export default function FeaturedNewsSection({ featuredNews }: FeaturedNewsSectionProps) {
  if (featuredNews.length === 0) {
    return null;
  }

  return (
    <section className="mb-12">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center">
          注目の連載記事
          <ArrowRightIcon className="h-5 w-5 ml-2 text-red-500" />
        </h2>
        <Link href="/news" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          もっと見る
        </Link>
      </div>
      <div className="space-y-4">
        {featuredNews.map((item) => (
          <Link 
            href={`/news/${item.id}`} 
            key={item.id} 
            className="flex items-start gap-4 p-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
          >
            {/* 画像（ダミー画像または実際の画像） */} 
            <div className="w-24 h-16 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0 overflow-hidden">
              {item.imageUrl ? (
                <img 
                  src={item.imageUrl} 
                  alt={item.title} 
                  className="w-full h-full object-cover"
                />
              ) : (
                 // ダミー画像やプレースホルダーを表示する場合
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Image</div>
              )} 
            </div>
            <div className="flex-grow">
              <span className="text-xs text-red-600 dark:text-red-400 font-semibold mb-1 block">
                {item.category} {/* カテゴリなどを表示 */} 
              </span>
              <h3 className="font-semibold text-base mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-2">
                {item.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                 {/* ソースなどを表示 */} 
                 {item.source} 
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
} 