'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"; // Assuming select components exist

// ソートオプションの型と定義
export type SortOption = 'newest' | 'oldest';

interface SortSelectorProps {
  currentSort: SortOption;
  onSortChange: (sortOption: SortOption) => void;
  className?: string;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: '新着順' },
  { value: 'oldest', label: '古い順' },
];

export default function SortSelector({
  currentSort,
  onSortChange,
  className,
}: SortSelectorProps) {
  return (
    <Select 
      value={currentSort} 
      onValueChange={(value: SortOption) => onSortChange(value)}
    >
      <SelectTrigger className={className} aria-label="並び替え">
        <SelectValue placeholder="並び替え" />
      </SelectTrigger>
      <SelectContent>
        {sortOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
} 