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

  //ユーザー情報取得----------------------------------------------------------------
  server.get(ApiRoutes.auth.me,
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      try {
        return reply.status(200).send(request.user);
      } catch (error) {
        server.log.warn(error);
        return reply.status(401).send({ message: '認証エラー' });
      }
    });

  //ユーザー情報編集
  server.put(ApiRoutes.auth.me,
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      try {
        const currentUser = request.user;

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

  //ユーザーIDからユーザー情報を取得
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

  //通知取得
  server.get(ApiRoutes.notification.default,
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      try {
        const user = request.user;
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

  //通知を既読に変更
  server.patch<{ Body: { ids: string[], isRead: boolean } }>(ApiRoutes.notification.default,
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      try {
        const user = request.user;
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

  //招待への応答 /api/invitation/:invitationId
  server.patch<{ Params: { invitationId: string }; Body: { accept: boolean } }>(
    ApiRoutes.invitation.respond(":invitationId"),
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      try {
        const currentUserId = request.user.id

        // URLパラメータは文字列で来るので数値に変換
        const invitationId = Number(request.params.invitationId);
        const { accept } = request.body;

        if (isNaN(invitationId)) {
          return reply.status(400).send({ message: '無効な招待IDです' });
        }
        if (typeof accept !== 'boolean') {
          return reply.status(400).send({ message: '回答(accept)は必須です' });
        }

        const result = await authService.respondToInvitation(currentUserId, invitationId, accept);

        return reply.status(200).send(result);

      } catch (error: any) {
        switch (error.message) {
          case 'INVITATION_NOT_FOUND':
            return reply.status(404).send({ message: '招待状が見つからないか、既に処理されています' });
          case 'FORBIDDEN_NOT_INVITEE':
            return reply.status(403).send({ message: 'この招待に回答する権限がありません' });
          default:
            server.log.error(error);
            return reply.status(500).send({ message: '処理に失敗しました' });
        }
      }
    }
  );

  //ユーザーの作成した計画を取得
  server.get<{ Params: { userId: string } }>(
    '/api/users/:userId/plans',
    // 公開情報なら requireAuth は不要かもしれない
    // アプリの仕様として「ログインユーザーのみ閲覧可」なら付ける。今回は付ける。
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const { userId } = request.params;
        const plans = await authService.getPlansByOwner(userId);
        return reply.status(200).send(plans);
      } catch (error: any) {
        if (error.message === 'USER_NOT_FOUND') {
          return reply.status(404).send({ message: '指定されたユーザーが見つかりません' });
        }
        server.log.error(error);
        return reply.status(500).send({ message: '計画の取得に失敗しました' });
      }
    }
  );

  //自分が参加中の計画を取得
  server.get(
    ApiRoutes.auth.plans,
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
      const myUserId = request.user.id;

      const plans = await authService.getMyParticipatingPlans(myUserId);
      return reply.status(200).send(plans);
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ message: '計画一覧の取得に失敗しました' });
      }
    }
  );
}