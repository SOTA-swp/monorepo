import { prisma } from 'db';

export const planService = {

  //計画を作成
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

  //招待を送信
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


  //計画の基本情報の編集
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
    query?: string;
    currentUserId?: string;
  }) {
    const { sort, page, limit, query, currentUserId } = params;

    // オフセット計算
    // page=1 なら skip=0, page=2 なら skip=10 (limit=10の場合)
    const skip = (page - 1) * limit;

    const whereCondition: any = {};

    if (query) {
      // タイトルに query が含まれるものを検索 (部分一致)
      whereCondition.title = {
        contains: query,
      };
    }

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
    const [plansData, totalCount] = await prisma.$transaction([
      prisma.plan.findMany({
        where: whereCondition,
        take: limit, // 取得件数
        skip: skip,  // 読み飛ばす件数
        orderBy: orderBy,
        include: {
          creator: {
            select: {
              id: true,
              username: true,
            }
          },
          _count: {
            select: {
              members: true,
              likes: true
            }
          },
          likes: {
            where: {
              userId: currentUserId ?? 'dummy-id-for-guest' // 未ログインならヒットしない文字列を入れる
            },
            select: { userId: true }
          }
        }
      }),
      prisma.plan.count({
        where: whereCondition
      }) // ページネーション計算用の全件数
    ]);

    const plans = plansData.map((plan) => {
      // likes配列に中身があれば「自分がいいねしている」ということ
      const isLiked = plan.likes.length > 0;

      // レスポンスから余計な `likes` 配列を削除し、`hasLiked` を追加
      const { likes, ...rest } = plan;

      return {
        ...rest,
        hasLiked: isLiked
      };
    });

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
        userId: m.userId,
        username: m.user.username,
        role: m.role, // 'OWNER' | 'EDITOR' | 'VIEWER'
      })),
      // 招待中メンバー
      invited: invitations.map((i) => {
        // invitee が null の場合の対策
        return {
          // ユーザーID: 登録済みならID、未登録なら null
          userId: i.invitee?.id ?? null,
          // 名前: 登録済みならユーザー名、未登録なら "未登録" や メールアドレス等
          username: i.invitee?.username ?? '未登録ユーザー', 
          invitationId: i.id,
          invitedAt: i.createdAt
        };
      })
    };
  },

};