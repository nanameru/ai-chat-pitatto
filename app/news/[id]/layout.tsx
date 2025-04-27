import type { Metadata } from 'next';

// メタデータはページコンポーネントで動的に設定する方が良い場合が多い
// export const metadata: Metadata = {
//   title: '記事詳細 - 生成AIニュース',
//   description: '生成AIに関する最新ニュースの詳細情報',
// };

export default function NewsDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ヘッダー/フッターは親レイアウトで描画
  // ここでは詳細ページのコンテンツ幅を制御するコンテナを追加
  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      {children}
    </main>
  );
} 