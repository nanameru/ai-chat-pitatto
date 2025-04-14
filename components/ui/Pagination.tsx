'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from './button'; // Assuming button exists in the same directory
import { cn } from '@/lib/utils'; // Assuming cn utility exists

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange,
  className 
}: PaginationProps) {
  if (totalPages <= 1) {
    return null; // ページが1つ以下の場合は何も表示しない
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  // 表示するページ番号の計算（例：現在のページ前後2つを表示）
  const getPageNumbers = () => {
    const delta = 2;
    const range = [];
    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      range.unshift('...');
    }
    if (currentPage + delta < totalPages - 1) {
      range.push('...');
    }

    range.unshift(1);
    if (totalPages > 1) {
      range.push(totalPages);
    }
    
    // 重複する'...'を削除（稀なケースに対応）
    return range.filter((item, index, arr) => item !== '...' || arr[index - 1] !== '...');
  };

  const pageNumbers = getPageNumbers();

  return (
    <nav 
      aria-label="Pagination"
      className={cn("flex items-center justify-center gap-2 mt-8", className)}
    >
      <Button 
        variant="outline"
        size="icon"
        onClick={handlePrevious}
        disabled={currentPage === 1}
        aria-label="前のページへ"
        className="h-8 w-8 p-0"
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </Button>

      {pageNumbers.map((pageNumber, index) => 
        typeof pageNumber === 'number' ? (
          <Button
            key={pageNumber}
            variant={currentPage === pageNumber ? 'default' : 'outline'}
            size="icon"
            onClick={() => onPageChange(pageNumber)}
            aria-current={currentPage === pageNumber ? 'page' : undefined}
            className="h-8 w-8 p-0"
          >
            {pageNumber}
          </Button>
        ) : (
          <span key={`ellipsis-${index}`} className="flex items-center justify-center h-8 w-8 text-gray-500">
            ...
          </span>
        )
      )}

      <Button 
        variant="outline"
        size="icon"
        onClick={handleNext}
        disabled={currentPage === totalPages}
        aria-label="次のページへ"
        className="h-8 w-8 p-0"
      >
        <ChevronRightIcon className="h-4 w-4" />
      </Button>
    </nav>
  );
} 