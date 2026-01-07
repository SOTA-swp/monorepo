export const ApiRoutes = {
  auth: {
    login: "/api/login",
    logout: "/api/logout",
    register: "/api/register",
    me: "/api/me",
    plans: "/api/me/plans",
    user: (userId: string) => `/api/users/${userId}`,
    userplan: (userId: string) => `/api/users/${userId}` + '/plans',
  },
  plan: {
    create: "/api/plans",
    edit: (planId: string) => `/api/plans/${planId}`,
  },
  invitation: {
    invitation: (planId: string) => `/api/plans/${planId}` + '/invitations',
    respond: (invitationId: string) => `/api/invitations/${invitationId}`
  },
  notification: {
    default: '/api/me/notifications',
  },
  like :{
    like: (planId: string) => `/api/plans/${planId}`+'/likes',
    likestate: (planId: string) => `/api/plans/${planId}`+'/like-status'
  },
} as const;
