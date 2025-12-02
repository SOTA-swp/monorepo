import { useState, useEffect, useCallback } from 'react';
import * as Y from 'yjs';

type StructureMap = Record<string, string[]>;

export const usePlanTree = (ydoc: Y.Doc | null) => {
  const [structure, setStructure] = useState<StructureMap>({});

  useEffect(() => {
    if (!ydoc) return;

    const structMap = ydoc.getMap<Y.Array<string>>('planStructure');

    const updateState = () => {
      setStructure(structMap.toJSON() as StructureMap);
    };

    updateState();

    const observer = () => {
      updateState();
    };

    structMap.observeDeep(observer);

    return () => {
      structMap.unobserveDeep(observer);
    };
  }, [ydoc]);

  const findIndexInYArray = (yArray: Y.Array<string>, targetId: string): number => {
    let index = 0;
    for (const item of yArray) {
      if (item === targetId) return index;
      index++;
    }
    return -1;
  };

  /**
   * ノードをツリー構造に追加
   * @param parentId 親ID (ルートなら PARENT_ID_ROOT)
   * @param nodeId 追加するノードのID
   * @param index 挿入位置 (省略時は末尾)
   */
  const registerNodeToTree = useCallback((parentId: string, nodeId: string, index?: number) => {
    if (!ydoc) return;
    const structMap = ydoc.getMap<Y.Array<string>>('planStructure');

    ydoc.transact(() => {
      let parentArray = structMap.get(parentId);
      if (!parentArray) {
        parentArray = new Y.Array();
        structMap.set(parentId, parentArray);
      }

      if (findIndexInYArray(parentArray, nodeId) !== -1) {
        console.warn(`[registerNodeToTree] Node ${nodeId} already exists in parent ${parentId}`);
        return;
      }

      const targetIndex = (index !== undefined && index >= 0 && index <= parentArray.length)
        ? index
        : parentArray.length;

      parentArray.insert(targetIndex, [nodeId]);
    });
  }, [ydoc]);

  //ノードをツリーから削除
  const unregisterNodeFromTree = useCallback((parentId: string, nodeId: string) => {
    if (!ydoc) return;
    const structMap = ydoc.getMap<Y.Array<string>>('planStructure');

    ydoc.transact(() => {
      const parentArray = structMap.get(parentId);
      if (!parentArray) return;

      const targetIndex = findIndexInYArray(parentArray, nodeId);
      if (targetIndex !== -1) {
        parentArray.delete(targetIndex, 1);
      } else {
        console.warn(`[unregisterNodeFromTree] Node ${nodeId} not found in parent ${parentId}`);
      }

      if (parentArray.length === 0) {
        structMap.delete(parentId);
      }
    });
  }, [ydoc]);

  const moveNodeInTree = useCallback((
    nodeId: string,
    fromParentId: string,
    toParentId: string,
    newIndex: number
  ) => {
    if (!ydoc) return;

    ydoc.transact(() => {
      const structMap = ydoc.getMap<Y.Array<string>>('planStructure');
      const targetArray = structMap.get(toParentId);
      const currentIndex = targetArray ? findIndexInYArray(targetArray, nodeId) : -1;

      let adjustedIndex = newIndex;
      
      // 移動先に自分が存在し（oldIndex != -1）、かつ後ろ（old < new）へ移動する場合のみ補正
      if (currentIndex !== -1 && currentIndex < newIndex) {
        adjustedIndex -= 1;
      }

      unregisterNodeFromTree(fromParentId, nodeId);
      registerNodeToTree(toParentId, nodeId, adjustedIndex);

    });
  }, [ydoc, unregisterNodeFromTree, registerNodeToTree]);

  return {
    structure,
    registerNodeToTree,
    unregisterNodeFromTree,
    moveNodeInTree
  }
}