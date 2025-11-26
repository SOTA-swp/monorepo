import { FastifyInstance } from 'fastify';
import { prisma } from 'db';
import jwt from 'jsonwebtoken';

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
  const JWT_SECRET = process.env.JWT_SECRET!;

  server.post<{ Body: CreatePlanBody }>('/api/plans', async (request, reply) => {
    try {
      const token = request.cookies.token;
      if (!token) return reply.status(401).send({ message: 'ログインしてください' });
      
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      const userId = payload.userId;

      // 2. 入力チェック
      const { title } = request.body;
      if (!title) return reply.status(400).send({ message: 'タイトルは必須です' });
      const result = await prisma.$transaction(async (tx) => {
        // (A) 計画を作成
        const newPlan = await tx.plan.create({
          data: {
            title: title,
            creator: {
              connect: { id: userId }
            }
          },
        });

        // (B) 作成者をOWNERとしてメンバー登録
        await tx.planMember.create({
          data: {
            userId: userId,
            planId: newPlan.id,
            role: 'OWNER', // ここでオーナー権限を付与
          },
        });

        return newPlan; // 作成された計画を返す
      });

      server.log.info(`計画作成成功: ID ${result.id} by User ${userId}`);

      // 4. 成功レスポンス（作成された計画のIDを返す）
      return reply.status(201).send(result);

    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ message: '計画の作成に失敗しました' });
    }
  });

  // メンバー招待 API: POST /api/plans/:planId/members
  server.post<{ Params: PlanParams; Body: InviteMemberBody }>(
    '/api/plans/:planId/members',
    async (request, reply) => {
      try {
        // 1. 認証チェック
        const token = request.cookies.token;
        if (!token) return reply.status(401).send({ message: 'ログインしてください' });
        
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
        const currentUserId = payload.userId;

        const { planId } = request.params;
        const { email: targetEmail } = request.body;

        if (!targetEmail) {
          return reply.status(400).send({ message: '招待するメールアドレスは必須です' });
        }

        // 2. 権限チェック (実行者はOWNERか？)
        const membership = await prisma.planMember.findUnique({
          where: {
            userId_planId: {
              userId: currentUserId,
              planId: planId,
            },
          },
        });

        if (!membership || membership.role !== 'OWNER') {
          return reply.status(403).send({ message: '招待権限がありません（オーナーのみ可能）' });
        }

        // 3. 招待相手の検索 (Email -> UserID)
        const targetUser = await prisma.user.findUnique({
          where: { email: targetEmail },
        });

        if (!targetUser) {
          return reply.status(404).send({ message: '指定されたメールアドレスのユーザーが見つかりません' });
        }

        // 4. 重複チェック (既にメンバーか？)
        const existingMember = await prisma.planMember.findUnique({
          where: {
            userId_planId: {
              userId: targetUser.id,
              planId: planId,
            },
          },
        });

        if (existingMember) {
          return reply.status(409).send({ message: 'そのユーザーは既に参加済みです' });
        }

        // 5. 登録実行 (EDITORとして追加)
        const newMember = await prisma.planMember.create({
          data: {
            userId: targetUser.id,
            planId: planId,
            role: 'EDITOR', // デフォルトで編集者として招待
          },
          include: {
            user: { // レスポンス用にユーザー情報も含めて返す
              select: { id: true, email: true }
            }
          }
        });

        server.log.info(`招待成功: Plan ${planId} <- User ${targetUser.email} (by ${currentUserId})`);

        return reply.status(201).send(newMember);

      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({ message: '招待処理に失敗しました' });
      }
    }
  );
}