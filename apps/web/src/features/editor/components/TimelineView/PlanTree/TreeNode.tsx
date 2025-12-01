import React, { useState, useRef, useEffect } from 'react';
import { PlanNode, NodeType } from '@/features/editor/types/node';

interface TreeNodeProps {
  node: PlanNode;
  onAdd: (parentId: string, type: NodeType, name: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<PlanNode>) => void;
  depth?: number;
}

export const TreeNode = ({ node, onAdd, onDelete, onUpdate, depth = 0 }: TreeNodeProps) => {

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // 外部からの変更（他人が名前を変えた時）を反映させる
  useEffect(() => {
    setEditName(node.name);
  }, [node.name]);

  // 編集モードになったら自動でフォーカスする
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editName.trim() && editName !== node.name) {
      onUpdate(node.id, { name: editName });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditName(node.name); // キャンセル
      setIsEditing(false);
    }
  };

  const getStyles = () => {
    switch (node.type) {
      // 旧 DAY のスタイルを PROCESS に適用（または階層深度 depth で色を変えるのも良い）
      case 'PROCESS':
        return { fontWeight: 'bold', backgroundColor: '#eef' };
      case 'MOVE':
        // 移動は少し特殊な見た目に（例: グレー、矢印アイコンなど）
        return { color: '#555', border: '1px dashed #999', backgroundColor: '#f9f9f9' };
      default: // SPOT
        return { backgroundColor: '#fff' };
    }
  }

  return (
    <div style={{ marginLeft: depth * 20, marginBottom: '5px' }}>
      {/* ノード本体の表示エリア */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        ...getStyles() // スタイル適用
      }}>
        {/* タイプバッジ */}
        <span style={{ fontSize: '0.8rem', padding: '2px 6px', background: '#333', color: '#fff', borderRadius: '4px' }}>
          {node.type}
        </span>

        {/* ▼▼▼ 編集ロジック ▼▼▼ */}
        <div style={{ flex: 1 }}>
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSave} // フォーカスが外れたら保存
              onKeyDown={handleKeyDown}
              style={{ width: '100%', padding: '4px', fontSize: 'inherit' }}
            />
          ) : (
            <span
              onClick={() => setIsEditing(true)} // クリックで編集開始
              style={{ cursor: 'text', display: 'inline-block', width: '100%', minHeight: '1.2em' }}
              title="クリックして編集"
            >
              {node.name}
            </span>
          )}
        </div>
        {/* ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ */}

        {/* 名前 */}
        <span style={{ flex: 1 }}>{node.name}</span>

        {/* 操作ボタン群 */}
        {/* DAYタイプなら、子供（SPOT）を追加できるボタンを表示 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd(node.id, 'SPOT', '新しいスポット')
          }}
          style={{ fontSize: '0.8rem', cursor: 'pointer' }}
          title="この下に子ノードを追加"
        >
          ＋地点追加
        </button>


        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.id)
          }
        }
          style={{ fontSize: '0.8rem', color: 'red', cursor: 'pointer', border: 'none', background: 'none' }}
        >
          削除
        </button>
      </div>
    </div>
  );
}