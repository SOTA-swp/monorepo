import { FastifyInstance } from 'fastify';
import { prisma } from 'db';
import jwt from 'jsonwebtoken';

import { authService } from '../../services/authService';
import { planService } from '../../services/planService';

import { ApiRoutes } from '../../../../../packages/api-contract/src';

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

  //Plan作成----------------------------------------------------------------
  server.post<{ Body: CreatePlanBody }>('/api/plans', async (request, reply) => {
    try {
      const userId = await getUserId(request);

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

  // メンバー招待 API: POST /api/plans/:planId/members----------------------------------------------------------------
  server.post<{ Params: PlanParams; Body: InviteMemberBody }>(
    ApiRoutes.plan.edit(":planId"),
    async (request, reply) => {
      try {
        const currentUserId = await getUserId(request);

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

  server.post<{ Params: { invitationId: string }; Body: { accept: boolean } }>(
    ApiRoutes.invitation.respond(":invitationId"),
    async (request, reply) => {
      try {
        const currentUserId = await getUserId(request);
        
        // URLパラメータは文字列で来るので数値に変換
        const invitationId = Number(request.params.invitationId);
        const { accept } = request.body;

        if (isNaN(invitationId)) {
          return reply.status(400).send({ message: '無効な招待IDです' });
        }
        if (typeof accept !== 'boolean') {
          return reply.status(400).send({ message: '回答(accept)は必須です' });
        }

        const result = await planService.respondToInvitation(currentUserId, invitationId, accept);

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
}