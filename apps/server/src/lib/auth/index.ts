import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../../services/authService';

export const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const token = request.cookies.token;

    if (!token) {
      return reply.status(401).send({ message: 'ログインしてください' });
    }

    const user = await authService.verifyToken(token);

    if (!user) {
      return reply.status(401).send({ message: 'セッションが無効です' });
    }

    // ★ここがポイント
    // 検証済みのユーザー情報を request オブジェクトに埋め込みます。
    // これにより、後の処理で request.user としてアクセスできるようになります。
    request.user = user;

  } catch (error) {
    return reply.status(401).send({ message: '認証エラーが発生しました' });
  }
};