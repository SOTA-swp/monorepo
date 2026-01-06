import { prisma } from 'db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new Error('JWT_SECRET is missing');

export const authService = {
  async register(username: string, email: string, password: string) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('USER_ALREADY_EXISTS');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: { username, email, password: hashedPassword },
    });

    return {
      username: newUser.username,
      id: newUser.id,
      email: newUser.email,
      createdAt: newUser.createdAt
    };
  },

  async updateUser(userId: string, data: { username?: string; email?: string }) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        username: data.username,
        email: data.email,
      },
    });
  },

  async getUserPublicProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      // ★重要: パスワードやEmailを含めないよう、必要な項目だけをtrueにする
      select: {
        id: true,
        username: true,
        // 将来的に avatarUrl や bio (自己紹介) が増えたらここに追加
        // createdAt: true, // 登録日を表示したい場合はtrue
      },
    });

    return user;
  },

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1d' });

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
      token,
    };
  },

  async getMyNotifications(userId: string) {
    // 1. お掃除: 「3日以上前の」かつ「既読の」いいね通知は削除
    // (招待通知は重要なのですぐには消しません)
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

    // 2. データ取得
    const notifications = await prisma.notification.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' }, // 新しい順
      include: {
        // 通知の「元」になった人の情報（名前やアイコン用）
        triggerUser: {
          select: { id: true, username: true, email: true }
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

  async markAsRead(notificationIds: string[]) {
    await prisma.notification.updateMany({
      where: { id: { in: notificationIds } },
      data: { isRead: true },
    });
  },

  async respondToInvitation(userId: string, invitationId: number, accept: boolean) {
    return prisma.$transaction(async (tx) => {

      //招待状の存在確認
      const invitation = await tx.invitation.findUnique({
        where: { id: invitationId },
      });

      if (!invitation) {
        throw new Error('INVITATION_NOT_FOUND');
      }

      //本人確認（他人の招待に勝手に答えてはいけない）
      if (invitation.inviteeId !== userId) {
        throw new Error('FORBIDDEN_NOT_INVITEE');
      }

      //承諾の場合の処理
      if (accept) {
        // 念のため、既にメンバーになっていないか最終確認
        const existingMember = await tx.planMember.findUnique({
          where: {
            userId_planId: {
              userId: userId,
              planId: invitation.planId,
            },
          },
        });

        if (!existingMember) {
          // メンバーに追加 (権限は一旦 VIEWER か EDITOR か要件次第。ここではEDITOR)
          await tx.planMember.create({
            data: {
              userId: userId,
              planId: invitation.planId,
              role: 'EDITOR',
            },
          });
        }
      }

      // 招待状を削除
      await tx.invitation.delete({
        where: { id: invitationId },
      });

      return {
        success: true,
        action: accept ? 'ACCEPTED' : 'DECLINED',
        planId: invitation.planId
      };
    });
  },

  //ユーザーIdから計画一覧を取得
  async getPlansByOwner(targetUserId: string) {

    const userExists = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!userExists) {
      throw new Error('USER_NOT_FOUND');
    }

    const plans = await prisma.plan.findMany({
      where: {
        creatorId: targetUserId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        _count: { select: { members: true } }
      }
    });
    return plans;
  },

  //自分が参加中の計画一覧を取得
  async getMyParticipatingPlans(myUserId: string) {
    try {
      const plans = await prisma.plan.findMany({
        where: {
          OR: [
            { creatorId: myUserId }, // 自分が作った
            {
              members: {
                some: { userId: myUserId } // 自分がメンバーに含まれている
              }
            }
          ]
        },
        orderBy: { createdAt: 'desc' }, // 最近更新された順が見やすい
        include: {
          creator: { select: { username: true } }, // 誰主催かわかるように
          _count: { select: { members: true } }
        }
      });
      return plans;
    } catch (error) {
      throw error;
    }
  },

  async verifyToken(token: string) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, username: true, email: true, createdAt: true },
      });
      return user;
    } catch {
      return null;
    }
  }
};