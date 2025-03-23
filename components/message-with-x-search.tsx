'use client';

import { useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface XSearchResult {
  id: string;
  title: string;
  url: string;
  content: string;
  source: string;
}

interface MessageWithXSearchProps {
  results: XSearchResult[];
  query: string;
  onShowSearchResults: (query: string) => void;
}

export function MessageWithXSearch({
  results,
  query,
  onShowSearchResults
}: MessageWithXSearchProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 検索結果のプレビュー（最初の3つのみ表示）
  const previewResults = results.slice(0, 3);

  return (
    <div className="mt-2 rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">X検索結果</h3>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full"
              onClick={() => onShowSearchResults(query)}
            >
              <Search className="size-4" />
              <span className="sr-only">検索結果を表示</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>検索結果をサイドバーで表示</TooltipContent>
        </Tooltip>
      </div>

      <div className="text-xs text-muted-foreground mb-2">
        検索クエリ: <span className="font-medium">{query}</span>
      </div>

      <div className={cn(
        "space-y-2 overflow-hidden transition-all",
        isExpanded ? "max-h-none" : "max-h-40"
      )}>
        {previewResults.map((result) => (
          <div key={result.id} className="rounded border bg-background p-2 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:underline inline-flex items-center gap-1"
                >
                  {result.title}
                  <ExternalLink className="size-3" />
                </a>
                <p className="mt-1 text-xs line-clamp-2">{result.content}</p>
              </div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {result.source}
            </div>
          </div>
        ))}
      </div>

      {results.length > 3 && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full text-xs"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? "折りたたむ" : `さらに${results.length - 3}件の結果を表示`}
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        className="mt-2 w-full text-xs"
        onClick={() => onShowSearchResults(query)}
      >
        すべての検索結果をサイドバーで表示
      </Button>
    </div>
  );
}
