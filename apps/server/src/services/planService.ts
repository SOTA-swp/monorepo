import { prisma } from 'db';

export const planService = {
  async createPlan(userId: string, title: string, description: string) {
    return await prisma.$transaction(async (tx: any) => {
      const newPlan = await tx.plan.create({
        data: {
          title: title,
          description: description,
          creator: {
            connect: { id: userId }
          }
        },
      });

      await tx.planMember.create({
        data: {
          userId: userId,
          planId: newPlan.id,
          role: 'OWNER',
        },
      });

      return newPlan;
    });
  },

  // async inviteMember(currentUserId: string, planId: string, targetEmail: string) {
  //   const membership = await prisma.planMember.findUnique({
  //     where: {
  //       userId_planId: {
  //         userId: currentUserId,
  //         planId: planId,
  //       },
  //     },
  //   });

  //   if (!membership || membership.role !== 'OWNER') {
  //     throw new Error('FORBIDDEN_NOT_OWNER');
  //   }

  //   const targetUser = await prisma.user.findUnique({
  //     where: { email: targetEmail },
  //   });

  //   if (!targetUser) {
  //     throw new Error('USER_NOT_FOUND');
  //   }

  //   const existingMember = await prisma.planMember.findUnique({
  //     where: {
  //       userId_planId: {
  //         userId: targetUser.id,
  //         planId: planId,
  //       },
  //     },
  //   });

  //   if (existingMember) {
  //     throw new Error('ALREADY_MEMBER');
  //   }

  //   const newMember = await prisma.planMember.create({
  //     data: {
  //       userId: targetUser.id,
  //       planId: planId,
  //       role: 'EDITOR',
  //     },
  //     include: {
  //       user: { select: { id: true, email: true } }
  //     }
  //   });

  //   return newMember;
  // },

  async sendInvitation(currentUserId: string, planId: string, targetEmail: string) {
    return prisma.$transaction(async (tx) => {

      const membership = await tx.planMember.findUnique({
        where: {
          userId_planId: {
            userId: currentUserId,
            planId: planId,
          },
        },
      });

      if (!membership || membership.role !== 'OWNER') {
        throw new Error('FORBIDDEN_NOT_OWNER');
      }

      const targetUser = await tx.user.findUnique({
        where: { email: targetEmail },
      });

      if (!targetUser) {
        throw new Error('USER_NOT_FOUND');
      }

      const existingMember = await tx.planMember.findUnique({
        where: {
          userId_planId: {
            userId: targetUser.id,
            planId: planId,
          },
        },
      });

      if (existingMember) {
        throw new Error('ALREADY_MEMBER');
      }

      const existingInvite = await tx.invitation.findFirst({
        where: {
          planId: planId,
          inviteeId: targetUser.id,
          status: 'PENDING'
        }
      });

      if (existingInvite) {
        throw new Error('ALREADY_INVITED');
      }

      const newInvitation = await tx.invitation.create({
        data: {
          inviterId: currentUserId,
          planId: planId,
          inviteeEmail: targetEmail,
          inviteeId: targetUser.id,
          status: 'PENDING',
        },
      });

      await tx.notification.create({
        data: {
          type: 'INVITATION',
          userId: targetUser.id,          // 相手に通知
          triggerUserId: currentUserId,   // あなたがトリガー
          invitationId: newInvitation.id, // 招待状と紐付け
          planId: planId,
        },
      });

      return newInvitation;
    });
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


  async updatePlan(userId: string, planId: string, data: {
    title?: string;
    description?: string;
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

  //いいね
  async addLike(userId: string, planId: string) {

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: { id: true, creatorId: true }
    });

    if (!plan) throw new Error('PLAN_NOT_FOUND');

    // 複合キー (userId, planId) を使って検索
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_planId: {
          userId: userId,
          planId: planId
        }
      }
    });

    if (existingLike) {
      return existingLike;
    }

    // トランザクションで「いいね」と「通知」を同時に作成
    const result = await prisma.$transaction(async (tx) => {
      // Likeデータ作成
      const newLike = await tx.like.create({
        data: {
          userId,
          planId
        }
      });

      // 通知 (Notification) 作成
      if (plan.creatorId !== userId) {
        await tx.notification.create({
          data: {
            type: 'LIKE',
            userId: plan.creatorId,
            triggerUserId: userId,
            planId: planId,
            isRead: false,
          }
        });
      }

      return newLike;
    });

    return result;

  },

  //いいねの取り消し
  async removeLike(userId: string, planId: string) {
    try {
      // 複合キーを使って削除
      await prisma.like.delete({
        where: {
          userId_planId: {
            userId: userId,
            planId: planId
          }
        }
      });
      return { success: true };
    } catch (error) {
      // 存在しない「いいね」を消そうとした場合のエラー (P2025) は無視して成功扱いにする
      return { success: true };
    }
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

  //計画の検索
  async searchPlans(params: {
    sort: 'popular' | 'newest';
    page: number;
    limit: number;
  }) {
    const { sort, page, limit } = params;

    // オフセット計算
    // page=1 なら skip=0, page=2 なら skip=10 (limit=10の場合)
    const skip = (page - 1) * limit;

    // ソート条件の決定
    let orderBy: any = { createdAt: 'desc' }; // デフォルトは新着順

    if (sort === 'popular') {
      // 人気順 = いいねの数が多い順
      orderBy = {
        likes: {
          _count: 'desc'
        }
      };
    }

    // データ取得と全件数カウントを並列実行
    const [plans, totalCount] = await prisma.$transaction([
      prisma.plan.findMany({
        take: limit, // 取得件数
        skip: skip,  // 読み飛ばす件数
        orderBy: orderBy,
        include: {
          creator: {
            select: { username: true } // 作成者名
          },
          _count: {
            select: {
              members: true,
              likes: true
            }
          }
        }
      }),
      prisma.plan.count() // ページネーション計算用の全件数
    ]);

    return {
      plans,
      pagination: {
        total: totalCount,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  },



};