import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { setupYjsPersistence } from './lib/yjs/setup';
import { authRoutes } from './routes/auth';
import { planSocketRoutes } from './routes/plan/socket';
import fastifyWebsocket from '@fastify/websocket';
import { planRoutes } from './routes/plan';
import { planRouteRoutes } from './routes/plan/route';

// Yjs永続化の初期設定
setupYjsPersistence();

// サーバーインスタンス作成
const server = Fastify({
  logger: true,
});

if (!process.env.JWT_SECRET) {
  server.log.error('エラー：JWT_SECRET が設定されていません。');
  process.exit(1);
}

//サーバー起動
const start = async () => {
  try {
    await server.register(cookie);
    await server.register(cors, {
      origin: "http://localhost:3000",
      credentials: true,
    });
    
    await server.register(fastifyWebsocket);

    await server.register(authRoutes);
    await server.register(planSocketRoutes);
    await server.register(planRoutes);
    await server.register(planRouteRoutes);

    await server.listen({ port: 4000 });
    console.log('✅ Fastify server listening on http://localhost:4000');
    // デバッグ: 登録されたルートを確認
    console.log(server.printRoutes());
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
