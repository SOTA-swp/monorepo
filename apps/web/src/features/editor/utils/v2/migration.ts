import * as Y from 'yjs';
import { PlanNode, PlanNodeData, PARENT_ID_ROOT } from '@/features/editor/types/node';

/**
 * V1データ (Map + displayOrder) を V2データ (Map + Array Structure) に変換する
 * * ロジック:
 * 1. 既存の 'planNodes' (V1) を全取得
 * 2. まだ 'planNodesV2' (V2) が空であれば移行開始
 * 3. V1データを親ごとにグルーピングし、displayOrderでソート
 * 4. ソート順通りに V2 Structure (Y.Array) に挿入
 * 5. データ実体を V2 Map にコピー
 */
export const migrateV1toV2 = (ydoc: Y.Doc) => {
  const v1Map = ydoc.getMap<PlanNode>('planNodes');
  const v2Map = ydoc.getMap<PlanNodeData>('planNodesV2');
  const v2Structure = ydoc.getMap<Y.Array<string>>('planStructure');

  // トランザクションで一括処理
  ydoc.transact(() => {
    // 既にV2データがあるなら実行しない (二重実行防止)
    if (v2Map.size > 0 || v2Structure.size > 0) {
      console.log('[Migration] V2 data already exists. Skipping migration.');
      return;
    }

    if (v1Map.size === 0) {
      console.log('[Migration] No V1 data found. Skipping.');
      return;
    }

    console.log('[Migration] Starting V1 -> V2 migration...');

    // 1. V1データをメモリ上で整理
    const allV1Nodes = Array.from(v1Map.values());
    const groups = new Map<string, PlanNode[]>();

    allV1Nodes.forEach(node => {
      const pId = node.parentId ?? PARENT_ID_ROOT;
      if (!groups.has(pId)) groups.set(pId, []);
      groups.get(pId)?.push(node);
    });

    // 2. グループごとに処理
    groups.forEach((siblings, parentId) => {
      // displayOrder でソート (これが最後のソートになります！)
      siblings.sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
        return a.id.localeCompare(b.id);
      });

      // 3. 構造(Structure)を作成
      const idList = siblings.map(n => n.id);
      const yArray = new Y.Array<string>();
      yArray.push(idList); // 一括挿入
      v2Structure.set(parentId, yArray);

      // 4. データ実体(Data)を作成
      siblings.forEach(node => {
        const nodeData: PlanNodeData = {
          id: node.id,
          type: node.type,
          name: node.name,
          locationId: (node as any).locationId, // 既存データにあれば引き継ぐ
        };
        v2Map.set(node.id, nodeData);
      });
    });

    console.log('[Migration] Migration completed successfully.');
  });
};