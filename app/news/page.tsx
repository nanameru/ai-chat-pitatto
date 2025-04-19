'use client';

import { useState, useEffect } from 'react';
// import { Metadata } from 'next'; // Metadata のインポートを削除
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Input } from '@/components/ui/input';
import { SearchIcon, Loader2, PlusCircle } from 'lucide-react';
import Link from 'next/link';
// import Link from 'next/link'; // No longer needed here if header/footer removed
import { NewsItem, getAllNews, allCategories, filterNewsByCategory, searchNews, sortNews, SortOption, getFeaturedNews } from '@/lib/newsData'; // sortNews と SortOption をインポート
import NewsCard from '../../components/NewsCard';
import Pagination from '../../components/ui/Pagination';
import SortSelector from '../../components/ui/SortSelector'; // SortSelector をインポート
import FeaturedNewsSection from '../../components/FeaturedNewsSection'; // FeaturedNewsSection をインポート

// 静的なメタデータを削除
// export const metadata: Metadata = {
//   title: '生成AIニュース - 最新トレンドと情報',
//   description: 'ChatGPT, Gemini, Claudeなどの生成AIに関する最新ニュース、技術動向、活用事例をお届けします。',
// };

const ITEMS_PER_PAGE = 6;

export default function NewsPage() {
  // 状態管理
  const [allNewsItems, setAllNewsItems] = useState<NewsItem[]>([]);
  const [featuredNews, setFeaturedNews] = useState<NewsItem[]>([]); // 注目の記事状態を追加
  const [filteredNews, setFilteredNews] = useState<NewsItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('すべて');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFeatured, setIsLoadingFeatured] = useState(true); // 注目の記事ローディング状態
  const [currentSort, setCurrentSort] = useState<SortOption>('newest'); // ソート状態を追加

  // 初期データ取得
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      setIsLoadingFeatured(true);
      try {
        const [news, featured] = await Promise.all([
          getAllNews(currentSort), 
          getFeaturedNews(4) // 右カラム用に4件取得
        ]);
        setAllNewsItems(news);
        setFilteredNews(news);
        setFeaturedNews(featured);
        setCurrentPage(1);
      } catch (error) {
        console.error('ニュースデータの取得中にエラーが発生しました:', error);
        // エラー時はモックデータを使用
        const mockNews = await getAllNews(currentSort);
        setAllNewsItems(mockNews);
        setFilteredNews(mockNews);
        setFeaturedNews(mockNews.slice(0, 4));
      } finally {
        setIsLoading(false);
        setIsLoadingFeatured(false);
      }
    };
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 検索、カテゴリフィルタリング、ソート
  useEffect(() => {
    let results = [...allNewsItems]; 
    results = filterNewsByCategory(results, activeCategory);
    results = searchNews(results, searchTerm);
    results = sortNews(results, currentSort); 
    setFilteredNews(results);
    setCurrentPage(1); 
  }, [searchTerm, activeCategory, currentSort, allNewsItems]);

  // 現在のページに表示するニュースを計算
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentNews = filteredNews.slice(startIndex, endIndex);

  // 総ページ数を計算
  const totalPages = Math.ceil(filteredNews.length / ITEMS_PER_PAGE);

  // ページ変更ハンドラー
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // 左カラムの上部にスクロールするなど、挙動を調整しても良い
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ソート変更ハンドラー
  const handleSortChange = (sortOption: SortOption) => {
    setCurrentSort(sortOption);
  };

  // シングルカラムレイアウト
  return (
    <main className="container mx-auto px-4 py-8 max-w-7xl">
      {/* 上部コントロール（検索とソート） */} 
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-grow">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="ニュースを検索..."
            className="pl-9 pr-4 py-2 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {/* 記事生成ページへのリンクボタン */}
        <Link href="/admin/news-generator" passHref>
          <Button variant="outline" className="w-full md:w-auto flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            <span>記事を生成</span>
          </Button>
        </Link>
        
        <SortSelector 
          currentSort={currentSort}
          onSortChange={handleSortChange}
          className="w-full md:w-40"
        />
      </div>

      {/* カテゴリータブ */} 
      <Tabs defaultValue="すべて" value={activeCategory} onValueChange={setActiveCategory} className="mb-8">
        <TabsList className="flex border-b border-gray-200 dark:border-gray-700 mb-6 p-0 bg-transparent overflow-x-auto">
          {allCategories.map((category) => ( 
            <TabsTrigger
              key={category}
              value={category}
              className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap mr-4 last:mr-0 rounded-none flex-shrink-0 border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              style={{boxShadow: 'none'}}
            >
              {category}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* 2カラムレイアウト (lg以上) をタブコンテンツ内に配置 */} 
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
          
          {/* 左カラム (ニュース一覧とページネーション - 7割) */} 
          <div className="lg:col-span-7">
            {isLoading ? (
              <div className="flex justify-center items-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            ) : (
              <TabsContent value={activeCategory} className="mt-0 focus:outline-none">
                {currentNews.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {currentNews.map((newsItem) => (
                      <NewsCard key={newsItem.id} newsItem={newsItem} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                    <p>
                      該当するニュースが見つかりませんでした。
                    </p>
                  </div>
                )}
              </TabsContent>
            )}
            
            {/* ページネーション */} 
            {!isLoading && totalPages > 1 && (
              <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                className="mt-8" // 上のコンテンツとの間にマージン
              />
            )}
          </div>

          {/* 右カラム (注目の記事 - 3割) */} 
          <aside className="lg:col-span-3 lg:sticky lg:top-20 h-fit">
            {isLoadingFeatured ? (
              <div className="h-60 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <FeaturedNewsSection featuredNews={featuredNews} />
            )}
          </aside>

        </div> 
        {/* --- 2カラムレイアウトここまで --- */}
      </Tabs>
    </main>
  );
} 