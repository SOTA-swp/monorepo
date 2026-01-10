import { FastifyInstance } from "fastify";
import { authService } from "../../services/authService";
import { userService } from "../../services/userService";
import { planService } from "../../services/planService";
import { ApiRoutes } from "../../../../../packages/api-contract/src";
import { requireAuth } from "../../lib/auth";

interface SearchQuery {
  sort?: 'popular' | 'newest';
  page?: number;
  limit?: number;
  q?: string;
}

interface CreatePlanBody {
  title: string;
  description?: string;
}

interface InviteMemberBody {
  email: string;
}

interface PlanParams {
  planId: string;
}



export async function userActivityRoutes(server: FastifyInstance) {

  //Plan作成 /api/plans POST
  server.post<{ Body: CreatePlanBody }>(ApiRoutes.plan.create,
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      try {
        const userId = request.user.id

        const { title } = request.body;
        if (!title) return reply.status(400).send({ message: 'タイトルは必須です' });

        let { description } = request.body;
        if (!description) description = "";

        const newPlan = await userService.createPlan(userId, title, description);

        server.log.info(`計画作成成功: ID ${newPlan.id} by User ${userId}`);
        return reply.status(201).send(newPlan);

      } catch (error: any) {
        if (error.message === 'NO_TOKEN' || error.message === 'INVALID_TOKEN') {
          return reply.status(401).send({ message: 'ログインしてください' });
        }
        server.log.error(error);
        return reply.status(500).send({ message: '計画の作成に失敗しました' });
      }
    });

  //計画をインポート  /api/plans/:planId/import POST
  server.post<{ Params: { planId: string } }>(
    '/api/plans/:planId/import',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const { planId } = request.params;
        const user = (request as any).user;

        const newPlan = await userService.importPlan(planId, user.id);

        return reply.status(201).send(newPlan);

      } catch (error: any) {
        if (error.message === 'PLAN_NOT_FOUND') {
          return reply.status(404).send({ message: '計画が見つかりません' });
        }
        if (error.message === 'PLAN_IS_PRIVATE') {
          return reply.status(403).send({ message: 'この計画は非公開のためインポートできません' });
        }

        server.log.error(error);
        return reply.status(500).send({ message: 'インポートに失敗しました' });
      }
    }
  );

  //計画の検索API /api/plans?sort=popular&page=1&limit=20 GET
  server.get<{ Querystring: SearchQuery }>(
    ApiRoutes.plan.create,
    async (request, reply) => {
      try {
        const sort = request.query.sort || 'newest';
        const page = Math.max(1, Number(request.query.page) || 1);
        const limit = Math.max(1, Math.min(50, Number(request.query.limit) || 10));
        const query = request.query.q;

        let currentUserId: string | undefined;
        const token = request.cookies.token;

        if (token) {
          // トークンがあれば検証してIDを取り出す (失敗しても単にゲスト扱いにするためエラーにはしない)
          const user = await authService.verifyToken(token);
          if (user) {
            currentUserId = user.id;
          }
        }

        const result = await userService.searchPlans({ sort, page, limit, query, currentUserId });

        return reply.status(200).send(result);

      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({ message: '計画の取得に失敗しました' });
      }
    }
  );



  // メンバー招待 /api/plans/:planId/invitations POST
  server.post<{ Params: PlanParams; Body: InviteMemberBody }>(
    ApiRoutes.invitation.invitation(":planId"),
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      try {
        const currentUserId = request.user.id;

        const { planId } = request.params;
        const { email: targetEmail } = request.body;

        if (!targetEmail) {
          return reply.status(400).send({ message: '招待するメールアドレスは必須です' });
        }

        const newMember = await userService.sendInvitation(currentUserId, planId, targetEmail);

        server.log.info(`招待成功: Plan ${planId} <- ${targetEmail}`);
        return reply.status(201).send(newMember);

      } catch (error: any) {
        // エラーハンドリングの分岐
        switch (error.message) {
          case 'NO_TOKEN':
          case 'INVALID_TOKEN':
            return reply.status(401).send({ message: 'ログインしてください' });
          case 'FORBIDDEN_NOT_OWNER':
            return reply.status(403).send({ message: '招待権限がありません' });
          case 'USER_NOT_FOUND':
            return reply.status(404).send({ message: 'ユーザーが見つかりません' });
          case 'ALREADY_MEMBER':
            return reply.status(409).send({ message: '既に参加済みです' });
          default:
            server.log.error(error);
            return reply.status(500).send({ message: '招待処理に失敗しました' });
        }
      }
    }
  );

  //招待への応答 /api/invitation/:invitationId PATCH
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

        const result = await userService.respondToInvitation(currentUserId, invitationId, accept);

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



  //いいね  /api/plans/:planId/likes POST
  server.post<{ Params: { planId: string } }>(
    ApiRoutes.like.like(":planId"),
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const { planId } = request.params;
        await userService.addLike(userId, planId);
        const [count, hasLiked] = await Promise.all([
          planService.getLikeCount(planId),
          planService.hasUserLiked(userId, planId)
        ]);
        return reply.status(200).send({
          message: 'いいねしました',
          count: count,
          hasLiked: hasLiked
        });
      } catch (error: any) {
        if (error.message === 'PLAN_NOT_FOUND') return reply.status(404).send({ message: 'プランが見つかりません' });
        server.log.error(error);
        return reply.status(500).send({ message: '処理に失敗しました' });
      }
    }
  );

  // いいね解除. /api/plans/:planId/likes DELETE
  server.delete<{ Params: { planId: string } }>(
    ApiRoutes.like.like(":planId"),
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const { planId } = request.params;
        await userService.removeLike(userId, planId);
        const [count, hasLiked] = await Promise.all([
          planService.getLikeCount(planId),
          planService.hasUserLiked(userId, planId)
        ]);
        return reply.status(200).send({
          message: 'いいねを解除しました',
          count: count,
          hasLiked: hasLiked
        });
      } catch (error: any) {
        if (error.message === 'PLAN_NOT_FOUND') return reply.status(404).send({ message: 'プランが見つかりません' });
        server.log.error(error);
        return reply.status(500).send({ message: '処理に失敗しました' });
      }
    }
  );

}