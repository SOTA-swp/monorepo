import { FastifyInstance } from "fastify";
import { authService } from "../../services/authService";
import { ApiRoutes } from "../../../../../packages/api-contract/src";
import { requireAuth } from "../../lib/auth";

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

  //ログアウト----------------------------------------------------------------
  server.post(ApiRoutes.auth.logout, async (request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return reply.status(200).send({ message: 'ログアウト成功' });
  });

  
}