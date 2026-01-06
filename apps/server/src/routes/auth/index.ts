import { FastifyInstance } from "fastify";
import { authService } from "../../services/authService";
import { ApiRoutes } from "../../../../../packages/api-contract/src";

export async function authRoutes(server: FastifyInstance) {

  server.get('/', async () => ({ hello: 'world' }));
  server.get('/api/hello', async () => ({ message: 'バックエンドからの応答です！' }));

  //会員登録----------------------------------------------------------------
  server.post(ApiRoutes.auth.register, async (request, reply) => {
    try {
      const { username, email, password } = request.body as any;
      console.log(username, email, password);
      if (!username || !email || !password) return reply.status(400).send({ message: 'ユーザーネーム または Email または password がありません' });

      const newUser = await authService.register(username, email, password);
      return reply.status(201).send(newUser);

    } catch (error: any) {
      if (error.message === 'USER_ALREADY_EXISTS') {
        return reply.status(409).send({ message: 'そのEmailは既に使用されています' });
      }
      server.log.error(error);
      return reply.status(500).send({ message: 'サーバー内部でエラー発生' });
    }
  });

  //ログイン----------------------------------------------------------------
  server.post(ApiRoutes.auth.login, async (request, reply) => {
    try {
      const { email, password } = request.body as any;
      if (!email || !password) return reply.status(400).send({ message: 'Email または password がありません' });

      const { user, token } = await authService.login(email, password);

      reply.setCookie('token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
      });

      return reply.status(200).send(user);

    } catch (error: any) {
      if (error.message === 'INVALID_CREDENTIALS') {
        return reply.status(401).send({ message: 'Emailまたはパスワードが違います' });
      }
      server.log.error(error);
      return reply.status(500).send({ message: 'サーバー内部でエラーが発生' });
    }
  });


  //ユーザー情報取得----------------------------------------------------------------
  server.get(ApiRoutes.auth.me, async (request, reply) => {
    try {
      const token = request.cookies.token;
      if (!token) return reply.status(401).send({ message: '認証されていません' });

      const user = await authService.verifyToken(token);
      if (!user) return reply.status(401).send({ message: '認証エラー' });

      return reply.status(200).send(user);

    } catch (error) {
      server.log.warn(error);
      return reply.status(401).send({ message: '認証エラー' });
    }
  });

  server.put(ApiRoutes.auth.me, async (request, reply) => {
    try {
      const token = request.cookies.token;
      if (!token) return reply.status(401).send({ message: '認証されていません' });
      const currentUser = await authService.verifyToken(token);
      if (!currentUser) return reply.status(401).send({ message: '認証エラー' });

      const { username, email } = request.body as any;

      if (!username && !email) {
        return reply.status(400).send({ message: '変更するデータがありません' });
      }

      const updatedUser = await authService.updateUser(currentUser.id, { username, email });

      return reply.status(200).send(updatedUser);

    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ message: 'サーバー内部でエラー発生' });
    }
  });

  server.get('/api/me/notifications', async (request, reply) => {
    try {
      const token = request.cookies.token;
      if (!token) return reply.status(401).send({ message: '認証されていません' });
      const user = await authService.verifyToken(token);
      if (!user) return reply.status(401).send({ message: '認証エラー' });
      const notifications = await authService.getMyNotifications(user.id);
      
      return reply.status(200).send(notifications);
    } catch (error: any) {
      // エラーハンドリング（省略）
      if (error.message === 'NO_TOKEN' || error.message === 'INVALID_TOKEN') {
        return reply.status(401).send({ message: 'ログインしてください' });
      }
      server.log.error(error);
      return reply.status(500).send({ message: '通知の取得に失敗しました' });
    }
  });

  server.put<{ Body: { ids: string[] } }>('/api/me/notifications/read', async (request, reply) => {
    try {
      const token = request.cookies.token;
      if (!token) return reply.status(401).send({ message: '認証されていません' });
      const user = await authService.verifyToken(token);
      if (!user) return reply.status(401).send({ message: '認証エラー' });

      const { ids } = request.body;
      if (!ids || !Array.isArray(ids)) {
        return reply.status(400).send({ message: '通知IDのリストが必要です' });
      }

      await authService.markAsRead(ids);
      return reply.status(200).send({ success: true });

    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ message: '更新に失敗しました' });
    }
  });

  server.get(ApiRoutes.auth.user(":userId"), async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };

      if (!userId) {
        return reply.status(400).send({ message: 'User ID is required' });
      }

      const user = await authService.getUserPublicProfile(userId);

      if (!user) {
        return reply.status(404).send({ message: 'User not found' });
      }

      return reply.status(200).send(user);

    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });


  //ログアウト----------------------------------------------------------------
  server.post(ApiRoutes.auth.logout, async (request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return reply.status(200).send({ message: 'ログアウト成功' });
  });
}