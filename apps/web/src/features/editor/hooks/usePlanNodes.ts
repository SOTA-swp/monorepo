import { useState, useEffect, useCallback } from 'react';
import * as Y from 'yjs';
import { v4 as uuidv4 } from 'uuid'; // UUID生成
import { PlanNode, NodeType } from '@/features/editor/types/node';
import { PARENT_ID_ROOT } from '@/features/editor/types/node'; // インポート

export const usePlanNodes = (ydoc: Y.Doc | null) => {
  const [nodes, setNodes] = useState<PlanNode[]>([]);

  useEffect(() => {
    if (!ydoc) return;

    const yMap = ydoc.getMap<PlanNode>('planNodes');

    // データ変換関数: Y.Map -> PlanNode[]
    const updateState = () => {
      const nodeArray = Array.from(yMap.values());
      nodeArray.sort((a, b) => a.displayOrder - b.displayOrder);

      setNodes(nodeArray);
    };

    // 初回ロード
    updateState();

    const observer = () => {
      updateState();
    };

    yMap.observe(observer);

    return () => {
      yMap.unobserve(observer);
    };
  }, [ydoc]);

  const addNode = useCallback((
    parentId: string | null,
    type: NodeType,
    name: string,
    extraData: { locationId?: string; startTime?: string } = {}
  ) => {
    if (!ydoc) return;

    const yMap = ydoc.getMap<PlanNode>('planNodes');

    ydoc.transact(() => {
      const id = uuidv4();

      const siblings = Array.from(yMap.values()).filter(n => n.parentId === parentId);
      const maxOrder = siblings.length > 0
        ? Math.max(...siblings.map(n => n.displayOrder))
        : 0;

      const newNode: PlanNode = {
        id,
        parentId,
        type,
        name,
        displayOrder: maxOrder + 1000,
        timeType: 'NONE',
        ...extraData,
      };

      yMap.set(id, newNode);
    });
  }, [ydoc]);

  const deleteNode = useCallback((nodeId: string) => {
    if (!ydoc) return;
    const yMap = ydoc.getMap<PlanNode>('planNodes');
    const allNodes = Array.from(yMap.values());

    ydoc.transact(() => {

      const deleteRecursively = (id: string) => {
        
        const children = allNodes.filter(n => n.parentId === id);

        children.forEach(child => {
          deleteRecursively(child.id);
        });

        if (yMap.has(id)) {
          yMap.delete(id);
        }
      };
      deleteRecursively(nodeId);
    });
  }, [ydoc]);

  const updateNode = useCallback((nodeId: string, updates: Partial<PlanNode>) => {
    if (!ydoc) return;
    const yMap = ydoc.getMap<PlanNode>('planNodes');

    ydoc.transact(() => {
      const existingNode = yMap.get(nodeId);
      if (existingNode) {
        const updatedNode = { ...existingNode, ...updates };
        yMap.set(nodeId, updatedNode);
      }
    });
  }, [ydoc]);

  return {
    nodes,
    addNode,
    deleteNode,
    updateNode
  };
};