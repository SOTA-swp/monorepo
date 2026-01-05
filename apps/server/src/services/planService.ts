import { prisma } from 'db';

export const planService = {
  async createPlan(userId: string, title: string) {
    return await prisma.$transaction(async (tx: any) => {
      const newPlan = await tx.plan.create({
        data: {
          title: title,
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
        },
      });

      return newInvitation;
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

};