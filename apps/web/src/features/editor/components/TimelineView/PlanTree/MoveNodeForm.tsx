import React, { useState, useMemo } from 'react';
import { PARENT_ID_ROOT, PlanNodeData } from '@/features/editor/types/node';
import { FlatPlanNodeV2 } from '@/features/editor/utils/structureUtils';

interface MoveNodeFormProps {
  nodes: FlatPlanNodeV2[];
  onMove: (targetId: string, parentId: string | null, position: string, referenceId?: string) => void;
  onCancel: () => void;
}

const isDescendant = (sourceId: string, targetParentId: string | null, allNodes: FlatPlanNodeV2[]): boolean => {
  if (!targetParentId || targetParentId === PARENT_ID_ROOT) return false;
  let currentId: string | null = targetParentId;
  while (currentId && currentId !== PARENT_ID_ROOT) {
    if (currentId === sourceId) return true;
    const node = allNodes.find(n => n.id === currentId);
    if (!node) break;
    currentId = node.parentId ?? null;
  }
  return false;
};

export const MoveNodeForm = ({ nodes, onMove, onCancel }: MoveNodeFormProps) => {
  const [targetId, setTargetId] = useState<string>('');
  const [parentId, setParentId] = useState<string>(PARENT_ID_ROOT);
  const [position, setPosition] = useState<'first' | 'last' | 'before' | 'after'>('last');
  const [referenceId, setReferenceId] = useState<string>('');

  const validParents = useMemo(() => {
    if (!targetId) return [];
    return nodes.filter(n => {
      if (n.id === targetId) return false;
      if (isDescendant(targetId, n.id, nodes)) return false;
      if (n.type !== 'PROCESS') return false;
      return true;
    });
  }, [nodes, targetId]);

  const siblings = useMemo(() => {
    const pId = parentId === PARENT_ID_ROOT ? PARENT_ID_ROOT : parentId;
    return nodes
      .filter(n => (n.parentId ?? PARENT_ID_ROOT) === pId && n.id !== targetId);
  }, [nodes, parentId, targetId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) return alert('移動させるノードを選択してください');

    const finalParentId = parentId === PARENT_ID_ROOT ? null : parentId;

    onMove(targetId, finalParentId, position, referenceId);
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ padding: '15px', background: '#f9f9f9', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '20px' }}
    >
      <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>🔧 ノード移動ツール</h3>

      {/* 1. 移動対象の選択 */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>移動するノード:</label>
        <select
          value={targetId}
          onChange={e => setTargetId(e.target.value)}
          style={{ width: '100%', padding: '5px' }}
        >
          <option value="">-- 選択してください --</option>
          {nodes.map(n => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
      </div>

      {targetId && (
        <>
          {/* 2. 移動先の親の選択 */}
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>新しい親フォルダ:</label>
            <select
              value={parentId}
              onChange={e => setParentId(e.target.value)}
              style={{ width: '100%', padding: '5px' }}
            >
              <option value={PARENT_ID_ROOT}>ROOT (最上位)</option>
              {validParents.map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>

          {/* 3. 位置の指定 */}
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>配置位置:</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select
                value={position}
                onChange={e => setPosition(e.target.value as any)}
                style={{ flex: 1, padding: '5px' }}
              >
                <option value="last">末尾に追加 (Last)</option>
                <option value="first">先頭に追加 (First)</option>
                {siblings.length > 0 && (
                  <>
                    <option value="before">〜の前 (Before)</option>
                    <option value="after">〜の後 (After)</option>
                  </>
                )}
              </select>

              {/* 4. 基準ノードの選択 (Before/Afterの時のみ) */}
              {(position === 'before' || position === 'after') && (
                <select
                  value={referenceId}
                  onChange={e => setReferenceId(e.target.value)}
                  style={{ flex: 1, padding: '5px' }}
                  required
                >
                  <option value="">-- 基準ノード --</option>
                  {siblings.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{ flex: 1, padding: '8px', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              style={{ flex: 2, padding: '8px', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              実行
            </button>
          </div>
        </>
      )}
    </form>
  );
}

