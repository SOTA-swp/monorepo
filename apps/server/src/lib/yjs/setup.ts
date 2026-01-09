import { setPersistence } from 'y-websocket/bin/utils';
import { persistence } from './persistence';
import * as Y from 'yjs';

//y-leveldbに保存する処理
export const setupYjsPersistence = () => {
  setPersistence({
    bindState: async (docName: string, doc: Y.Doc) => {
      const persistedDoc = await persistence.getYDoc(docName);
      const stateVector = Y.encodeStateVector(doc);
      const diff = Y.encodeStateAsUpdate(persistedDoc, stateVector);
      if (diff.length > 0) Y.applyUpdate(doc, diff);

      doc.on('update', (update: Uint8Array) => {
        console.log(`[Yjs]計画(id: ${docName})に変更を保存します...`);
        persistence.storeUpdate(docName, update);
      });
    },
    writeState: async () => Promise.resolve()
  });
};

export const duplicateYjsDoc = async (sourceDocName: string, targetDocName: string) => {
  // 元のドキュメントをLevelDBからメモリにロード
  const doc = await persistence.getYDoc(sourceDocName);
  
  // ドキュメントの全ステート（履歴含む現在の状態）をバイナリとして抽出
  const update = Y.encodeStateAsUpdate(doc);
  
  // 新しいドキュメント名でDBに保存
  await persistence.storeUpdate(targetDocName, update);
  
  // メモリ解放（重要: サーバーのメモリ圧迫を防ぐため）
  doc.destroy();
};