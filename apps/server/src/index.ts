import Fastify from 'fastify';
import { prisma } from 'db';
import bcrypt from 'bcrypt';

//const prisma = new PrismaClient();

const server = Fastify({
  logger: true, // ログを有効にする
});

// サーバーが起動したかを確認するためのルート
server.get('/', async (request, reply) => {
  return { hello: 'world' };
});

// フロントからの通信テスト用API
server.get('/api/hello', async (request, reply) => {
  return { message: 'バックエンドからの応答です！' };
});

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