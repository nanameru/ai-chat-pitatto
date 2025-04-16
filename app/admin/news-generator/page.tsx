'use client';

import { useState, useEffect } from 'react';
import { Button } from 'components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'components/ui/card';
import { Alert, AlertDescription, AlertTitle } from 'components/ui/alert';

// スピナーコンポーネントの作成
const Spinner = () => (
  <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function NewsGeneratorPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [allNews, setAllNews] = useState<any[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(false);

  // 既存のニュース記事を取得する関数
  const fetchAllNews = async () => {
    setIsLoadingNews(true);
    try {
      const response = await fetch('/api/news');
      if (!response.ok) {
        throw new Error('ニュース記事の取得に失敗しました');
      }
      const data = await response.json();
      setAllNews(data);
    } catch (err) {
      console.error('ニュース一覧取得エラー:', err);
    } finally {
      setIsLoadingNews(false);
    }
  };

  // 初期ロード時にニュース記事を取得
  useEffect(() => {
    fetchAllNews();
  }, []);

  // 手動でニュース生成ジョブを実行
  const handleGenerateNews = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // 認証トークンを取得（実際の運用では安全な方法で管理してください）
      const authToken = process.env.NEXT_PUBLIC_CRON_SECRET || 'default-secret-token';

      const response = await fetch('/api/cron/update-news', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '処理に失敗しました');
      }

      setResult(data);
      
      // 成功したら、ニュース一覧を再取得
      if (data.success) {
        await fetchAllNews();
      }
    } catch (err) {
      setError((err as Error).message || '不明なエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">生成AIニュース自動生成管理</h1>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>ニュース生成ジョブ</CardTitle>
            <CardDescription>
              Coze APIを使用して生成AIに関する最新情報を取得し、Claude AIを使用してニュース記事を自動生成します。
              このジョブは1時間ごとに自動実行されますが、手動で実行することもできます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <h3 className="font-semibold text-lg mb-2">実行頻度</h3>
              <p className="text-sm text-gray-500">
                1時間ごとに自動実行（Vercel Cron設定: <code>0 * * * *</code>）
              </p>
              <p className="text-sm text-gray-500 mt-1">
                24時間あたり最大10記事まで生成
              </p>
            </div>
            
            <Button 
              onClick={handleGenerateNews} 
              disabled={isLoading}
              className="mb-4"
            >
              {isLoading ? (
                <>
                  <Spinner />
                  処理中...
                </>
              ) : (
                '手動で実行'
              )}
            </Button>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>エラーが発生しました</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {result && (
              <Alert variant={result.success ? "default" : "destructive"} className="mb-4">
                <AlertTitle>{result.success ? '処理成功' : 'エラー'}</AlertTitle>
                <AlertDescription>
                  {result.message}
                  {result.articles && result.articles.length > 0 && (
                    <div className="mt-2">
                      <p>生成された記事ID:</p>
                      <ul className="list-disc pl-5 mt-2">
                        {result.articles.map((id: string) => (
                          <li key={id}>
                            <a 
                              href={`/news/${id}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="underline text-blue-600 hover:text-blue-800"
                            >
                              {id} (新しいタブで開く)
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>生成されたニュース記事一覧</CardTitle>
            <CardDescription>
              最近自動生成されたニュース記事の一覧です。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingNews ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
                <span className="ml-2">ニュース記事を読み込み中...</span>
              </div>
            ) : allNews.length > 0 ? (
              <div className="border rounded-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">タイトル</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">カテゴリ</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">作成日</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">リンク</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {allNews.map((news) => (
                      <tr key={news.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 truncate max-w-xs">{news.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{news.category}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(news.publishedAt).toLocaleDateString('ja-JP')}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <a 
                            href={`/news/${news.id}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            表示
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                生成されたニュース記事はまだありません。
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 