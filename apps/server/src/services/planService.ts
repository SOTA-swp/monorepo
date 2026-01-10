import { prisma } from 'db';


export const planService = {




  //計画の情報を取得
  async getPlanDetail(planId: string) {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        title: true,
        description: true,
        isPublic: true,   // 公開設定
        creatorId: true,  // 「自分が作者か」判定用にあると便利
      }
    });

    return plan;
  },



  //計画の削除
  async deletePlan(userId: string, planId: string) {

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) throw new Error('PLAN_NOT_FOUND');

    // 2. 権限チェック (重要)
    if (plan.creatorId !== userId) {
      throw new Error('FORBIDDEN_NOT_OWNER');
    }

    // 3. 削除
    // (Prismaで onCascade 設定があればメンバーや招待も自動で消えます)
    await prisma.plan.delete({
      where: { id: planId },
    });

    return { success: true };
  },


  //計画の基本情報の編集
  async updatePlan(userId: string, planId: string, data: {
    title?: string;
    description?: string;
    isPublic?: boolean;
  }) {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });

    if (!plan) throw new Error('PLAN_NOT_FOUND');
    if (plan.creatorId !== userId) throw new Error('FORBIDDEN_NOT_OWNER');

    //更新
    const updatedPlan = await prisma.plan.update({
      where: { id: planId },
      data: {
        ...data,
      },
    });

    return updatedPlan;
  },



  //計画のいいね数を取得
  async getLikeCount(planId: string) {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: { id: true }
    });

    if (!plan) {
      throw new Error('PLAN_NOT_FOUND');
    }
    const count = await prisma.like.count({
      where: { planId }
    });
    return count;
  },

  //ユーザーがその計画にいいねしているかを取得
  async hasUserLiked(userId: string, planId: string) {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: { id: true }
    });

    if (!plan) {
      throw new Error('PLAN_NOT_FOUND');
    }

    const userExists = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      throw new Error('USER_NOT_FOUND');
    }
    const like = await prisma.like.findUnique({
      where: {
        userId_planId: { userId, planId }
      }
    });
    return !!like; // true or false
  },

  //計画に参加中のメンバーを取得
  async getPlanMembers(planId: string) {
    // 1. 計画が存在するか確認
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: { id: true }
    });

    if (!plan) {
      throw new Error('PLAN_NOT_FOUND');
    }

    // 2. 参加済みメンバーと、招待中のユーザーを並行取得
    const [members, invitations] = await prisma.$transaction([
      // A. 参加済みメンバー (PlanMember)
      prisma.planMember.findMany({
        where: { planId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
            }
          }
        }
      }),
      // B. 招待中でまだ応答していないユーザー (Invitation)
      prisma.invitation.findMany({
        where: {
          planId: planId,
          status: 'PENDING' // 'PENDING' | 'ACCEPTED' | 'DECLINED'
        },
        include: {
          invitee: { // 招待されている人
            select: {
              id: true,
              username: true,
            }
          }
        }
      })
    ]);

    // 3. データ整形
    return {
      // 参加メンバー
      active: members.map((m) => ({
        id: m.userId,
        username: m.user.username,
        role: m.role, // 'OWNER' | 'EDITOR' | 'VIEWER'
      })),
      // 招待中メンバー
      invited: invitations.map((i) => {
        // invitee が null の場合の対策
        return {
          // ユーザーID: 登録済みならID、未登録なら null
          id: i.invitee?.id ?? null,
          // 名前: 登録済みならユーザー名、未登録なら "未登録" や メールアドレス等
          username: i.invitee?.username ?? '未登録ユーザー',
          invitationId: i.id,
          invitedAt: i.createdAt
        };
      })
    };
  },


  

};