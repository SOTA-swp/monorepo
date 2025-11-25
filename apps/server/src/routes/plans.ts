import { FastifyInstance } from 'fastify';
import { prisma } from 'db';
import jwt from 'jsonwebtoken';

interface CreatePlanBody {
  title: string;
}

export async function planRoutes(server: FastifyInstance) {
  const JWT_SECRET = process.env.JWT_SECRET!;

  server.post<{ Body: CreatePlanBody }>('/api/plans', async (request, reply) => {
    try {
      const token = request.cookies.token;
      if (!token) return reply.status(401).send({ message: 'ログインしてください' });
      
      const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
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
}