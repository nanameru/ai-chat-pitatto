'use client';

import { useState } from 'react';
import { Button } from './button';
import { CopyIcon, CheckIcon, Share2Icon } from 'lucide-react';
import { cn } from '@/lib/utils';

// X (Twitter) Icon (using SVG as lucide-react doesn't have a direct X logo)
const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    aria-hidden="true"
    {...props}
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface ShareButtonsProps {
  url: string;
  title: string;
  className?: string;
}

export default function ShareButtons({ url, title, className }: ShareButtonsProps) {
  const [isCopied, setIsCopied] = useState(false);

  const twitterShareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // 2秒後にアイコンを元に戻す
    } catch (err) {
      console.error('Failed to copy URL: ', err);
      // Optionally show an error message to the user
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-2 flex items-center">
        <Share2Icon className="h-4 w-4 mr-1"/>
        共有:
      </span>
      {/* Twitter Share Button */}
      <Button 
        variant="outline"
        size="sm"
        asChild // Use asChild to make the Button render an <a> tag
        className="flex items-center gap-1.5 px-3 py-1 h-auto"
      >
        <a href={twitterShareUrl} target="_blank" rel="noopener noreferrer">
          <XIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Xで共有</span>
        </a>
      </Button>

      {/* Copy Link Button */}
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleCopy}
        className="flex items-center gap-1.5 px-3 py-1 h-auto"
      >
        {isCopied ? (
          <CheckIcon className="h-4 w-4 text-green-600" />
        ) : (
          <CopyIcon className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">{isCopied ? 'コピー完了' : 'リンクをコピー'}</span>
      </Button>
    </div>
  );
} 