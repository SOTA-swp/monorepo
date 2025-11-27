import { prisma } from 'db';

export const planService = {
  async createPlan(userId: string, title: string) {
    return await prisma.$transaction(async (tx) => {
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

  async inviteMember(currentUserId: string, planId: string, targetEmail: string) {
    const membership = await prisma.planMember.findUnique({
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

    const targetUser = await prisma.user.findUnique({
      where: { email: targetEmail },
    });

    if (!targetUser) {
      throw new Error('USER_NOT_FOUND');
    }

    const existingMember = await prisma.planMember.findUnique({
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

    const newMember = await prisma.planMember.create({
      data: {
        userId: targetUser.id,
        planId: planId,
        role: 'EDITOR',
      },
      include: {
        user: { select: { id: true, email: true } }
      }
    });

    return newMember;
  }
};