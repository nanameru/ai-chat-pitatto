import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { News } from '@/types/news';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

export function FeaturedNewsSection({ featuredNews }: { featuredNews: News[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold mb-4">注目の記事</h2>
      <div className="space-y-4">
        {featuredNews.map((news) => (
          <Card key={news.id}>
            <CardHeader className="p-4">
              <CardTitle className="text-base font-medium">
                <Link href={`/news/${news.id}`} className="hover:underline">
                  {news.title}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
              公開日: {format(new Date(news.publishedAt), 'yyyy年M月d日', { locale: ja })}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6 text-center">
        <Button asChild variant="outline">
          <Link href="/news">もっと見る</Link>
        </Button>
      </div>
    </div>
  );
} 