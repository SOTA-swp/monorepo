import { FastifyInstance } from 'fastify';
import { authService } from '../../services/authService';
import { planService } from '../../services/planService';
import { ApiRoutes } from '../../../../../packages/api-contract/src';
import { requireAuth } from '../../lib/auth';

export async function planProfileRoutes(server: FastifyInstance) {

  //計画情報の取得  /api/plans/:planId GET
  server.get<{ Params: { planId: string } }>(
    ApiRoutes.plan.edit(":planId"),
    async (request, reply) => {
      try {
        const { planId } = request.params;

        // Service呼び出し
        const plan = await planService.getPlanDetail(planId);

        if (!plan) {
          return reply.status(404).send({ message: '計画が見つかりません' });
        }

        // ▼ もし「非公開の計画は、メンバー以外に見せたくない」場合はここでチェック
        // if (!plan.isPublic) {
        //    ここでCookieからuserIdを取り出し、メンバーかどうか確認する処理が必要
        //    メンバーでなければ return reply.status(403).send(...)
        // }

        return reply.status(200).send(plan);

      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({ message: '計画情報の取得に失敗しました' });
      }
    }
  );

  //計画削除 /api/plans/:planId DELETE
  server.delete<{ Params: { planId: string } }>(
    ApiRoutes.plan.edit(":planId"),
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const { planId } = request.params;
        const userId = request.user.id;

        await planService.deletePlan(userId, planId);
        return reply.status(200).send({ message: '削除しました' });

      } catch (error: any) {
        if (error.message === 'PLAN_NOT_FOUND') return reply.status(404).send({ message: '計画が見つかりません' });
        if (error.message === 'FORBIDDEN_NOT_OWNER') return reply.status(403).send({ message: '削除権限がありません' });
        return reply.status(500).send({ message: '削除に失敗しました' });
      }
    }
  );

  //計画の基本情報の編集 /api/plans/:planId PATCH
  server.patch<{ Params: { planId: string }; Body: { title?: string; description?: string, isPublic?: boolean } }>(
    ApiRoutes.plan.edit(":planId"),
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const { planId } = request.params;
        const userId = request.user.id;
        const updateData = request.body;

        const result = await planService.updatePlan(userId, planId, updateData);
        return reply.status(200).send(result);

      } catch (error: any) {
        if (error.message === 'PLAN_NOT_FOUND') return reply.status(404).send({ message: '計画が見つかりません' });
        if (error.message === 'FORBIDDEN_NOT_OWNER') return reply.status(403).send({ message: '編集権限がありません' });
        return reply.status(500).send({ message: '更新に失敗しました' });
      }
    }
  );

  //計画のいいね数と自分がいいねしてるかを取得  /api/plans/:planId/like-status GET
  server.get<{ Params: { planId: string } }>(
    ApiRoutes.like.likestate(":planId"),
    async (request, reply) => {
      try {
        const { planId } = request.params;
        let userId: string | null = null;

        const token = request.cookies.token;

        if (token) {
          const user = await authService.verifyToken(token);
          if (user) {
            userId = user.id;
          }
        }

        const countPromise = planService.getLikeCount(planId);

        const hasLikedPromise = userId
          ? planService.hasUserLiked(userId, planId)
          : Promise.resolve(false);

        const [count, hasLiked] = await Promise.all([
          countPromise,
          hasLikedPromise
        ]);

        return reply.status(200).send({
          count: count,
          hasLiked: hasLiked
        });

      } catch (error: any) {
        if (error.message === 'PLAN_NOT_FOUND') {
          return reply.status(404).send({ message: 'プランが見つかりません' });
        }
        server.log.error(error);
        return reply.status(500).send({ message: '取得に失敗しました' });
      }
    }
  );

  //計画のメンバー情報を取得. /api/plans/:planId/members GET
  server.get<{ Params: { planId: string } }>(
    ApiRoutes.plan.members(":planId"),
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const { planId } = request.params;

        const result = await planService.getPlanMembers(planId);

        return reply.status(200).send(result);

      } catch (error: any) {
        if (error.message === 'PLAN_NOT_FOUND') {
          return reply.status(404).send({ message: '計画が見つかりません' });
        }
        server.log.error(error);
        return reply.status(500).send({ message: 'メンバー情報の取得に失敗しました' });
      }
    }
  );

}