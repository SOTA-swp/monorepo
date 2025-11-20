import { LeveldbPersistence } from 'y-leveldb';
import * as Y from 'yjs';
import path from 'path';

const dbPath = path.join(__dirname, '..', '..', 'db-storage');
console.log(`[Yjs] LevelDB 永続化ストアを${dbPath}に設定`);

const persistence = new LeveldbPersistence(dbPath);

export const getYjsDoc = (planId: string): Y.Doc => {
  const doc = persistence.getYDoc(planId);
  return doc;
}