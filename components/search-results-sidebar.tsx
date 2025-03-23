'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// 検索結果の型定義
export interface SearchResult {
  id: string;
  title: string;
  description?: string; // オプショナルに変更
  content?: string;    // content フィールドを追加（X検索結果用）
  url: string;
  source: string;
  favicon?: string;
}

interface SearchResultsSidebarProps {
  isOpen?: boolean;
  onClose: () => void;
  searchQuery?: string;
  query?: string; // Chatコンポーネントから渡されるクエリパラメータ
  results?: SearchResult[];
}

export function SearchResultsSidebar({
  isOpen = true,
  onClose,
  searchQuery = '',
  query = '',
  results = []
}: SearchResultsSidebarProps) {
  // queryが指定されていればそちらを優先して使用
  const displayQuery = query || searchQuery;
  // モバイル対応のためのstate
  const [isMobile, setIsMobile] = useState(false);

  // サンプルの検索結果（実際にはAPIから取得）
  const [searchResults, setSearchResults] = useState<SearchResult[]>([
    {
      id: '1',
      title: '生成AI活用の最前線！今フォローすべきインフルエンサー14人 - Salesforceブログ',
      description: '昨今、目覚ましい進化を遂げる「AI（人工知能）」。最近では「GPT-4o」や「Claude3」だけでなく、新しい大規模言語モデルも増えてきて、性能差などを見比べることができるほど市場が安定してきました。',
      url: 'https://salesforce.com',
      source: 'salesforce.com'
    },
    {
      id: '2',
      title: '【2024年最新】影響力の大きいX(旧Twitter)のインフルエンサー一覧',
      description: '国内No.1の広告媒体資料・マーケティング資料のポータルサイト。ダウンロード会員様ログイン',
      url: 'https://media-radar.jp',
      source: 'media-radar.jp'
    },
    {
      id: '3',
      title: '最先端のマーケティング手法！生成AIインフルエンサーとその活用法 - SCデジタル株式会社',
      description: 'コンサルティング・Salesforce導入・活用支援',
      url: 'https://scdigital.co.jp',
      source: 'scdigital.co.jp'
    },
    {
      id: '4',
      title: '【X（旧Twitter）】食品関連企業が実施したインフルエンサータイアップ成功事例5選',
      description: 'Instagramで新規リーチが取れる「リール」の使い方完全ガイド」を無料配布中！ ▶▶今すぐダウンロードする◀◀',
      url: 'https://find-model.jp',
      source: 'find-model.jp'
    },
    {
      id: '5',
      title: '人間のモデルにはうんざり？スペインのエージェンシー、月に160万円稼ぐ「AIインフルエンサー」を作る',
      description: 'Sawdah Bhaimiya（原文）（翻訳、編集：山口佳美） · Nov 29, 2023, 7:00 PM',
      url: 'https://businessinsider.jp',
      source: 'businessinsider.jp'
    }
  ]);

  // ウィンドウサイズの変更を監視
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  // サイドバーが閉じられている場合は何も表示しない
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l bg-background shadow-lg transition-all duration-300 ease-in-out',
        isMobile ? 'w-full' : 'w-80'
      )}
    >
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h2 className="text-lg font-semibold">Search Results</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="size-8 rounded-full"
          aria-label="Close search results"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {searchQuery && (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              Results for: <span className="font-medium text-foreground">{searchQuery}</span>
            </p>
          </div>
        )}

        <div className="space-y-4">
          {searchResults.map((result) => (
            <SearchResultItem key={result.id} result={result} />
          ))}
        </div>
      </div>
    </div>
  );
}

// 検索結果アイテムコンポーネント
function SearchResultItem({ result }: { result: SearchResult }) {
  // description または content のどちらかを表示（description を優先）
  const displayText = result.description || result.content || '';
  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start gap-2">
        {result.favicon ? (
          <Image
            src={result.favicon}
            alt={`${result.source} favicon`}
            width={16}
            height={16}
            className="mt-1 size-4"
          />
        ) : (
          <div className="mt-1 size-4 rounded-full bg-primary/10 text-[8px] text-primary flex items-center justify-center">
            {result.source.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium hover:underline"
          >
            {result.title}
          </a>
          <p className="mt-1 text-xs text-muted-foreground">{displayText}</p>
          <div className="mt-2 flex items-center text-xs text-muted-foreground">
            <span>{result.source}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
