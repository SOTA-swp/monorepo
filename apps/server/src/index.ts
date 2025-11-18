import Fastify from 'fastify';
import { prisma } from 'db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookie from '@fastify/cookie';

const server = Fastify({
  logger: true, // ログを有効にする
});

server.register(cookie);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET){
  server.log.error('エラー：JWT_SECRET が.env ファイルに設定されていません。')
  process.exit(1);
}

// サーバーが起動したかを確認するためのルート
server.get('/', async (request, reply) => {
  return { hello: 'world' };
});

// フロントからの通信テスト用API
server.get('/api/hello', async (request, reply) => {
  return { message: 'バックエンドからの応答です！' };
});

// 会員登録用
server.post('/api/register', async (request, reply) => {
  try{
    const { email, password} = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ message: 'Email and Password は必須'});
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email },
    });

    if (existingUser) {
      return reply.status(409).send({ message: 'そのEmailは使用されています'});
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const newUser = await prisma.user.create({
      data: {
        email: email,
        password: hashedPassword,
      },
    });

    return reply.status(201).send({
      id: newUser.id,
      email: newUser.email,
      createdAt: newUser.createdAt,
    });
  } catch (error){
    server.log.error(error);
    return reply.status(500).send({ message: 'サーバー内部でエラー発生'})
  }
});

// ログイン用
server.post('/api/login', async (request, reply) => {
  try {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ message: 'Emailとパスワードは必須'});
    }

    const user = await prisma.user.findUnique({
      where: { email: email },
    });

    if (!user) {
      return reply.status(401).send({ message: 'Emailまたはパスワードが違います'});
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid){
      return reply.status(401).send({ message: 'Emailまたはパスワードが違います'});
    }

    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '1d' },
    );

    reply.setCookie('token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return reply.status(200).send({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    });
  } catch (error) {
    server.log.error(error);
    return reply.status(500).send({ message: 'サーバー内部でエラーが発生'});
  }
});

//自分が誰かを確認する用
server.get('/api/me', async (request, reply) => {
  try {
    const token = request.cookies.token;

    if (!token) {
      return reply.status(401).send({ message: '認証されていません (トークンなし）'});
    }

    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      return reply.status(404).send({ message: 'ユーザーが見つかりません'});
    }

    return reply.status(200).send(user);

  } catch (error){
    server.log.warn(error);
    return reply.status(401).send({ message: '認証トークンが向こうまたは期限切れです' });
  }
})

const start = async () => {
  try {
    await server.listen({ port: 4000 }); // 4000番ポートで起動
    console.log('✅ Fastify server listening on http://localhost:4000');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();