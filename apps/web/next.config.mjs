/** @type {import('next').NextConfig} */
const nextConfig = {
  // 開発モード（pnpm dev）の時だけ、
  // /api/ へのリクエストを localhost:4000 に転送(プロキシ)する
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*',
      },
    ];
  },
};

export default nextConfig;