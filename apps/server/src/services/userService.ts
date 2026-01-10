import { prisma } from 'db';
import { duplicateYjsDoc } from '../lib/yjs/setup';

export const userService = {

  //ユーザー情報更新
  async updateUser(userId: string, data: { username?: string; email?: string }) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        username: data.username,
        email: data.email,
      },
    });
  },

  //任意のユーザーのユーザー情報取得
  async getUserPublicProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      // ★重要: パスワードやEmailを含めないよう、必要な項目だけをtrueにする
      select: {
        id: true,
        username: true,
        createdAt: true,
        _count: {
          select: {
            createdPlans: true, // 作成した計画数
            likes: true, // 自分が「した」いいね数
          }
        }
      },
    });
    if (!user) return null;

    // 「もらったいいね数」を集計
    // Likeテーブルから、「関連するPlanの作成者(creatorId)がこのユーザー」であるものをカウント
    const receivedLikesCount = await prisma.like.count({
      where: {
        plan: {
          creatorId: userId
        }
      }
    });

    // レスポンスを整形して返す
    return {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      // ★追加: 統計情報オブジェクト
      stats: {
        createdPlans: user._count.createdPlans,
        givenLikes: user._count.likes,
        receivedLikes: receivedLikesCount
      }
    };
  },

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

  // 計画をインポート
  async importPlan(sourcePlanId: string, userId: string) {
    // 元の計画を取得 & 権限チェック
    const sourcePlan = await prisma.plan.findUnique({
      where: { id: sourcePlanId }
    });

    if (!sourcePlan) {
      throw new Error('PLAN_NOT_FOUND');
    }

    // 公開されているかをチェック
    if (!sourcePlan.isPublic) {
      throw new Error('PLAN_IS_PRIVATE');
    }

    // Prisma: 新しい計画枠を作成
    const newPlan = await prisma.plan.create({
      data: {
        title: `${sourcePlan.title} のコピー`,
        description: sourcePlan.description,

        // 重要な設定
        isPublic: false,
        creatorId: userId,

      }
    });

    try {
      // Yjs: ホワイトボードの中身を複製
      await duplicateYjsDoc(sourcePlan.id, newPlan.id);

      return newPlan;

    } catch (error) {
      // Yjsのコピーに失敗した場合、作ったPlanも消す
      await prisma.plan.delete({ where: { id: newPlan.id } });
      throw error;
    }
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

    const whereCondition: any = {
      isPublic: true,
    };

    if (query) {
      // タイトルに query が含まれるものを検索 (部分一致)
      whereCondition.title = {
        contains: query,
      };
    }

    // ソート条件の決定
    let orderBy: any = { createdAt: 'desc' };
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
              userId: currentUserId ?? 'dummy-id-for-guest'
            },
            select: { userId: true }
          },
          members: {
            where: {
              userId: currentUserId ?? 'dummy-id-for-guest'
            },
            select: { role: true }
          }
        }
      }),
      prisma.plan.count({
        where: whereCondition
      })
    ]);

    const plans = plansData.map((plan) => {
      const isLiked = plan.likes.length > 0;

      // Role判定
      let role: 'OWNER' | 'MEMBER' | 'VIEWER' | undefined;
      if (currentUserId) {
        if (plan.creatorId === currentUserId) {
          role = 'OWNER';
        } else if (plan.members.length > 0) {
          role = 'MEMBER';
        } else {
          role = 'VIEWER';
        }
      }

      const { likes, members, ...rest } = plan;

      return {
        ...rest,
        hasLiked: isLiked,
        role: role
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

  //ユーザーIdから計画一覧を取得
  async getPlansByOwner(targetUserId: string, viewingUserId?: string) {

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
        creator: {
          select: { id: true, username: true }
        },
        _count: {
          select: { members: true, likes: true }
        },
        likes: {
          where: { userId: viewingUserId ?? 'dummy-id' },
          select: { userId: true }
        }
      }
    });

    //そのユーザーが作成したPlanだけを取得してるから全部OWNERになるだけで正直いらんかも
    const plansWithRole = plans.map((plan) => {
      let role = 'MEMBER'; // デフォルトはメンバー

      if (plan.creatorId === targetUserId) {
        role = 'OWNER'; // 自分が作成者なら OWNER
      }

      const isLiked = plan.likes.length > 0;

      // レスポンスから余計な `likes` 配列を削除し、`hasLiked` を追加
      const { likes, ...rest } = plan;

      return {
        ...rest,
        hasLiked: isLiked,
        role: role
      };
    });
    return plansWithRole;
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
        orderBy: { createdAt: 'desc' },
        include: {
          creator: {
            select: { id: true, username: true }
          },
          _count: {
            select: { members: true, likes: true }
          },
          likes: {
            where: { userId: myUserId },
            select: { userId: true }
          }
        }
      });
      const plansWithRole = plans.map((plan) => {
        let role = 'MEMBER'; // デフォルトはメンバー

        if (plan.creatorId === myUserId) {
          role = 'OWNER'; // 自分が作成者なら OWNER
        }
        // likes配列に中身があれば「自分がいいねしている」ということ
        const isLiked = plan.likes.length > 0;

        // レスポンスから余計な `likes` 配列を削除し、`hasLiked` を追加
        const { likes, ...rest } = plan;

        return {
          ...rest,
          role: role,
          hasLiked: isLiked
        };
      });
      return plansWithRole;
    } catch (error) {
      throw error;
    }
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

  //招待への応答
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

  //任意のユーザーがいいねした計画一覧を取得
  async getLikedPlansByUser(targetUserId: string, viewingUserId?: string) {
    const userExists = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true }
    });
    if (!userExists) {
      throw new Error('USER_NOT_FOUND');
    }

    const likes = await prisma.like.findMany({
      where: {
        userId: targetUserId, // そのユーザーがいいねしたもの
      },
      include: {
        // 関連するプランの情報を取得
        plan: {
          include: {
            // プランの作成者情報
            creator: {
              select: { id: true, username: true }
            },
            // メンバー数やいいね数
            _count: {
              select: { members: true, likes: true }
            },
            likes: {
              where: { userId: viewingUserId ?? 'dummy-id' },
              select: { userId: true }
            }
          }
        }
      }
    });

    // 構造を整形
    return likes.map((record) => {
      const plan = record.plan;

      // 判定ロジック
      const isLiked = plan.likes.length > 0;

      // 不要な配列(likes)を除去して整形
      const { likes: _userLikes, ...planRest } = plan;

      return {
        ...planRest,
        hasLiked: isLiked, // ★追加
      };
    });
  },
}