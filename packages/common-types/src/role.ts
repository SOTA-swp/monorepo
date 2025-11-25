// Prismaのenumが消えたので、自分で定義する
export const Role = {
  OWNER: 'OWNER',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER',
} as const;

export type Role = typeof Role[keyof typeof Role];