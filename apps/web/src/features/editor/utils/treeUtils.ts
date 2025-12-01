import { PlanNode, PARENT_ID_ROOT } from '@/features/editor/types/node';

export type FlatPlanNode = PlanNode & { depth: number };

export const getSortedFlatNodes = (nodes: PlanNode[]): FlatPlanNode[] => {
  const result: FlatPlanNode[] = [];
  const childrenMap = new Map<string, PlanNode[]>();
  const visited = new Set<string>();

  nodes.forEach(node => {
    const pId = node.parentId ?? 'unassigned';
    if (!childrenMap.has(pId)) childrenMap.set(pId, []);
    childrenMap.get(pId)?.push(node);
  });

  childrenMap.forEach(siblings => {
    siblings.sort((a, b) => a.displayOrder - b.displayOrder);
  });

  const traverse = (parentId: string, currentDepth: number) => {
    const children = childrenMap.get(parentId);
    if (!children) return;

    for (const child of children) {
      if (visited.has(child.id)) {
        continue;
      }

      visited.add(child.id);
      result.push({ ...child, depth: currentDepth });
      traverse(child.id, currentDepth + 1);
    }
  };
  traverse(PARENT_ID_ROOT, 0);

  return result;
}