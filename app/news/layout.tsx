import type { Metadata } from 'next';
import Link from 'next/link';
import { HomeIcon, NewspaperIcon } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pitatto News - 生成AIニュース',
  description: 'ChatGPT, Gemini, Claudeなどの生成AIに関する最新ニュース、技術動向、活用事例をお届けします。',
};

export default function NewsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      <header className="py-4 px-4 sm:px-6 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto max-w-7xl flex justify-between items-center">
          <Link href="/news" className="flex items-center">
            <NewspaperIcon className="h-6 w-6 text-gray-600 dark:text-gray-400 mr-2" />
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white">Pitatto News</h1>
          </Link>
          <Link href="/" className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center">
            <HomeIcon className="h-4 w-4 mr-1" />
            <span>ホーム</span>
          </Link>
        </div>
      </header>

      {children}

      <footer className="mt-16 py-8 border-t border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 max-w-7xl text-center">
          <p className="text-gray-500 dark:text-gray-400 text-xs">
            © 2024 Pitatto News. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
} 