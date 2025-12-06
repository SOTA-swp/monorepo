import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Header } from '@/components/Header';
import { InviteForm } from '@/features/editor/components/InviteForm';
import { PlanTree } from '@/features/editor/components/TimelineView/PlanTree/PlanTree';
import { usePlanLocations } from '@/features/editor/hooks/usePlanLocations';
import { LocationSearch } from '@/features/editor/components/LocationSearch';
import { PlanMap } from './MapView/PlanMap';
import { PARENT_ID_ROOT } from '@/features/editor/types/node';
import { usePlanData } from '@/features/editor/hooks/usePlanData';
import { usePlanTree } from '@/features/editor/hooks/usePlanTree';
import { v4 as uuidv4 } from 'uuid';
import { buildFlatTreeV2, FlatPlanNodeV2 } from '@/features/editor/utils/structureUtils';

export const PlanEditor = () => {
  const router = useRouter();
  const { planId } = router.query;

  const { user, isLoading } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState('未接続');

  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);

  const { addLocation, locationMap } = usePlanLocations(ydoc);

  // ★ V2 (新規)
  const { nodeMap, createNodeData, updateNodeData, deleteNodeData } = usePlanData(ydoc);
  const { structure, registerNodeToTree, unregisterNodeFromTree, moveNodeInTree } = usePlanTree(ydoc);

  //未ログインならloginページに遷移
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  //yjs接続
  useEffect(() => {
    if (!planId || typeof planId !== 'string') return;
    const _ydoc = new Y.Doc();
    setYdoc(_ydoc);
    return () => {
      _ydoc.destroy();
    }
  }, [planId]);

  //[Yjs接続] ユーザーとplanIdが確定したら実行
  useEffect(() => {
    if (!ydoc || !user || !planId || typeof planId !== 'string') return;
    //WebSocketプロバイダーの作成
    const provider = new WebsocketProvider(
      `ws://localhost:4000/ws/plan`,
      String(planId),
      ydoc
    );
    //デバッグ用
    provider.on('connection-close', (event: any) => {
      console.log('切断されました。理由:', event?.reason);
      console.log('コード:', event?.code);
    });

    provider.on('status', (event: { status: string }) => {
      setConnectionStatus(event.status);
    });

    return () => {
      provider.disconnect();
      provider.destroy();
      ydoc.destroy();
    };
  }, [ydoc, user, planId]);

  //共通データ生成
  //データの中身と構造を結合しUI用のリスト作成
  const flatNodes = useMemo<FlatPlanNodeV2[]>(() => {
    return buildFlatTreeV2(structure, nodeMap);
  }, [structure, nodeMap]);

  //ロケーションデータの実体を作成 (Yjs: planLocations)
  //!TODO   addLocation が placeId も受け取れるようにフックを修正する
  const handlePlaceSelect = (place: { name: string; address: string; lat: number; lng: number; placeId: string }) => {
    console.log('選択された場所:', place);
    const locationId = addLocation(place.name, place.lat, place.lng, place.address);
    if (locationId) {
      const newNodeId = uuidv4();
      createNodeData(newNodeId, 'SPOT', place.name, { locationId });
      registerNodeToTree(PARENT_ID_ROOT, newNodeId);
    }
  };

  if (isLoading || !user) {
    return <p style={{ padding: '20px ' }}>読み込み中...</p>
  }
  const safePlanId = Array.isArray(planId) ? planId[0] : planId;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: '0 0 auto' }}>
        <Header />
      </div>

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
        <div style={{ flex: '1 1 auto', position: 'relative' }}>
          <PlanMap nodes={flatNodes} locationMap={locationMap} />
        </div>
      </div>
    </div>
  );
};
