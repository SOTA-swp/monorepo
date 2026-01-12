import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import { setupWSConnection } from 'y-websocket/bin/utils';
import { prisma } from 'db';
import jwt from 'jsonwebtoken';

//計画編集時のwebsocket通信
export async function planSocketRoutes(server: FastifyInstance) {
  const JWT_SECRET = process.env.JWT_SECRET!;

  server.get('/ws/plan/:planId', { websocket: true }, async (connection: SocketStream, request: FastifyRequest) => {
    // 万が一 HTTP として処理された場合のガード
    if (!connection.socket || typeof connection.socket.close !== 'function') {
      const reply = request as any as FastifyReply;
      return reply.status(400).send('このエンドポイントはWebsocket通信用です');
    }

    // URLパラメータの取得
    const params = request.params as { planId: string };
    const planId = params.planId;
    
    server.log.info(`[WS Debug] Connection attempt for PlanID: ${planId}`);
    // ヘッダーを全て出力してCookieが含まれているか確認
    server.log.info(`[WS Debug] Headers: ${JSON.stringify(request.headers)}`);

    if (!planId) {
      server.log.warn('[WS Debug] No planId provided');
      connection.socket.close(1008, '無効な計画IDです');
      return;
    }

    // Cookie または Query Parameter からトークンを取得
    let token = request.cookies.token;
    if (!token) {
      const query = request.query as { token?: string };
      token = query.token;
    }

    server.log.info(`[WS Debug] Token exists: ${!!token}`);
    let userId: string;

    if (!token) {
      server.log.warn('[WS Debug] No token found in cookies');
      //connection.socket.close(1008, '認証トークンがありません');
      return;
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      userId = payload.userId;
      server.log.info(`[WS Debug] Token verified. UserId: ${userId}`);
    } catch (error) {
      server.log.error(`[WS Debug] Token verification failed: ${error}`);
      connection.socket.close(1008, '認証トークンが無効です');
      return;
    }

    try {
      const membership = await prisma.planMember.findUnique({
        where: {
          userId_planId: { userId: userId, planId: planId}
        },
      });

      if (!membership) {
        connection.socket.close(1008, 'この計画へのアクセス権がありません');
        return;
      }

      server.log.info(`[Yjs] ユーザー(id: ${userId}) が 計画(id: ${planId}) に接続しました。`);

      // ----------------------------------------------------------------
      connection.socket.binaryType = 'nodebuffer';
      //！！！YjsとFastify間でのバイナリ形式の違いを無理やり揃える。今後これが原因となる不具合の発生可能性あり
      Object.defineProperty(connection.socket, 'binaryType', {
        get: () => 'nodebuffer',
        set: () => { },
        configurable: true,
        enumerable: true
      });
      // ----------------------------------------------------------------

      try {
        //ws接続を開始し、Yjsドキュメントの更新、保存等はsetupWSConnectionに任せる
        setupWSConnection(connection.socket, request, {
          docName: planId,
          gc: true
        });

      } catch (err) {
        server.log.error(err);
        connection.socket.close(1011, 'サーバーエラー: setupWSConnectionでエラーが発生しました');
      }

    } catch (err) {
      server.log.error(err);
      connection.socket.close(1011, 'サーバーエラー: 計画編集へのアクセスでエラーが発生しました');
    }
  });
};