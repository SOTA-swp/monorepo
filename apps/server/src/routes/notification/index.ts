import { FastifyInstance } from "fastify";
import { authService } from "../../services/authService"; // serviceは共有でOK
import { notificationService } from "../../services/notificationService";
import { ApiRoutes } from "../../../../../packages/api-contract/src";
import { requireAuth } from "../../lib/auth";

export async function notificationRoutes(server: FastifyInstance) {

  //通知取得. /api/me/notifications GET
  server.get(ApiRoutes.notification.default,
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      try {
        const user = request.user;
        const notifications = await notificationService.getMyNotifications(user.id);

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

  //通知を既読に変更. /api/me/notifications PATCH
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

        await notificationService.markAsRead(ids);
        return reply.status(200).send({ success: true });

      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ message: '更新に失敗しました' });
      }
    });

  //未読の通知数を取得  /api/me/notifications/unread GET
  server.get(
    ApiRoutes.notification.unread,
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const user = (request as any).user;

        const count = await notificationService.getUnreadCount(user.id);

        return reply.status(200).send({ count });
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({ message: '通知数の取得に失敗しました' });
      }
    }
  );
}