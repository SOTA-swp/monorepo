import { prisma } from 'db';

export const notificationService = {

  //通知を取得
  async getMyNotifications(userId: string) {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    await prisma.notification.deleteMany({
      where: {
        userId: userId,
        type: 'LIKE', // 文字列指定
        isRead: true,
        createdAt: { lt: threeDaysAgo },
      },
    });

    // データ取得
    const notifications = await prisma.notification.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' }, // 新しい順
      include: {
        // 通知の「元」になった人の情報（名前やアイコン用）
        triggerUser: {
          select: { id: true, username: true }
        },
        // 関連するプランの情報（タイトル用）
        plan: {
          select: { id: true, title: true }
        },
        // 関連する招待の情報（IDやステータス用）
        invitation: {
          select: { id: true, status: true }
        }
      }
    });

    return notifications;
  },

  //通知を既読に変更
  async markAsRead(notificationIds: string[]) {
    await prisma.notification.updateMany({
      where: { id: { in: notificationIds } },
      data: { isRead: true },
    });
  },

  // 未読の通知を取得
  async getUnreadCount(userId: string) {
    const count = await prisma.notification.count({
      where: {
        userId: userId,
        isRead: false, // 未読のものだけ
      },
    });

    return count;
  },
}