import React from 'react';
import { PlanNode, NodeType } from '@/features/editor/types/node';
import { TreeNode } from './TreeNode';
import { PARENT_ID_ROOT } from '@/features/editor/types/node'; // インポート

interface PlanTreeProps {
  nodes: PlanNode[]; // フラットな全ノードリスト
  onAdd: (parentId: string | null, type: NodeType, name: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<PlanNode>) => void;
}

export const PlanTree = ({ nodes, onAdd, onDelete, onUpdate }: PlanTreeProps) => {
  // ルート要素（親がいないノード）のみを抽出
  const rootNodes = nodes.filter(n => n.parentId === PARENT_ID_ROOT);

  return (
    <div className="plan-tree-container">
      {/* ルート要素の追加ボタン */}
      <button
        onClick={() => onAdd(PARENT_ID_ROOT, 'PROCESS', `新しい日程`)}
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '20px',
          border: '2px dashed #ccc',
          background: '#fafafa',
          cursor: 'pointer'
        }}
      >
        ＋ 日程を追加する (ルート)
      </button>

      {/* ルートノードの描画 */}
      {rootNodes.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#888' }}>
          まだ計画がありません。「日程を追加」ボタンを押して開始しましょう。
        </p>
      ) : (
        rootNodes.map(rootNode => (
          <TreeNode
            key={rootNode.id}
            node={rootNode}
            allNodes={nodes} // 全ノードを渡す（子供探しの辞書として使う）
            onAdd={onAdd}
            onDelete={onDelete}
            onUpdate={onUpdate}
            depth={0} // ルートなので深さは0
          />
        ))
      )}
    </div>
  );
};