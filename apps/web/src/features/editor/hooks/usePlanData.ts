import { useState, useEffect, useCallback } from 'react';
import * as Y from 'yjs';
import { PlanNodeData, NodeType } from '@/features/editor/types/node';

export const usePlanData = (ydoc: Y.Doc | null) => {
  const [nodeMap, setNodeMap] = useState<Record<string, PlanNodeData>>({});

  useEffect(() => {
    if (!ydoc) return;

    const yMap = ydoc.getMap<PlanNodeData>('planNodesV2');

    const updateState = () => {
      setNodeMap(yMap.toJSON());
    };

    updateState();
    const observer = () => updateState();

    yMap.observe(observer);

    return () => {
      yMap.unobserve(observer);
    };
  }, [ydoc]);

  //新しいノードを作成
  const createNodeData = useCallback((id: string, type: NodeType, name: string, extra: any = {}) => {
    if (!ydoc) return;
    const yMap = ydoc.getMap<PlanNodeData>('planNodesV2');

    const newNode: PlanNodeData = {
      id,
      type,
      name,
      ...extra
    };

    ydoc.transact(() => {
      yMap.set(id, newNode);
    });
  }, [ydoc]);

  //ノードの中身を更新
  const updateNodeData = useCallback((id: string, updates: Partial<PlanNodeData>) => {
    if (!ydoc) return;
    const yMap = ydoc.getMap<PlanNodeData>('planNodesV2');

    ydoc.transact(() => {
      if (!yMap.has(id)) {
        console.warn(`[updateNodeData] Node not found: ${id}`);
        return;
      }
      const current = yMap.get(id);
      if (current) {
        yMap.set(id, { ...current, ...updates });
      }
    });
  }, [ydoc]);

  //ノードを削除
  const deleteNodeData = useCallback((id: string) => {
    if (!ydoc) return;
    const yMap = ydoc.getMap<PlanNodeData>('planNodesV2');

    ydoc.transact(() => {
      yMap.delete(id);
    });
  },[ydoc]);

  return {
    nodeMap,
    createNodeData,
    updateNodeData,
    deleteNodeData
  };
};