import { PlanNodeData, PARENT_ID_ROOT } from '@/features/editor/types/node';

export interface FlatPlanNodeV2 extends PlanNodeData {
  depth: number;
  parentId: string;
}

/**
 * 構造マップとデータマップを結合し、フラットなツリーリストを生成する
 * * @param structure 親IDをキーとし、子IDのリストを値とするマップ { "root": ["A", "B"], "A": ["C"] }
 * @param nodeMap IDをキーとし、ノードの実体データとするマップ { "A": { name: "..." } }
 * @returns UI描画用のフラット配列
 */

export const buildFlatTreeV2 = (
  structure: Record<string,string[]>,
  nodeMap: Record<string, PlanNodeData>
): FlatPlanNodeV2[] =>{
  const result: FlatPlanNodeV2[] = [];

  const visited = new Set<string>();

  const traverse = (parentId: string, currentDepth: number) => {
    const childrenIds = structure[parentId];

    if (!childrenIds || childrenIds.length === 0) return;

    for (const childId of childrenIds) {
      if (visited.has(childId)) {
        console.warn(`[structureUtils] Circular reference or Duplicate detected: ${childId}`);
        continue;
      }

      const nodeData = nodeMap[childId];
      if(!nodeData) {
        continue;
      }

      visited.add(childId);

      result.push({
        ...nodeData,
        depth: currentDepth,
        parentId: parentId,
      });

      traverse(childId, currentDepth + 1);
    }
  };

  traverse(PARENT_ID_ROOT, 0);

  return result;
};