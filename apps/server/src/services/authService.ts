import { prisma } from 'db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new Error('JWT_SECRET is missing');

export const authService = {
  async register(username: string, email: string, password: string) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('USER_ALREADY_EXISTS');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: { username, email, password: hashedPassword },
    });

    return {
      username: newUser.username,
      id: newUser.id,
      email: newUser.email,
      createdAt: newUser.createdAt
    };
  },

  async updateUser(userId: string, data: { username?: string; email?: string }) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        username: data.username,
        email: data.email,
      },
    });
  },

  async getUserPublicProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      // ★重要: パスワードやEmailを含めないよう、必要な項目だけをtrueにする
      select: {
        id: true,
        username: true,
        // 将来的に avatarUrl や bio (自己紹介) が増えたらここに追加
        // createdAt: true, // 登録日を表示したい場合はtrue
      },
    });

    return user;
  },

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1d' });

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
      token,
    };
  },

  async verifyToken(token: string) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, createdAt: true },
      });
      return user;
    } catch {
      return null;
    }
  }
};