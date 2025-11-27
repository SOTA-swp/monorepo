import { LeveldbPersistence } from 'y-leveldb';
import path from 'path';

// パスの設定
const dbPath = path.join(process.cwd(), 'db-storage');
console.log(`[Yjs] LevelDB 永続化ストアを${dbPath}に設定`);


export const persistence = new LeveldbPersistence(dbPath);

