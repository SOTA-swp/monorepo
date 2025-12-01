import React, { useMemo, useEffect, useRef, useState } from 'react';

// import {
//   DndContext,
//   closestCenter,
//   KeyboardSensor,
//   PointerSensor,
//   useSensor,
//   useSensors,
//   DragEndEvent
// } from '@dnd-kit/core';
// import {
//   arrayMove,
//   SortableContext,
//   sortableKeyboardCoordinates,
//   verticalListSortingStrategy
// } from '@dnd-kit/sortable';

import { PlanNode, NodeType, PARENT_ID_ROOT } from '@/features/editor/types/node';
import { TreeNode } from './TreeNode';
import { getSortedFlatNodes, FlatPlanNode } from '@/features/editor/utils/treeUtils';
import { MoveNodeForm } from './MoveNodeForm';

interface PlanTreeProps {
  nodes: PlanNode[]; // フラットな全ノードリスト
  onAdd: (parentId: string | null, type: NodeType, name: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<PlanNode>) => void;
}

const isDescendant = (sourceId: string, targetParentId: string | null, allNodes: PlanNode[]): boolean => {
  if (!targetParentId || targetParentId === PARENT_ID_ROOT) return false;

  let currentId: string | null = targetParentId;

  // 親を辿ってルートまで探索
  while (currentId && currentId !== PARENT_ID_ROOT) {
    if (currentId === sourceId) return true; // アウト！

    const node = allNodes.find(n => n.id === currentId);
    if (!node) break; // データ不整合
    currentId = node.parentId ?? null;
  }

  return false;
};

export const PlanTree = ({ nodes, onAdd, onDelete, onUpdate }: PlanTreeProps) => {
  // ルート要素（親がいないノード）のみを抽
  const rootNodes = nodes.filter(n => n.parentId === PARENT_ID_ROOT);
  // ▼▼▼ デバッグ用: 初回ロード時に全ノードの順序をログ出力 ▼▼▼
  const hasLoggedRef = useRef(false);

  useEffect(() => {
    // ノードデータが読み込まれていて、かつまだログを出していない場合のみ実行
    if (nodes.length > 0) {
      console.group('📊 Initial Node Orders (Debug)');
      // 見やすいようにテーブル形式で出力
      console.table(
        nodes
          .map(n => ({
            name: n.name,
            order: n.displayOrder, // ここが重要
            parentId: n.parentId ?? 'root',
            id: n.id,
          }))
          // ログ上でも見やすいように displayOrder 順にソートしておく
          .sort((a, b) => a.order - b.order)
      );
      console.groupEnd();

    }
  }, [nodes]);
  // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

  // ▼▼▼ 【追加】 データ正規化（修理）用関数 ▼▼▼
  const handleNormalizeOrders = () => {
    if (!confirm('全てのノードの並び順を整理・修復しますか？')) return;

    // 1. 親ごとにグループ分け
    const groups = new Map<string, PlanNode[]>();
    nodes.forEach(node => {
      const pId = node.parentId ?? 'root';
      if (!groups.has(pId)) groups.set(pId, []);
      groups.get(pId)?.push(node);
    });

    // 2. 各グループ内で、現在の「なんとなくの並び順（配列順）」を正として連番を振る
    groups.forEach(siblings => {
      // displayOrderが同じだとsortが不安定になるので、idも使って固定化する
      siblings.sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
        return a.id.localeCompare(b.id); // orderが同じならID順で強制決定
      });

      // 連番を割り当てて更新 (0, 1000, 2000, ...)
      siblings.forEach((node, index) => {
        const newOrder = (index + 1) * 1000;
        // 値が違う場合のみ更新（無駄な通信を防ぐ）
        if (node.displayOrder !== newOrder) {
          console.log(`Fixing order for ${node.name}: ${node.displayOrder} -> ${newOrder}`);
          onUpdate(node.id, { displayOrder: newOrder });
        }
      });
    });
  };
  // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
  const flatNodes = useMemo<FlatPlanNode[]>(() => getSortedFlatNodes(nodes), [nodes]);
  const [showMoveForm, setShowMoveForm] = useState(false);

  const handleExecuteMove = (targetId: string, parentId: string | null, position: string, referenceId?: string) => {
    const targetParentId = parentId ?? PARENT_ID_ROOT;
    const siblings = nodes
      .filter((n: PlanNode) => {
        const pId = n.parentId ?? PARENT_ID_ROOT;
        return pId === targetParentId && n.id !== targetId;
      })
      .sort((a: PlanNode, b: PlanNode) => a.displayOrder - b.displayOrder);

    let newOrder = 0;

    if (position === 'first') {
      if (siblings.length > 0) {
        newOrder = siblings[0].displayOrder - 200;
      } else {
        newOrder = 1000;
      }
    }
    else if (position === 'last') {
      if (siblings.length > 0) {
        newOrder = siblings[siblings.length - 1].displayOrder + 200;
      } else {
        newOrder = 1000;
      }
    }
    else if ((position === 'before' || position === 'after') && referenceId) {
      const refIndex = siblings.findIndex(n => n.id === referenceId);
      if (refIndex === -1) {
        alert('基準となるノードが見つかりませんでした');
        return;
      }
      const refNode = siblings[refIndex];

      if (position === 'before') {
        const prevNode = siblings[refIndex - 1];
        const prevOrder = prevNode ? prevNode.displayOrder : refNode.displayOrder - 200;
        newOrder = (prevOrder + refNode.displayOrder) / 2;
      } else {
        const nextNode = siblings[refIndex + 1];
        const nextOrder = nextNode ? nextNode.displayOrder : refNode.displayOrder + 200;
        newOrder = (nextOrder + refNode.displayOrder) / 2;
      }
    }

    console.log(`[Move] ${targetId} -> Parent:${targetParentId}, Order:${newOrder}`);
    onUpdate(targetId, {
      parentId: targetParentId,
      displayOrder: newOrder
    });

    setShowMoveForm(false);
  };

  // const sensors = useSensors(
  //   useSensor(PointerSensor, {
  //     activationConstraint: {
  //       distance: 5, // 5px以上動かさないとドラッグを開始しない
  //     }
  //   }),
  //   useSensor(KeyboardSensor, {
  //     coordinateGetter: sortableKeyboardCoordinates,
  //   })
  // );

  // ドラッグ終了時の処理
  // const handleDragEnd = (event: DragEndEvent) => {
  //   const { active, over } = event;

  //   if (!over || active.id === over.id) return;
  //   const oldIndex = items.indexOf(active.id as string);
  //   const newIndex = items.indexOf(over.id as string);

  //   const movedNode = flatNodes[oldIndex];
  //   const targetNode = flatNodes[newIndex];

  //   if (!movedNode || !targetNode) return;

  //   const isMovingDown = oldIndex < newIndex;

  //   let newParentId = targetNode.parentId ?? PARENT_ID_ROOT;

  //   if (movedNode.id === newParentId || isDescendant(movedNode.id, newParentId, nodes)) {
  //     console.warn("自分自身の子孫階層には移動できません（循環参照防止）");
  //     return; // 処理を中止
  //   }


  //   const siblings = nodes
  //     .filter(n => (n.parentId ?? PARENT_ID_ROOT) === newParentId && n.id !== movedNode.id)
  //     .sort((a, b) => a.displayOrder - b.displayOrder);

  //   const targetSiblingIndex = siblings.findIndex(s => s.id === targetNode.id);
  //   let prevOrder: number;
  //   let nextOrder: number;

  //   if (isMovingDown) {
  //     // 下に移動したなら、ターゲットの「後ろ」に入れたい
  //     // Prev = Target, Next = Targetの次
  //     const prevNode = siblings[targetSiblingIndex];
  //     const nextNode = siblings[targetSiblingIndex + 1];

  //     prevOrder = prevNode ? prevNode.displayOrder : targetNode.displayOrder; 
  //     // 次がない(末尾)なら、prev + 200
  //     nextOrder = nextNode ? nextNode.displayOrder : prevOrder + 2000;

  //   } else {
  //     // 上に移動したなら、ターゲットの「前」に入れたい
  //     // Prev = Targetの前, Next = Target
  //     const prevNode = siblings[targetSiblingIndex - 1];
  //     const nextNode = siblings[targetSiblingIndex];

  //     nextOrder = nextNode ? nextNode.displayOrder : targetNode.displayOrder;
  //     // 前がない(先頭)なら、next - 200
  //     prevOrder = prevNode ? prevNode.displayOrder : nextOrder - 2000;
  //   }

  //   const safePrev = isNaN(prevOrder) ? 0 : prevOrder;
  //   const safeNext = isNaN(nextOrder) ? 0 : nextOrder;

  //   let newOrder = (safePrev + safeNext) / 2;

  //   if (isNaN(newOrder)) {
  //     newOrder = Date.now(); // 緊急回避
  //   }

  //   // 論理: 単純な並び替えの場合、ターゲットと同じ親になり、順序が変わる
  //   // 厳密な並び替えロジックはYjsの仕様に合わせて別途実装が必要ですが、
  //   // ここでは仮実装として console.log を出力し、擬似的にOrderを更新します。

  //   console.log(`[DnD] ${movedNode.name}`);
  //   console.log(`   Direction: ${isMovingDown ? 'Down' : 'Up'}`);
  //   console.log(`   Target: ${targetNode.name} (${targetNode.displayOrder})`);
  //   console.log(`   Range: ${safePrev} <-> ${safeNext}`);
  //   console.log(`   Result: ${newOrder}`);
  //   // TODO: ここで正確な displayOrder の再計算ロジックを入れる
  //   // 仮: ターゲットの order と入れ替える（これだけだと不十分ですが動作確認用）
  //   onUpdate(movedNode.id, {
  //     parentId: targetNode.parentId, // 同じ親にする（階層移動対応の第一歩）
  //     displayOrder: targetNode.displayOrder // 順序を借りる（本来は平均値などをとる）
  //   });
  // }

  return (

    <div className="plan-tree-container">
      {/* ツールバーエリア */}
      <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* 移動モード切替ボタン */}
        <button
          onClick={() => setShowMoveForm(!showMoveForm)}
          style={{
            fontSize: '0.8rem',
            padding: '5px 10px',
            background: showMoveForm ? '#666' : '#0070f3',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {showMoveForm ? '移動ツールを閉じる' : '🔃 ノード移動ツールを開く'}
        </button>

        <button
          onClick={handleNormalizeOrders}
          style={{ fontSize: '0.8rem', padding: '5px 10px', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
        >
          🔧 並び順リセット
        </button>
      </div>

      {/* ★ 移動フォームの条件付きレンダリング */}
      {showMoveForm && (
        <MoveNodeForm
          nodes={nodes}
          onMove={handleExecuteMove}
          onCancel={() => setShowMoveForm(false)}
        />
      )}

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

      {flatNodes.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#888' }}>
          まだ計画がありません。
        </p>
      ) : (
        <div className="tree-list">
          {flatNodes.map(node => (
            <TreeNode
              key={node.id}
              node={node}
              onAdd={onAdd}
              onDelete={onDelete}
              onUpdate={onUpdate}
              depth={node.depth}
            />
          ))}
        </div>
      )}
    </div>
    // <div className="plan-tree-container">
    //   {/* ▼▼▼ 【追加】 修理ボタン（開発中のみ表示） ▼▼▼ */}
    //   {/* <div style={{ marginBottom: '10px', textAlign: 'right' }}>
    //     <button 
    //       onClick={handleNormalizeOrders}
    //       style={{ fontSize: '0.8rem', padding: '5px 10px', background: '#ffcc00', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
    //     >
    //       ⚠️ 並び順データの修復 (Reset Orders)
    //     </button>
    //   </div>
    //   ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ */}
    //   <button
    //     onClick={() => onAdd(PARENT_ID_ROOT, 'PROCESS', `新しい日程`)}
    //     style={{
    //       width: '100%',
    //       padding: '10px',
    //       marginBottom: '20px',
    //       border: '2px dashed #ccc',
    //       background: '#fafafa',
    //       cursor: 'pointer'
    //     }}
    //   >
    //     ＋ 日程を追加する (ルート)
    //   </button>

    //   {flatNodes.length === 0 ? (
    //     <p style={{ textAlign: 'center', color: '#888' }}>
    //       まだ計画がありません。
    //     </p>
    //   ) : (
    //     <div className="tree-list">
    //       {flatNodes.map(node => (
    //         <TreeNode
    //           key={node.id}
    //           node={node}
    //           onAdd={onAdd}
    //           onDelete={onDelete}
    //           onUpdate={onUpdate}
    //           depth={node.depth} // depth情報は treeUtils で計算済み
    //         />
    //       ))}
    //     </div>
    //     // <DndContext
    //     //   sensors={sensors}
    //     //   collisionDetection={closestCenter}
    //     //   onDragEnd={handleDragEnd}
    //     // >
    //       // <SortableContext
    //       //   items={items}
    //       //   strategy={verticalListSortingStrategy}
    //       // >
    //       //   {flatNodes.map(node => (
    //       //     <SortableTreeItem
    //       //       key={node.id}
    //       //       node={node}
    //       //       onAdd={onAdd}
    //       //       onDelete={onDelete}
    //       //       onUpdate={onUpdate}
    //       //     />
    //       //   ))}
    //       // </SortableContext>
    //     // </DndContext>
    //   )}
    // </div>
  );
};