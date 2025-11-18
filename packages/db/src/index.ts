// 1. 生成されたPrisma Clientをインポート
import { PrismaClient } from '@prisma/client';

// 2. Prisma Clientの「インスタンス（実体）」を作成
const prisma = new PrismaClient();

// 3. インスタンス（prisma）と、型定義（*）をエクスポート（公開）
export * from '@prisma/client';
export { prisma };