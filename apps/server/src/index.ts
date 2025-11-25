import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { setupYjsPersistence } from './lib/yjsConfig';
import { authRoutes } from './routes/auth';
import { planSocketRoutes } from './routes/planSocket';
import fastifyWebsocket from '@fastify/websocket';
import { planRoutes } from './routes/plans';

// Yjs永続化の初期設定
setupYjsPersistence();

// サーバーインスタンス作成
const server = Fastify({
  logger: true,
});

if (!process.env.JWT_SECRET) {
  server.log.error('エラー：JWT_SECRET が設定されていません。');
  process.exit(1);
}

//サーバー起動
const start = async () => {
  try {
    await server.register(cookie);
    await server.register(cors, {
      origin: "http://localhost:3000",
      credentials: true,
    });
    
    await server.register(fastifyWebsocket);

    await server.register(authRoutes);
    await server.register(planSocketRoutes);
    await server.register(planRoutes);

    await server.listen({ port: 4000 });
    console.log('✅ Fastify server listening on http://localhost:4000');
    // デバッグ: 登録されたルートを確認
    console.log(server.printRoutes());
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

// setPersistence({
//   bindState: async (docName: string, doc: Y.Doc) => {
//     // ここで、あなたがやりたかった「初期ロード」と「保存設定」を行います。
    
//     // 1. DBからデータをロードして doc に適用
//     const persistedDoc = await persistence.getYDoc(docName);
//     const stateVector = Y.encodeStateVector(doc);
//     const diff = Y.encodeStateAsUpdate(persistedDoc, stateVector);
    
//     if (diff.length > 0) {
//       Y.applyUpdate(doc, diff);
//     }
    
//     // 2. 今後の変更をDBに保存するようにリスナー登録
//     doc.on('update', (update: Uint8Array) => {
//       console.log(`[Yjs]計画(id: ${docName})に変更を保存します...`)
//       persistence.storeUpdate(docName, update);
//     });
//   },
//   writeState: async (docName: string, doc: Y.Doc) => {
//     // この関数は setPersistence の型定義上必要ですが、
//     // 基本的に bindState 内の update リスナーで処理するので空でOKです。
//     // または、サーバー終了時などに強制保存する場合に使われます。
//     return Promise.resolve();
//   }
// });
// ----------------------------------------------------------------



// ----------------------------------------------------------------
// グローバルプラグイン登録
// ----------------------------------------------------------------


// const JWT_SECRET = process.env.JWT_SECRET;
// if (!JWT_SECRET) {
//   server.log.error('エラー：JWT_SECRET が.env ファイルに設定されていません。')
//   process.exit(1);
// }

// ----------------------------------------------------------------
// HTTPルート (API等)
// ----------------------------------------------------------------
// server.get('/', async (request, reply) => {
//   return { hello: 'world' };
// });

// server.get('/api/hello', async (request, reply) => {
//   return { message: 'バックエンドからの応答です！' };
// });

// 会員登録
// server.post('/api/register', async (request, reply) => {
//   try {
//     const { email, password } = request.body as any;
//     if (!email || !password) return reply.status(400).send({ message: 'Email and Password は必須' });

//     const existingUser = await prisma.user.findUnique({ where: { email } });
//     if (existingUser) return reply.status(409).send({ message: 'そのEmailは使用されています' });

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const newUser = await prisma.user.create({
//       data: { email, password: hashedPassword },
//     });

//     return reply.status(201).send({
//       id: newUser.id,
//       email: newUser.email,
//       createdAt: newUser.createdAt,
//     });
//   } catch (error) {
//     server.log.error(error);
//     return reply.status(500).send({ message: 'サーバー内部でエラー発生' });
//   }
// });

// ログイン
// server.post('/api/login', async (request, reply) => {
//   // try {
//   //   const { email, password } = request.body as any;
//   //   if (!email || !password) return reply.status(400).send({ message: 'Emailとパスワードは必須' });

//   //   const user = await prisma.user.findUnique({ where: { email } });
//   //   if (!user) return reply.status(401).send({ message: 'Emailまたはパスワードが違います' });

//   //   const isPasswordValid = await bcrypt.compare(password, user.password);
//   //   if (!isPasswordValid) return reply.status(401).send({ message: 'Emailまたはパスワードが違います' });

//   //   const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1d' });

//   //   reply.setCookie('token', token, {
//   //     path: '/',
//   //     httpOnly: true,
//   //     secure: process.env.NODE_ENV === 'production',
//   //     maxAge: 24 * 60 * 60 * 1000,
//   //   });

//   //   return reply.status(200).send({
//   //     id: user.id,
//   //     email: user.email,
//   //     createdAt: user.createdAt,
//   //   });
//   // } catch (error) {
//   //   server.log.error(error);
//   //   return reply.status(500).send({ message: 'サーバー内部でエラーが発生' });
//   // }
// });

// ユーザー情報取得
// server.get('/api/me', async (request, reply) => {
//   // try {
//   //   const token = request.cookies.token;
//   //   if (!token) return reply.status(401).send({ message: '認証されていません' });

//   //   const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
//   //   const user = await prisma.user.findUnique({
//   //     where: { id: payload.userId },
//   //     select: { id: true, email: true, createdAt: true },
//   //   });

//   //   if (!user) return reply.status(404).send({ message: 'ユーザーが見つかりません' });
//   //   return reply.status(200).send(user);
//   // } catch (error) {
//   //   server.log.warn(error);
//   //   return reply.status(401).send({ message: '認証エラー' });
//   // }
// });

// ログアウト
// server.post('/api/logout', async (request, reply) => {
//   reply.clearCookie('token', { path: '/' });
//   return reply.status(200).send({ message: 'ログアウト成功' });
// });

// ----------------------------------------------------------------
// 【重要】WebSocket機能の登録と定義
// ----------------------------------------------------------------
// 公式ドキュメント推奨: プラグインの登録とルート定義を非同期スコープに閉じ込めることで
// 「プラグイン読み込み完了後にルートが登録されること」を保証します。
// server.register(async (fastify) => {

//   // 1. このスコープ内で WebSocket プラグインを登録
//   await fastify.register(fastifyWebsocket);

//   // 2. ルート定義
//   // ここでは fastifyWebsocket が確実にロードされているため、{ websocket: true } が正しく機能します。
//   fastify.get('/ws/plan/:planId', { websocket: true }, async (connection: SocketStream, request: FastifyRequest) => {

//     // ★デバッグ用安全装置: 万が一 HTTP として処理された場合のガード
//     // connection.socket が存在し、かつそれが WebSocket (ws) であることを確認
//     if (!connection.socket || typeof connection.socket.close !== 'function') {
//       // ここに来る場合、まだ何かがおかしい（HTTPとして処理されている）
//       // request経由でエラーを返す
//       const reply = request as any as FastifyReply;
//       return reply.status(400).send('This endpoint requires a WebSocket connection.');
//     }

//     // URLパラメータの取得 (Fastify標準の方法)
//     // 型キャストを追加して安全に取得
//     const params = request.params as { planId: string };
//     const planId = params.planId;

//     if (!planId) {
//       connection.socket.close(1008, '無効な計画IDです');
//       return;
//     }

//     const token = request.cookies.token;
//     let userId: number;

//     if (!token) {
//       connection.socket.close(1008, '認証トークンがありません');
//       return;
//     }

//     try {
//       const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
//       userId = payload.userId;
//     } catch (error) {
//       connection.socket.close(1008, '認証トークンが無効です');
//       return;
//     }

//     try {
//       const membership = await prisma.planMember.findUnique({
//         where: {
//           userId_planId: { userId: userId, planId: parseInt(planId, 10) }
//         },
//       });

//       if (!membership) {
//         connection.socket.close(1008, 'この計画へのアクセス権がありません');
//         return;
//       }

//       server.log.info(`[Yjs] ユーザー(id: ${userId}) が 計画(id: ${planId}) に接続しました。`);  
      
//       connection.socket.binaryType = 'nodebuffer';
//       // ----------------------------------------------------------------
//       Object.defineProperty(connection.socket, 'binaryType', {
//         get: () => 'nodebuffer',     // 誰が聞いても「nodebufferだよ」と答える
//         set: () => {},               // 誰かが書き換えようとしても無視する（何もしない）
//         configurable: true,
//         enumerable: true
//       });
//       // ----------------------------------------------------------------

//       try {
//       // ドキュメントの手動作成や注入は不要になりました！
//       // setupWSConnection が内部で勝手にやってくれます。
//       // 上で setPersistence を設定したので、勝手にDB接続もされます。

//       setupWSConnection(connection.socket, request, {
//         docName: planId, // これさえ渡せば、あとは全部自動です
//         gc: true
//       });

//     } catch (err) {
//       server.log.error(err);
//       connection.socket.close(1011, 'サーバーエラー');
//     }

//     } catch (err) {
//       server.log.error(err);
//       connection.socket.close(1011, 'サーバーエラー');
//     }
//   });
// });

// ----------------------------------------------------------------
// サーバー起動
// ----------------------------------------------------------------
