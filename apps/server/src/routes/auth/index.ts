// import { FastifyInstance } from "fastify";
// import { prisma } from 'db';
// import bcrypt from 'bcrypt';
// import jwt from 'jsonwebtoken';

// export async function authRoutes(server: FastifyInstance) {
//   const JWT_SECRET = process.env.JWT_SECRET!;

//   server.get('/', async () => ({ hello: 'world' }));
//   server.get('/api/hello', async () => ({ message: 'バックエンドからの応答です！'}));

//   //会員登録
//   server.post('/api/register', async (request, reply) => {
//     try {
//         const { email, password } = request.body as any;
//         if (!email || !password) return reply.status(400).send({ message: 'Email または password がありません'});
    
//         const existingUser = await prisma.user.findUnique({ where: { email } });
//         if (existingUser) return reply.status(409).send({ message: 'そのEmailは既に使用されています' });

//         //ユーザー情報を登録
//         const hashedPassword = await bcrypt.hash(password, 10);
//         const newUser = await prisma.user.create({
//           data: { email, password: hashedPassword },
//         });
    
//         return reply.status(201).send({
//           id: newUser.id,
//           email: newUser.email,
//           createdAt: newUser.createdAt,
//         });
//     } catch (error) {
//         server.log.error(error);
//         return reply.status(500).send({ message: 'サーバー内部でエラー発生' });
//     }
//   });

//   //ログイン
//   server.post('/api/login', async (request, reply) => {
//     try {
//         const { email, password } = request.body as any;
//         if (!email || !password) return reply.status(400).send({ message: 'Email または password がありません' });
    
//         const user = await prisma.user.findUnique({ where: { email } });
//         if (!user) return reply.status(401).send({ message: 'Emailまたはパスワードが違います' });
    
//         const isPasswordValid = await bcrypt.compare(password, user.password);
//         if (!isPasswordValid) return reply.status(401).send({ message: 'Emailまたはパスワードが違います' });
    
//         const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1d' });
    
//         reply.setCookie('token', token, {
//           path: '/',
//           httpOnly: true,
//           secure: process.env.NODE_ENV === 'production',
//           maxAge: 24 * 60 * 60 * 1000,
//         });
    
//         return reply.status(200).send({
//           id: user.id,
//           email: user.email,
//           createdAt: user.createdAt,
//         });
//     } catch (error) {
//         server.log.error(error);
//         return reply.status(500).send({ message: 'サーバー内部でエラーが発生' });
//     }
//   });

//   //ユーザー情報取得
//   server.get('/api/me', async (request, reply) => {
//     try {
//         const token = request.cookies.token;
//         if (!token) return reply.status(401).send({ message: '認証されていません' });
    
//         const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
//         const user = await prisma.user.findUnique({
//           where: { id: payload.userId },
//           select: { id: true, email: true, createdAt: true },
//         });
    
//         if (!user) return reply.status(404).send({ message: 'ユーザーが見つかりません' });
//         return reply.status(200).send(user);
//     } catch (error) {
//         server.log.warn(error);
//         return reply.status(401).send({ message: '認証エラー' });
//     }
//   });

//   //ログアウト
//   server.post('/api/logout', async (request, reply) => {
//     reply.clearCookie('token', { path: '/' });
//     return reply.status(200).send({ message: 'ログアウト成功' });
//   });
// }


import { FastifyInstance } from "fastify";
import { authService } from "../../services/authService";

export async function authRoutes(server: FastifyInstance) {

  server.get('/', async () => ({ hello: 'world' }));
  server.get('/api/hello', async () => ({ message: 'バックエンドからの応答です！'}));

  //会員登録----------------------------------------------------------------
  server.post('/api/register', async (request, reply) => {
    try {
      const { email, password } = request.body as any;
      if (!email || !password) return reply.status(400).send({ message: 'Email または password がありません'});

      const newUser = await authService.register(email, password);
      return reply.status(201).send(newUser);

    } catch (error: any) {
      if (error.message === 'USER_ALREADY_EXISTS') {
        return reply.status(409).send({ message : 'そのEmailは既に使用されています'});
      }
      server.log.error(error);
      return reply.status(500).send({ message: 'サーバー内部でエラー発生'});
    }
  });

  //ログイン----------------------------------------------------------------
  server.post('/api/login', async (request, reply) => {
    try {
      const { email, password } = request.body as any;
      if (!email || !password) return reply.status(400).send({ message: 'Email または password がありません'});

      const { user, token } = await authService.login(email, password);

      reply.setCookie('token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
      });

      return reply.status(200).send(user);

    } catch (error: any) {
        if (error.message === 'INVALID_CREDENTIALS') {
            return reply.status(401).send({ message: 'Emailまたはパスワードが違います' });
        }
        server.log.error(error);
        return reply.status(500).send({ message: 'サーバー内部でエラーが発生' });
    }
  });


  //ユーザー情報取得----------------------------------------------------------------
  server.get('/api/me', async (request, reply) => {
    try {
      const token = request.cookies.token;
      if (!token) return reply.status(401).send({ message: '認証されていません'});

      const user = await authService.verifyToken(token);
      if (!user) return reply.status(401).send({ message: '認証エラー'});

      return reply.status(200).send(user);

    }catch (error) {
        server.log.warn(error);
        return reply.status(401).send({ message: '認証エラー' });
    }
  });

  //ログアウト----------------------------------------------------------------
  server.post('/api/logout', async (request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return reply.status(200).send({ message: 'ログアウト成功' });
  });
}