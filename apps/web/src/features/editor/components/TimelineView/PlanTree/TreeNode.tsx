import React, { useState, useRef, useEffect } from 'react';
import { NodeType } from '@/features/editor/types/node';
import { FlatPlanNodeV2 } from '@/features/editor/utils/structureUtils';
import { CalculatedPlanNode, toMin, toStr } from '@/features/editor/utils/structureUtils';

interface TreeNodeProps {
  node: CalculatedPlanNode;

  onAdd: (parentId: string | null, type: NodeType, name: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: any) => void;
  depth: number;
}

export const TreeNode = ({ node, onAdd, onDelete, onUpdate, depth = 0 }: TreeNodeProps) => {

  const [isNameEditing, setIsNameEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // 時間編集用
  const [isTimeEditing, setIsTimeEditing] = useState(false);
  // フォームの一時状態
  const [formStart, setFormStart] = useState(node.startTime || '');
  const [formEnd, setFormEnd] = useState(node.endTime || '');
  const [formDuration, setFormDuration] = useState(String(node.duration || 0));

  // 外部からの変更（他人が名前を変えた時）を反映させる
  useEffect(() => {
    setEditName(node.name);
  }, [node.name]);

  // 編集モードになったら自動でフォーカスする
  useEffect(() => {
    if (isNameEditing && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isNameEditing]);

  // --- Effect: 時間編集開始時に現在の値をセット ---
  useEffect(() => {
    if (isTimeEditing) {
      setFormStart(node.startTime || '');
      setFormEnd(node.endTime || '');
      setFormDuration(String(node.duration || 0));
    }
  }, [isTimeEditing, node]);

  const handleNameSave = () => {
    if (editName.trim() && editName !== node.name) {
      onUpdate(node.id, { name: editName });
    }
    setIsNameEditing(false);
  };

  const handleTimeSave = () => {
    const newStart = formStart || undefined; // 空文字ならundefined(削除)
    const newEnd = formEnd || undefined;
    const newDur = Number(formDuration);

    const updates: any = {
      startTime: newStart,
      endTime: newEnd,
      duration: newDur
    };

    // ★スマート更新ロジック: 矛盾を避けるための自動調整
    // ケース1: Startを変更し、Endも設定されていた場合 -> Durationを保つためにEndもずらす(Move)
    if (newStart !== node.startTime && newStart && node.endTime) {
      const oldS = toMin(node.startTime);
      const newS = toMin(newStart);
      const oldE = toMin(node.endTime);
      if (oldS !== null && newS !== null && oldE !== null) {
        const diff = newS - oldS;
        updates.endTime = toStr(oldE + diff);
      }
    }

    // ケース2: Durationを変更し、Start/End両方あった場合 -> Endを削除してStart基準にする
    if (newDur !== node.duration && newStart && newEnd) {
      // ユーザーが意図してDurationを変えたので、過剰拘束を解くためにEndを捨てる
      updates.endTime = undefined;
    }

    onUpdate(node.id, updates);
    setIsTimeEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleNameSave();
    if (e.key === 'Escape') {
      setEditName(node.name); // キャンセル
      setIsNameEditing(false);
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

  const timeStyle = {
    fontSize: '0.75rem',
    color: '#666',
    marginRight: '8px',
    fontFamily: 'monospace',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    lineHeight: '1.1'
  };

  // 警告判定
  const isConflict = node.gapFromPrev < 0;
  const isWarning = node.isOutOfParentRange || node.hasInternalMismatch;

  return (
    <div style={{ marginLeft: depth * 20, marginBottom: '5px' }}>

      {/* ギャップ表示 */}
      {node.gapFromPrev > 0 && (
        <div style={{ fontSize: '0.7rem', color: '#888', marginLeft: '10px', borderLeft: '2px dotted #ccc', paddingLeft: '5px' }}>
          ☕️ {node.gapFromPrev}分 待ち
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', padding: '8px',
        border: '1px solid #ddd', borderRadius: '4px',
        borderColor: isConflict ? 'red' : '#ddd',
        backgroundColor: isWarning ? '#fff5f5' : getStyles().backgroundColor,
        ...getStyles()
      }}>

        {/* 時刻表示 */}
        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '45px' }}>
          <span style={{ fontWeight: node.isFixedStart ? 'bold' : 'normal', color: isConflict ? 'red' : 'inherit' }}>
            {node.displayStartTime}
          </span>
          <span style={{ fontSize: '0.65rem', opacity: 0.8, fontWeight: node.isFixedEnd ? 'bold' : 'normal' }}>
            ↓ {node.displayEndTime}
          </span>
        </div>

        {/* 名前 & 情報 */}
        <div style={{ flex: 1 }}>
          {isNameEditing ? (
            <input
              ref={nameInputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
              style={{ width: '100%' }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span onClick={() => setIsNameEditing(true)} style={{ cursor: 'text', fontWeight: 'bold' }}>
                {node.name}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#666' }}>
                ⏱ {node.displayDuration}分
                {node.isFixedStart && <span title="開始固定"> 📌</span>}
                {node.isFixedEnd && <span title="終了固定"> ⚓</span>}
                {node.hasInternalMismatch && <span style={{ color: 'red' }}> ⚠️矛盾</span>}
              </span>
            </div>
          )}
        </div>

        {/* ボタン類 */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setIsTimeEditing(!isTimeEditing); }}
            style={{ fontSize: '0.7rem', cursor: 'pointer', background: isTimeEditing ? '#ddd' : '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          >
            ⏱
          </button>
          <button onClick={(e) => { e.stopPropagation(); onAdd(node.id, 'SPOT', '地点'); }} style={{ fontSize: '0.7rem' }}>＋</button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} style={{ fontSize: '0.7rem', color: 'red', border: 'none', background: 'none' }}>🗑️</button>
        </div>
      </div>

      {/* ▼▼▼ 時間編集フォーム (インライン表示) ▼▼▼ */}
      {isTimeEditing && (
        <div style={{
          marginTop: '4px', padding: '10px', background: '#f0f0f0',
          borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.8rem'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px', alignItems: 'center' }}>

            <label>開始 (Start):</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              <input type="time" value={formStart} onChange={e => setFormStart(e.target.value)} />
              <button onClick={() => setFormStart('')} style={{ fontSize: '0.7rem' }}>クリア</button>
            </div>

            <label>終了 (End):</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              <input type="time" value={formEnd} onChange={e => setFormEnd(e.target.value)} />
              <button onClick={() => setFormEnd('')} style={{ fontSize: '0.7rem' }}>クリア</button>
            </div>

            <label>所要 (Min):</label>
            <input type="number" value={formDuration} onChange={e => setFormDuration(e.target.value)} style={{ width: '60px' }} />

          </div>

          <div style={{ marginTop: '10px', textAlign: 'right', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={() => setIsTimeEditing(false)}>キャンセル</button>
            <button onClick={handleTimeSave} style={{ background: '#0070f3', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px' }}>保存</button>
          </div>
        </div>
      )}

      {/* 親枠はみ出し警告 */}
      {node.isOutOfParentRange && (
        <div style={{ fontSize: '0.7rem', color: 'red', textAlign: 'right' }}>⚠️ 親の時間枠を超過</div>
      )}
    </div>
    // <div style={{ marginLeft: depth * 20, marginBottom: '5px' }}>
    //   {/* ノード本体の表示エリア */}
    //   <div style={{
    //     display: 'flex',
    //     alignItems: 'center',
    //     gap: '10px',
    //     padding: '8px',
    //     border: '1px solid #ddd',
    //     borderRadius: '4px',
    //     ...getStyles() // スタイル適用
    //   }}>
    //     {/* タイプバッジ */}
    //     <span style={{ fontSize: '0.8rem', padding: '2px 6px', background: '#333', color: '#fff', borderRadius: '4px' }}>
    //       {node.type}
    //     </span>

    //     {/* ▼▼▼ 編集ロジック ▼▼▼ */}
    //     <div style={{ flex: 1 }}>
    //       {isEditing ? (
    //         <input
    //           ref={inputRef}
    //           type="text"
    //           value={editName}
    //           onChange={(e) => setEditName(e.target.value)}
    //           onBlur={handleSave} // フォーカスが外れたら保存
    //           onKeyDown={handleKeyDown}
    //           style={{ width: '100%', padding: '4px', fontSize: 'inherit' }}
    //         />
    //       ) : (
    //         <span
    //           onClick={() => setIsEditing(true)} // クリックで編集開始
    //           style={{ cursor: 'text', display: 'inline-block', width: '100%', minHeight: '1.2em' }}
    //           title="クリックして編集"
    //         >
    //           {node.name}
    //         </span>
    //       )}
    //     </div>
    //     {/* ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ */}

    //     {/* 名前 */}
    //     <span style={{ flex: 1 }}>{node.name}</span>

    //     {/* 操作ボタン群 */}
    //     {/* DAYタイプなら、子供（SPOT）を追加できるボタンを表示 */}
    //     <button
    //       onClick={(e) => {
    //         e.stopPropagation();
    //         onAdd(node.id, 'SPOT', '新しいスポット')
    //       }}
    //       style={{ fontSize: '0.8rem', cursor: 'pointer' }}
    //       title="この下に子ノードを追加"
    //     >
    //       ＋地点追加
    //     </button>


    //     <button
    //       onClick={(e) => {
    //         e.stopPropagation();
    //         onDelete(node.id)
    //       }
    //       }
    //       style={{ fontSize: '0.8rem', color: 'red', cursor: 'pointer', border: 'none', background: 'none' }}
    //     >
    //       削除
    //     </button>
    //   </div>
    // </div>
  );
}