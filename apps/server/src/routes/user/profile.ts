import { FastifyInstance } from "fastify";
import { userService } from "../../services/userService";
import { authService } from "../../services/authService";
import { ApiRoutes } from "../../../../../packages/api-contract/src";
import { requireAuth } from "../../lib/auth";


export async function userProfileRoutes(server: FastifyInstance) {

  //ユーザー情報取得. /api/me GET
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

  //ユーザー情報編集. /api/me PUT
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

        const updatedUser = await userService.updateUser(currentUser.id, { username, email });

        return reply.status(200).send(updatedUser);

      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ message: 'サーバー内部でエラー発生' });
      }
    });

  //自分が参加中の計画を取得 /api/me/plans GET
  server.get(
    ApiRoutes.auth.plans,
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const myUserId = request.user.id;

        const plans = await userService.getMyParticipatingPlans(myUserId);
        return reply.status(200).send(plans);
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ message: '計画一覧の取得に失敗しました' });
      }
    }
  );

  //ユーザーIDからユーザー情報を取得. /api/users/:userId GET
  server.get(ApiRoutes.auth.user(":userId"), async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };

      if (!userId) {
        return reply.status(400).send({ message: 'User ID is required' });
      }

      const user = await userService.getUserPublicProfile(userId);

      if (!user) {
        return reply.status(404).send({ message: 'User not found' });
      }

      return reply.status(200).send(user);

    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  //ユーザーの作成した計画を取得 /api/users/:userId/plans GET
  server.get<{ Params: { userId: string } }>(
    ApiRoutes.auth.userplan(":userId"),
    async (request, reply) => {
      try {
        let viewingUserId: string | undefined;
        const token = request.cookies.token;
        if (token) {
          const user = await authService.verifyToken(token);
          if (user) viewingUserId = user.id;
        }
        const { userId } = request.params;
        const plans = await userService.getPlansByOwner(userId, viewingUserId);
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

  //任意のユーザーがいいねした計画一覧 /api/users/:userId/likes GET
  server.get<{ Params: { userId: string } }>(
    ApiRoutes.auth.userlike(":userId"),
    async (request, reply) => {
      try {
        const { userId } = request.params;

        let viewingUserId: string | undefined;
        const token = request.cookies.token;
        if (token) {
          const user = await authService.verifyToken(token);
          if (user) viewingUserId = user.id;
        }

        const plans = await userService.getLikedPlansByUser(userId, viewingUserId);

        return reply.status(200).send(plans);

      } catch (error: any) {
        if (error.message === 'USER_NOT_FOUND') {
          return reply.status(404).send({ message: '指定されたユーザーが見つかりません' });
        }
        server.log.error(error);
        return reply.status(500).send({ message: '取得に失敗しました' });
      }
    }
  );

  

}