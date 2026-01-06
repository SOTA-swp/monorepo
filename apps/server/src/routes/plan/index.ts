import { FastifyInstance } from 'fastify';
import { prisma } from 'db';
import jwt from 'jsonwebtoken';

import { authService } from '../../services/authService';
import { planService } from '../../services/planService';

import { ApiRoutes } from '../../../../../packages/api-contract/src';

import { requireAuth } from '../../lib/auth';

interface CreatePlanBody {
  title: string;
}

interface InviteMemberBody {
  email: string;
}

interface PlanParams {
  planId: string;
}

export async function planRoutes(server: FastifyInstance) {

  const getUserId = async (req: any) => {
    const token = req.cookies.token;
    if (!token) throw new Error('NO_TOKEN');
    const user = await authService.verifyToken(token);
    if (!user) throw new Error('INVALID_TOKEN');
    return user.id;
  };

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

        const newPlan = await planService.createPlan(userId, title);

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
    '/api/plans/:planId/invitations',
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
          case 'ALREADY_MEMBER':
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

}