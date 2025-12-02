import React, { useMemo, useEffect, useRef, useState } from 'react';

import { PlanNodeData, NodeType, PARENT_ID_ROOT } from '@/features/editor/types/node';
import { TreeNode } from './TreeNode';
import { getSortedFlatNodes, FlatPlanNode } from '@/features/editor/utils/treeUtils';
import { MoveNodeForm } from './MoveNodeForm';
import { v4 as uuidv4 } from 'uuid'; // ID生成用
import { buildFlatTreeV2, FlatPlanNodeV2 } from '@/features/editor/utils/v2/structureUtils';

interface PlanTreeProps {
  // V2 Data
  nodeMap: Record<string, PlanNodeData>;
  structure: Record<string, string[]>;

  // V2 Actions
  onCreateNode: (id: string, type: NodeType, name: string) => void;
  onUpdateNode: (id: string, updates: Partial<PlanNodeData>) => void;
  onDeleteNode: (id: string) => void;

  onRegisterTree: (parentId: string, nodeId: string, index?: number) => void;
  onUnregisterTree: (parentId: string, nodeId: string) => void;
  onMoveTree: (nodeId: string, fromParentId: string, toParentId: string, newIndex: number) => void;
  // nodes: PlanNode[]; // フラットな全ノードリスト
  // onAdd: (parentId: string | null, type: NodeType, name: string) => void;
  // onDelete: (id: string) => void;
  // onUpdate: (id: string, updates: Partial<PlanNode>) => void;
}

// const isDescendant = (sourceId: string, targetParentId: string | null, allNodes: PlanNode[]): boolean => {
//   if (!targetParentId || targetParentId === PARENT_ID_ROOT) return false;

//   let currentId: string | null = targetParentId;

//   // 親を辿ってルートまで探索
//   while (currentId && currentId !== PARENT_ID_ROOT) {
//     if (currentId === sourceId) return true; // アウト！

//     const node = allNodes.find(n => n.id === currentId);
//     if (!node) break; // データ不整合
//     currentId = node.parentId ?? null;
//   }

//   return false;
// };

export const PlanTree = ({
  nodeMap, structure,
  onCreateNode, onUpdateNode, onDeleteNode,
  onRegisterTree, onUnregisterTree, onMoveTree
}: PlanTreeProps) => {
  // 1. 構造とデータを結合してフラットリストを作成 (重複排除済み)
  const flatNodes = useMemo<FlatPlanNodeV2[]>(() => {
    return buildFlatTreeV2(structure, nodeMap);
  }, [structure, nodeMap]);

  const [showMoveForm, setShowMoveForm] = useState(false);

  const handleAdd = (parentId: string | null, type: NodeType, name: string) => {
    const id = uuidv4();
    const pid = parentId ?? PARENT_ID_ROOT;

    // 1. データ作成
    onCreateNode(id, type, name);
    // 2. ツリー登録 (末尾に追加)
    onRegisterTree(pid, id);
  };

  // --- ラッパー関数: 削除 ---
  const handleDelete = (id: string) => {
    // 親を探す必要がある (flatNodesから検索)
    const target = flatNodes.find(n => n.id === id);
    if (!target) return;

    if (!confirm('削除しますか？ (子要素も構造から外れます)')) {
      return;
    }

    const idsToDelete = new Set<string>();

    const collectDescendants = (parentId: string) => {
      // 自分をリストに追加
      idsToDelete.add(parentId);

      // 構造マップから子供たちを取得
      const children = structure[parentId];
      if (children && children.length > 0) {
        children.forEach(childId => {
          collectDescendants(childId);
        });
      }
    };

    // 収集開始
    collectDescendants(id);

    //ツリーから登録解除(!!!!現状は親ツリーからターゲットの情報を消すだけなので、ターゲットが親となるY.Arrayは残る（ごみになる）)
    onUnregisterTree(target.parentId, id);
    //データ削除（こっちは子孫までちゃんと消す）
    idsToDelete.forEach(deleteId => {
      onDeleteNode(deleteId);
    });
  };

  // --- ラッパー関数: 更新 ---
  const handleUpdate = (id: string, updates: any) => {
    onUpdateNode(id, updates);
  };

  // ▼▼▼ 論理コア: 新しい移動ロジック (Index Base) ▼▼▼
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
  // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲


  // useEffect(() => {
  //   // ノードデータが読み込まれていて、かつまだログを出していない場合のみ実行
  //   if (nodes.length > 0) {
  //     console.group('📊 Initial Node Orders (Debug)');
  //     // 見やすいようにテーブル形式で出力
  //     console.table(
  //       nodes
  //         .map(n => ({
  //           name: n.name,
  //           order: n.displayOrder, // ここが重要
  //           parentId: n.parentId ?? 'root',
  //           id: n.id,
  //         }))
  //         // ログ上でも見やすいように displayOrder 順にソートしておく
  //         .sort((a, b) => a.order - b.order)
  //     );
  //     console.groupEnd();

  //   }
  // }, [nodes]);
  // // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

  // // ▼▼▼ 【追加】 データ正規化（修理）用関数 ▼▼▼
  // const handleNormalizeOrders = () => {
  //   if (!confirm('全てのノードの並び順を整理・修復しますか？')) return;

  //   // 1. 親ごとにグループ分け
  //   const groups = new Map<string, PlanNode[]>();
  //   nodes.forEach(node => {
  //     const pId = node.parentId ?? 'root';
  //     if (!groups.has(pId)) groups.set(pId, []);
  //     groups.get(pId)?.push(node);
  //   });

  //   // 2. 各グループ内で、現在の「なんとなくの並び順（配列順）」を正として連番を振る
  //   groups.forEach(siblings => {
  //     // displayOrderが同じだとsortが不安定になるので、idも使って固定化する
  //     siblings.sort((a, b) => {
  //       if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
  //       return a.id.localeCompare(b.id); // orderが同じならID順で強制決定
  //     });

  //     // 連番を割り当てて更新 (0, 1000, 2000, ...)
  //     siblings.forEach((node, index) => {
  //       const newOrder = (index + 1) * 1000;
  //       // 値が違う場合のみ更新（無駄な通信を防ぐ）
  //       if (node.displayOrder !== newOrder) {
  //         console.log(`Fixing order for ${node.name}: ${node.displayOrder} -> ${newOrder}`);
  //         onUpdate(node.id, { displayOrder: newOrder });
  //       }
  //     });
  //   });
  // };
  // // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

  // const handleExecuteMove = (targetId: string, parentId: string | null, position: string, referenceId?: string) => {
  //   const targetParentId = parentId ?? PARENT_ID_ROOT;
  //   const siblings = nodes
  //     .filter((n: PlanNode) => {
  //       const pId = n.parentId ?? PARENT_ID_ROOT;
  //       return pId === targetParentId && n.id !== targetId;
  //     })
  //     .sort((a: PlanNode, b: PlanNode) => a.displayOrder - b.displayOrder);

  //   let newOrder = 0;

  //   if (position === 'first') {
  //     if (siblings.length > 0) {
  //       newOrder = siblings[0].displayOrder - 200;
  //     } else {
  //       newOrder = 1000;
  //     }
  //   }
  //   else if (position === 'last') {
  //     if (siblings.length > 0) {
  //       newOrder = siblings[siblings.length - 1].displayOrder + 200;
  //     } else {
  //       newOrder = 1000;
  //     }
  //   }
  //   else if ((position === 'before' || position === 'after') && referenceId) {
  //     const refIndex = siblings.findIndex(n => n.id === referenceId);
  //     if (refIndex === -1) {
  //       alert('基準となるノードが見つかりませんでした');
  //       return;
  //     }
  //     const refNode = siblings[refIndex];

  //     if (position === 'before') {
  //       const prevNode = siblings[refIndex - 1];
  //       const prevOrder = prevNode ? prevNode.displayOrder : refNode.displayOrder - 200;
  //       newOrder = (prevOrder + refNode.displayOrder) / 2;
  //     } else {
  //       const nextNode = siblings[refIndex + 1];
  //       const nextOrder = nextNode ? nextNode.displayOrder : refNode.displayOrder + 200;
  //       newOrder = (nextOrder + refNode.displayOrder) / 2;
  //     }
  //   }

  //   console.log(`[Move] ${targetId} -> Parent:${targetParentId}, Order:${newOrder}`);
  //   onUpdate(targetId, {
  //     parentId: targetParentId,
  //     displayOrder: newOrder
  //   });

  //   setShowMoveForm(false);
  // };

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
        // MoveNodeFormには flatNodes (現在の状態) を渡す必要がある
        // ※ただしMoveNodeForm内部の実装も PlanNode[] ではなく FlatPlanNodeV2[] に対応させる修正が理想
        // ここでは一旦型キャストで通すが、後でMoveNodeFormも微修正推奨
        <MoveNodeForm 
          nodes={flatNodes as any} 
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
            // TreeNodeは PlanNode型 を期待しているが、
            // FlatPlanNodeV2 は name, type, id を持っているので互換性がある
            // displayOrder がない警告が出る場合は型定義を見直すが、一旦キャスト
            node={node as any}
            onAdd={handleAdd}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            depth={node.depth}
          />
        ))}
      </div>
    </div>

    // <div className="plan-tree-container">
    //   {/* ツールバーエリア */}
    //   <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    //     {/* 移動モード切替ボタン */}
    //     <button
    //       onClick={() => setShowMoveForm(!showMoveForm)}
    //       style={{
    //         fontSize: '0.8rem',
    //         padding: '5px 10px',
    //         background: showMoveForm ? '#666' : '#0070f3',
    //         color: '#fff',
    //         border: 'none',
    //         borderRadius: '4px',
    //         cursor: 'pointer'
    //       }}
    //     >
    //       {showMoveForm ? '移動ツールを閉じる' : '🔃 ノード移動ツールを開く'}
    //     </button>

    //     <button
    //       onClick={handleNormalizeOrders}
    //       style={{ fontSize: '0.8rem', padding: '5px 10px', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
    //     >
    //       🔧 並び順リセット
    //     </button>
    //   </div>

    //   {/* ★ 移動フォームの条件付きレンダリング */}
    //   {showMoveForm && (
    //     <MoveNodeForm
    //       nodes={nodes}
    //       onMove={handleExecuteMove}
    //       onCancel={() => setShowMoveForm(false)}
    //     />
    //   )}

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
    //           depth={node.depth}
    //         />
    //       ))}
    //     </div>
    //   )}
    // </div>
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