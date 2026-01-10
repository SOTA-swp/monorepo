export const ApiRoutes = {
  auth: {
    login: "/api/login",
    logout: "/api/logout",
    register: "/api/register",
    me: "/api/me",
    plans: "/api/me/plans",
    user: (userId: string) => `/api/users/${userId}`,
    userplan: (userId: string) => `/api/users/${userId}` + '/plans',
    userlike: (userId: string) => `/api/users/${userId}` + '/likes',
  },
  plan: {
    create: "/api/plans",
    edit: (planId: string) => `/api/plans/${planId}`,
    members: (planId: string) => `/api/plans/${planId}` + '/members',
    import: (planId: string) => `api/plans/${planId}` + '/import',
  },
  invitation: {
    invitation: (planId: string) => `/api/plans/${planId}` + '/invitations',
    respond: (invitationId: string) => `/api/invitations/${invitationId}`
  },
  notification: {
    default: '/api/me/notifications',
    unread: '/api/me/notifications/unread'
  },
  like :{
    like: (planId: string) => `/api/plans/${planId}`+'/likes',
    likestate: (planId: string) => `/api/plans/${planId}`+'/like-status'
  },
  routes :{
    calculate: '/api/routes/calculate'
  }
} as const;
