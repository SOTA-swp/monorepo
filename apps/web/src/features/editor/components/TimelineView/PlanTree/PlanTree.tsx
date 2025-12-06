import React, { useMemo, useState } from 'react';

import { PlanNodeData, NodeType, PARENT_ID_ROOT } from '@/features/editor/types/node';
import { TreeNode } from './TreeNode';
import { MoveNodeForm } from './MoveNodeForm';
import { v4 as uuidv4 } from 'uuid'; // ID生成用
import { buildFlatTreeV2, FlatPlanNodeV2 } from '@/features/editor/utils/structureUtils';

interface PlanTreeProps {
  nodeMap: Record<string, PlanNodeData>;
  structure: Record<string, string[]>;

  onCreateNode: (id: string, type: NodeType, name: string) => void;
  onUpdateNode: (id: string, updates: Partial<PlanNodeData>) => void;
  onDeleteNode: (id: string) => void;

  onRegisterTree: (parentId: string, nodeId: string, index?: number) => void;
  onUnregisterTree: (parentId: string, nodeId: string) => void;
  onMoveTree: (nodeId: string, fromParentId: string, toParentId: string, newIndex: number) => void;
}


export const PlanTree = ({
  nodeMap, structure,
  onCreateNode, onUpdateNode, onDeleteNode,
  onRegisterTree, onUnregisterTree, onMoveTree
}: PlanTreeProps) => {
  const flatNodes = useMemo<FlatPlanNodeV2[]>(() => {
    return buildFlatTreeV2(structure, nodeMap);
  }, [structure, nodeMap]);

  const [showMoveForm, setShowMoveForm] = useState(false);

  const handleAdd = (parentId: string | null, type: NodeType, name: string) => {
    const id = uuidv4();
    const pid = parentId ?? PARENT_ID_ROOT;

    onCreateNode(id, type, name);
    onRegisterTree(pid, id);
  };

  const handleDelete = (id: string) => {
    const target = flatNodes.find(n => n.id === id);
    if (!target) return;

    if (!confirm('削除しますか？ (子要素も構造から外れます)')) {
      return;
    }

    const idsToDelete = new Set<string>();

    const collectDescendants = (parentId: string) => {
      idsToDelete.add(parentId);
      const children = structure[parentId];
      if (children && children.length > 0) {
        children.forEach(childId => {
          collectDescendants(childId);
        });
      }
    };

    collectDescendants(id);

    //ツリーから登録解除(!!!!現状は親ツリーからターゲットの情報を消すだけなので、ターゲットが親となるY.Arrayは残る（ごみになる）)
    onUnregisterTree(target.parentId, id);
    //データ削除（こっちは子孫までちゃんと消す）
    idsToDelete.forEach(deleteId => {
      onDeleteNode(deleteId);
    });
  };
  
  const handleUpdate = (id: string, updates: any) => {
    onUpdateNode(id, updates);
  };

  const handleExecuteMove = (targetId: string, parentId: string | null, position: string, referenceId?: string) => {
    const targetParentId = parentId ?? PARENT_ID_ROOT;

    // 現在の親を取得 (flatNodesから検索)
    const currentNode = flatNodes.find(n => n.id === targetId);
    if (!currentNode) return;
    const fromParentId = currentNode.parentId;

    // 移動先の子供リストを取得 (Y.Arrayの中身と同じ順序)
    const siblings = structure[targetParentId] || [];

    let newIndex = 0;

    // 位置計算ロジック (Index Calculation)
    if (position === 'first') {
      newIndex = 0;
    }
    else if (position === 'last') {
      newIndex = siblings.length; // 末尾 = 長さと同じ
    }
    else if ((position === 'before' || position === 'after') && referenceId) {
      const refIndex = siblings.indexOf(referenceId);
      if (refIndex === -1) {
        alert('基準ノードが見つかりません');
        return;
      }

      if (position === 'before') {
        newIndex = refIndex; // 前 = そのままのインデックス
      } else {
        newIndex = refIndex + 1; // 後 = インデックス + 1
      }
    }

    console.log(`[Move V2] ${targetId} -> Parent:${targetParentId}, Index:${newIndex}`);

    // 実行 (moveNodeInTree内で SameParent かどうか分岐判定される)
    onMoveTree(targetId, fromParentId, targetParentId, newIndex);

    setShowMoveForm(false);
  };

  return (

    <div className="plan-tree-container">
      {/* ツールバー */}
      <div style={{ marginBottom: '10px', textAlign: 'right' }}>
        <button
          onClick={() => setShowMoveForm(!showMoveForm)}
          style={{
            fontSize: '0.8rem',
            padding: '5px 10px',
            background: showMoveForm ? '#666' : '#0070f3',
            color: '#fff',
            border: 'none', borderRadius: '4px', cursor: 'pointer'
          }}
        >
          {showMoveForm ? '閉じる' : '🔃 移動ツール'}
        </button>
      </div>

      {showMoveForm && (
        <MoveNodeForm
          nodes={flatNodes}
          onMove={handleExecuteMove}
          onCancel={() => setShowMoveForm(false)}
        />
      )}

      <button
        onClick={() => handleAdd(PARENT_ID_ROOT, 'PROCESS', `新しい日程`)}
        style={{ width: '100%', padding: '10px', marginBottom: '20px', border: '2px dashed #ccc', background: '#fafafa', cursor: 'pointer' }}
      >
        ＋ 日程を追加する (ルート)
      </button>

      <div className="tree-list">
        {flatNodes.map(node => (
          <TreeNode
            key={node.id}
            node={node}
            onAdd={handleAdd}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            depth={node.depth}
          />
        ))}
      </div>
    </div>

  );
};