/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:3005', '127.0.0.1:60428', '127.0.0.1:54548'],
      bodySizeLimit: '2mb',
    },
  },
  images: {
    domains: ['avatar.vercel.sh'],
  },
  webpack: (config, { isServer }) => {
    // クライアントサイドビルドの場合のみ適用
    if (!isServer) {
      // fsモジュールを使用するパッケージをクライアントバンドルから除外
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
}

export default nextConfig
