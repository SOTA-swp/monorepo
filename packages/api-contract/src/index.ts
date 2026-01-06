export const ApiRoutes = {
  auth: {
    login: "/api/login",
    logout: "/api/logout",
    register: "/api/register",
    me: "/api/me",
    plans: "/api/me/plans",
    user: (userId: string) => `/api/users/${userId}`,
  },
  plan: {
    create: "/api/plans",
    edit: (planId: string) => `/api/plans/${planId}`,
  },
  invitation: {
    respond: (invitationId: string) => `/api/invitations/${invitationId}`
  },
  notification: {
    default: '/api/me/notifications',
  }
} as const;
