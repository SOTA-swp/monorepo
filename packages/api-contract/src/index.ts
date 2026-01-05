export const ApiRoutes = {
  auth: {
    login: "/api/login",
    logout: "/api/logout",
    register: "/api/register",
    me: "/api/me",
    user: (userId: string) => `/api/users/${userId}`,
  },
  plan: {
    create: "/api/plans",
    edit: (planId: string) => `/api/plans/${planId}`,
  },
  invitation: {
    respond: (invitationId: string) => `/api/invitations/${invitationId}/respond`
  }
} as const;
