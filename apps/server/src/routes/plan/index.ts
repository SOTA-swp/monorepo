import { FastifyInstance } from 'fastify';
import { prisma } from 'db';
import jwt from 'jsonwebtoken';

import { authService } from '../../services/authService';
import { planService } from '../../services/planService';

import { ApiRoutes } from '../../../../../packages/api-contract/src';

import { requireAuth } from '../../lib/auth';

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

interface SearchQuery {
  sort?: 'popular' | 'newest';
  page?: number;
  limit?: number;
}

export async function planRoutes(server: FastifyInstance) {

  //Plan作成 /api/plans
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

        const newPlan = await planService.createPlan(userId, title, description);

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

  // メンバー招待 /api/plans/:planId/invitations
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

        const newMember = await planService.sendInvitation(currentUserId, planId, targetEmail);

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
          case 'ALREADY_INVITED':
            return reply.status(409).send({ message: '既に参加済みです' });
          default:
            server.log.error(error);
            return reply.status(500).send({ message: '招待処理に失敗しました' });
        }
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
  server.patch<{ Params: { planId: string }; Body: { title?: string; description?: string } }>(
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

  //いいね
  server.post<{ Params: { planId: string } }>(
    ApiRoutes.like.like(":planId"),
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const { planId } = request.params;
        await planService.addLike(userId, planId);
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

  // いいね解除
  server.delete<{ Params: { planId: string } }>(
    ApiRoutes.like.like(":planId"),
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const { planId } = request.params;
        await planService.removeLike(userId, planId);
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

  //計画のいいね数と自分がいいねしてるかを取得
  server.get<{ Params: { planId: string } }>(
    ApiRoutes.like.likestate(":planId"),
    async (request, reply) => {
      try {
        const { planId } = request.params;
        let userId: string | null = null;

        const token = request.cookies.token;

        if (token) {
          // トークンがある場合だけ検証を試みる
          // (authService.verifyToken は検証失敗時に null を返すと仮定)
          const user = await authService.verifyToken(token);
          if (user) {
            userId = user.id;
          }
        }

        const countPromise = planService.getLikeCount(planId);

        const hasLikedPromise = userId
          ? planService.hasUserLiked(userId, planId)
          : Promise.resolve(false);

        // 3. 並列実行
        const [count, hasLiked] = await Promise.all([
          countPromise,
          hasLikedPromise
        ]);

        // 1. プランの存在確認 (countのエラーハンドリングをここで行う)
        // サービス層の getLikeCount にプラン存在確認ロジックを入れた場合は
        // ここで try-catch するだけでOKですが、念の為ここでも書くなら：
        // await planService.ensurePlanExists(planId); 

        // 2. 並列実行して高速化 (Promise.all)
        // 数と状態を同時にDBに問い合わせます

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


  //計画の検索API /api/plans?sort=popular&page=1&limit=20
  server.get<{ Querystring: SearchQuery }>(
    ApiRoutes.plan.create,
    async (request, reply) => {
      try {
        const sort = request.query.sort || 'newest';
        const page = Math.max(1, Number(request.query.page) || 1);
        const limit = Math.max(1, Math.min(50, Number(request.query.limit) || 10));

        const result = await planService.searchPlans({ sort, page, limit });

        return reply.status(200).send(result);

      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({ message: '計画の取得に失敗しました' });
      }
    }
  );



}