import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Header } from '@/components/Header';
import { InviteForm } from '@/features/editor/components/InviteForm';
import { usePlanNodes } from '@/features/editor/hooks/usePlanNodes';
import { PlanTree } from '@/features/editor/components/TimelineView/PlanTree/PlanTree';
import { usePlanLocations } from '@/features/editor/hooks/usePlanLocations';

import { LocationSearch } from '@/features/editor/components/LocationSearch';
import { PlanMap } from './MapView/PlanMap';
import { PARENT_ID_ROOT } from '@/features/editor/types/node';

import { usePlanData } from '@/features/editor/hooks/v2/usePlanData';
import { usePlanTree } from '@/features/editor/hooks/v2/usePlanTree';
import { migrateV1toV2 } from '@/features/editor/utils/v2/migration';

import { v4 as uuidv4 } from 'uuid';

import { buildFlatTreeV2, FlatPlanNodeV2 } from '@/features/editor/utils/v2/structureUtils';

export const PlanEditor = () => {
  const router = useRouter();
  const { planId } = router.query;

  const { user, isLoading } = useAuth();

  const [syncedList, setSyncedList] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('未接続');

  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);

  // --- Hooks ---
  // V1 (既存: まだMap用などに残しておく)
  const { nodes, addNode, deleteNode, updateNode } = usePlanNodes(ydoc);
  const { addLocation, locationMap } = usePlanLocations(ydoc);

  // ★ V2 (新規)
  const { nodeMap, createNodeData, updateNodeData, deleteNodeData } = usePlanData(ydoc);
  const { structure, registerNodeToTree, unregisterNodeFromTree, moveNodeInTree } = usePlanTree(ydoc);

  const flatNodes = useMemo<FlatPlanNodeV2[]>(() => {
    return buildFlatTreeV2(structure, nodeMap);
  }, [structure, nodeMap]);

  useEffect(() => {
    // planIdが無いときは何もしない
    if (!planId || typeof planId !== 'string') return;

    const _ydoc = new Y.Doc();
    setYdoc(_ydoc);

    return () => {
      _ydoc.destroy();
    }
  }, [planId]); // 依存配列を planId のみに絞る 

  //未ログインなら強制的にloginページに
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  //[Yjs接続] ユーザーとplanIdが確定したら実行
  useEffect(() => {
    if (!ydoc || !user || !planId || typeof planId !== 'string') return;

    //WebSocketプロバイダーの作成
    const provider = new WebsocketProvider(
      `ws://localhost:4000/ws/plan`,
      String(planId),
      ydoc
    );
    // ▼▼▼ このデバッグコードを追加してください ▼▼▼
    provider.on('connection-close', (event: any) => {
      // ここで「隠された切断理由」を無理やり暴きます
      console.log('切断されました。理由:', event?.reason);
      console.log('コード:', event?.code);
    });
    // ▲▲▲▲▲▲

    provider.on('status', (event: { status: string }) => {
      setConnectionStatus(event.status);
    });

    return () => {
      provider.disconnect();
      provider.destroy();
      ydoc.destroy();
    };
  }, [ydoc, user, planId]);

  if (isLoading || !user) {
    return <p style={{ padding: '20px ' }}>読み込み中...</p>
  }

  const safePlanId = Array.isArray(planId) ? planId[0] : planId;

  const handlePlaceSelect = (place: { name: string; address: string; lat: number; lng: number; placeId: string }) => {
    console.log('選択された場所:', place);

    // A. ロケーションデータの実体を作成 (Yjs: planLocations)
    // ※ addLocation が placeId も受け取れるように後でフックを微修正するとベストですが、
    // まずは既存の引数で対応します。
    const locationId = addLocation(place.name, place.lat, place.lng, place.address);

    if (locationId) {
      const newNodeId = uuidv4();

      // 3. V2データを作成 (中身)
      createNodeData(newNodeId, 'SPOT', place.name, { locationId });

      // 4. V2ツリー構造に登録 (構造)
      // ここではルートの末尾に追加します
      registerNodeToTree(PARENT_ID_ROOT, newNodeId);
    }
  };

  return (
    // <div style={{ padding: '20px ' }}>
    //   <Header />
    //   <h1>共同編集室（計画ID: {planId}）</h1>
    //   <div>
    //     参加者: <strong>{user.email}</strong>
    //     <div style={{ marginLeft: '20px', color: connectionStatus === 'connected' ? 'green' : 'red ' }}>
    //       接続状況
    //     </div>
    //   </div>
    //   {/* ▼▼▼ ここに追加！ ▼▼▼ */}
    //   {/* safePlanId がある時だけ表示します */}
    //   {safePlanId && (
    //     <div style={{ maxWidth: '600px', margin: '20px 0' }}>
    //       <InviteForm planId={safePlanId} />
    //     </div>
    //   )}
    //   {/* ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ */}
    //   {/* ▼▼▼ 検索フォームの配置 ▼▼▼ */}
    //   <div style={{ maxWidth: '600px', margin: '0 auto 30px' }}>
    //     <h3>📍 新しいスポットを追加</h3>

    //     {/* APIキーがないと動かないため、動作確認時はキー設定を確認してください */}
    //     <LocationSearch onPlaceSelect={handlePlaceSelect} />
    //   </div>
    //   {/* ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ */}
    //   {/* ▼▼▼ デバッグ用エリア ▼▼▼ */}
    //   <div style={{ border: '2px dashed blue', padding: '20px', margin: '20px 0' }}>
    //     <h3>🛠 開発者用データ確認ツール</h3>

    //     <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
    //       <button onClick={() => addNode('root', 'PROCESS', 'test')}>
    //         ＋ 「1日目」を追加 (Root)
    //       </button>

    //       <button onClick={() => {
    //         // 簡易的に、最初の「DAY」タイプを探して、その子供を追加してみるテスト
    //         const parent = nodes.find(n => n.type === 'PROCESS');
    //         if (parent) {
    //           addNode(parent.id, 'SPOT', 'テスト地点');
    //         } else {
    //           alert('先に「1日目」を追加してください');
    //         }
    //       }}>
    //         ＋ 「1日目」の下に地点を追加
    //       </button>
    //     </div>

    //     <pre style={{ background: '#eee', padding: '10px', fontSize: '12px' }}>
    //       {/* 現在のデータ構造をそのまま表示 */}
    //       {JSON.stringify(nodes, null, 2)}
    //     </pre>
    //   </div>
    //   {/* ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ */}

    //   {/* ▼▼▼ デバッグエリアの修正 ▼▼▼ */}
    //   <div style={{ border: '2px dashed blue', padding: '20px', margin: '20px 0' }}>
    //     <h3>🛠 ロケーション連携テスト</h3>

    //     <button onClick={() => {
    //       // 1. まずロケーションを作る（本来は地図から選択）
    //       const locId = addLocation('東京タワー', 35.65858, 139.74543, '東京都港区芝公園');

    //       // 2. そのIDを持って、SPOTノードを作る
    //       if (locId) {
    //         addNode(PARENT_ID_ROOT, 'SPOT', '東京タワー観光', { locationId: locId });
    //       }
    //     }}>
    //       ＋ 東京タワー（SPOT）を追加
    //     </button>
    //   </div>

    //   {/* ▼▼▼ JSON表示を削除し、ツリーコンポーネントを配置 ▼▼▼ */}
    //   <h2 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>工程表</h2>

    //   <PlanTree
    //     nodes={nodes}
    //     onAdd={addNode}
    //     onDelete={deleteNode}
    //     onUpdate={updateNode}
    //   />

    //   {/* ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ */}

    // </div>
    // 【解説A】 画面全体のコンテナ
    // height: 100vh で画面の高さいっぱいに広げます。
    // flex-direction: column で「ヘッダー」と「メインエリア」を縦に積みます。
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ヘッダーエリア: 高さは中身に合わせて自動(flex: 0 0 auto) */}
      <div style={{ flex: '0 0 auto' }}>
        <Header />
      </div>

      {/* 【解説B】 メインエリア: 残りの高さをすべて使う (flex: 1 1 auto) */}
      {/* display: flex で「左カラム」と「右カラム」を横に並べます */}
      {/* overflow: hidden で、画面全体がスクロールしてしまうのを防ぎます */}
      <div style={{ flex: '1 1 auto', display: 'flex', overflow: 'hidden' }}>

        {/* --- 左カラム: 操作パネル --- */}
        <div style={{
          width: '400px',        // 幅を固定
          minWidth: '300px',     // 最小幅を保証
          borderRight: '1px solid #ddd', // 右側に境界線
          overflowY: 'auto',     // 中身が増えたら、ここだけ縦スクロールさせる
          padding: '20px',
          backgroundColor: '#fff',
          zIndex: 10             // 地図より手前に表示
        }}>
          {/* タイトルとステータス */}
          <div style={{ marginBottom: '20px' }}>
            <h1 style={{ fontSize: '1.5rem', margin: '0 0 5px 0' }}>計画ID: {safePlanId}</h1>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>
              接続: <span style={{ color: connectionStatus === 'connected' ? 'green' : 'red' }}>{connectionStatus}</span>
            </div>
          </div>

          {/* 招待フォーム */}
          {safePlanId && (
            <div style={{ marginBottom: '20px' }}>
              <InviteForm planId={safePlanId} />
            </div>
          )}

          <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

          {/* 場所検索フォーム */}
          <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <LocationSearch onPlaceSelect={handlePlaceSelect} />
          </div>

          <h2 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>工程表 (V2)</h2>

          {/* ★ PlanTree に V2 のデータと関数を渡す */}
          <PlanTree
            // データ (Data & Structure)
            nodeMap={nodeMap}
            structure={structure}

            // 操作関数 (V2 Hooks)
            onCreateNode={createNodeData}
            onUpdateNode={updateNodeData}
            onDeleteNode={deleteNodeData}

            onRegisterTree={registerNodeToTree}
            onUnregisterTree={unregisterNodeFromTree}
            onMoveTree={moveNodeInTree}
          />
        </div>

        {/* --- 右カラム: マップビュー --- */}
        {/* flex: 1 1 auto で、残りの横幅をすべて埋め尽くします */}
        <div style={{ flex: '1 1 auto', position: 'relative' }}>
          {/* 【解説C】 マップへのデータ渡し
            nodes: 階層構造と順序を知るために必要
            locationMap: 各ノードの具体的な座標(lat, lng)を知るために必要
          */}
          <PlanMap nodes={flatNodes} locationMap={locationMap} />
        </div>

      </div>
    </div>
  );
};
