import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FlatPlanNode } from '@/features/editor/utils/treeUtils';
import { TreeNode } from './TreeNode';
import { NodeType } from '@/features/editor/types/node';

interface SortableTreeItemProps {
  node: FlatPlanNode;
  onAdd: (parentId: string, type: NodeType, name: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: any) => void;
}

export const SortableTreeItem = (props: SortableTreeItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: props.node.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 999 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {/* TreeNodeにドラッグハンドル(listeners)を渡すか、
        あるいは行全体をドラッグ可能にするためにここで展開するか。
        今回は「行全体をドラッグ可能」にします。
      */}
      <div {...listeners}>
        <TreeNode
          node={props.node}
          // allNodesはもうTreeNode内で使わないので渡さなくて良い（後述）
          onAdd={props.onAdd}
          onDelete={props.onDelete}
          onUpdate={props.onUpdate}
          depth={props.node.depth} // 計算済みのdepthを渡す
        />
      </div>
    </div>
  )
}