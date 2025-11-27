import { useState, useEffect, useCallback } from 'react';
import * as Y from 'yjs';
import { v4 as uuidv4 } from 'uuid'; // UUID生成
import { PlanNode, NodeType } from '@/features/editor/types/node';
import { PARENT_ID_ROOT } from '@/features/editor/types/node'; // インポート

export const usePlanNodes = (ydoc: Y.Doc | null) => {
  // React表示用のステート（配列として管理するとレンダリングしやすい）
  const [nodes, setNodes] = useState<PlanNode[]>([]);

  // 1. Yjsの変更を監視してReactステートに反映させる
  useEffect(() => {
    if (!ydoc) return;

    // 'planNodes' という名前のMapを取得（これがYjs上のデータ本体）
    const yMap = ydoc.getMap<PlanNode>('planNodes');

    // データ変換関数: Y.Map -> PlanNode[]
    const updateState = () => {
      // Mapの値（Nodeオブジェクト）を全て取り出して配列にする
      const nodeArray = Array.from(yMap.values());

      // displayOrder順に並べ替えておくと使いやすい
      nodeArray.sort((a, b) => a.displayOrder - b.displayOrder);

      setNodes(nodeArray);
    };

    // 初回ロード
    updateState();

    // 変更監視 (Observe)
    // Yjsのデータが変わるたびにこのイベントが発火する
    const observer = () => {
      updateState();
    };

    yMap.observe(observer);

    // クリーンアップ
    return () => {
      yMap.unobserve(observer);
    };
  }, [ydoc]);

  // 2. ノードを追加する関数
  const addNode = useCallback((
    parentId: string | null,
    type: NodeType,
    name: string,
    extraData: { locationId?: string; startTime?: string } = {}
  ) => {
    if (!ydoc) return;

    const yMap = ydoc.getMap<PlanNode>('planNodes');

    // トランザクション: 一連の変更をひとまとめにする（Undo/Redoで重要）
    ydoc.transact(() => {
      const id = uuidv4();

      // 同じ親を持つノードの中で、一番後ろに追加するための計算
      // (本来はもっと賢いロジックが必要ですが、まずは簡易的に実装)
      const siblings = Array.from(yMap.values()).filter(n => n.parentId === parentId);
      const maxOrder = siblings.length > 0
        ? Math.max(...siblings.map(n => n.displayOrder))
        : 0;

      const newNode: PlanNode = {
        id,
        parentId,
        type,
        name,
        displayOrder: maxOrder + 1000, // 余裕を持って番号を振る
        timeType: 'NONE',
        ...extraData,
      };

      // Mapにセット (Key=UUID, Value=Nodeオブジェクト)
      yMap.set(id, newNode);
    });
  }, [ydoc]);

  // 3. ノードを削除する関数
  const deleteNode = useCallback((nodeId: string) => {
    if (!ydoc) return;
    const yMap = ydoc.getMap<PlanNode>('planNodes');

    ydoc.transact(() => {

      const deleteRecursively = (id: string) => {

        const allNodes = Array.from(yMap.values());
        const children = allNodes.filter(n => n.parentId === id);

        const existsBefore = yMap.has(id);
        console.log(`[Delete] ID: ${id} 削除開始... (存在: ${existsBefore})`);

        if (existsBefore) {
          yMap.delete(id);

          // 直後に確認！
          const existsAfter = yMap.has(id);
          console.log(`[Delete] ID: ${id} 削除結果 -> ${existsAfter ? '❌ 失敗（まだいる）' : '✅ 成功（消えた）'}`);
        } else {
          console.warn(`[Delete] ID: ${id} を消そうとしましたが、既にいませんでした`);
        }
        // 本来はここで「子ノード」も再帰的に探して削除すべきですが、
        // まずは対象ノードのみ削除します。
        children.forEach(child => {
          deleteRecursively(child.id);
        });
        // if (yMap.has(nodeId)) {
        //   yMap.delete(nodeId);
        // }
      };
      deleteRecursively(nodeId);
    });
  }, [ydoc]);

  // 4. ノードを更新する関数
  const updateNode = useCallback((nodeId: string, updates: Partial<PlanNode>) => {
    if (!ydoc) return;
    const yMap = ydoc.getMap<PlanNode>('planNodes');

    ydoc.transact(() => {
      const existingNode = yMap.get(nodeId);
      if (existingNode) {
        // 既存のデータと新しいデータをマージして上書き
        const updatedNode = { ...existingNode, ...updates };
        yMap.set(nodeId, updatedNode);
      }
    });
  }, [ydoc]);

  return {
    nodes,      // 現在の全ノードリスト
    addNode,    // 追加関数
    deleteNode, // 削除関数
    updateNode  // 更新関数
  };
};