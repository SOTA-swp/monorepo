import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Header } from '@/components/Header';
import { InviteForm } from '@/features/editor/components/InviteForm';
import { usePlanNodes } from '@/features/editor/hooks/usePlanNodes';
import { PlanTree } from '@/features/editor/components/TimelineView/PlanTree/PlanTree';
import { usePlanLocations } from '@/features/editor/hooks/usePlanLocations';

import { PARENT_ID_ROOT } from '@/features/editor/types/node';

export const PlanEditor = () => {
  const router = useRouter();
  const { planId } = router.query;

  const { user, isLoading } = useAuth();

  const [syncedList, setSyncedList] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('未接続');

  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);

  // Hookを使用
  const { nodes, addNode, deleteNode, updateNode } = usePlanNodes(ydoc);

  const { addLocation, locationMap } = usePlanLocations(ydoc);

  //未ログインなら強制的にloginページに
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  //[Yjs接続] ユーザーとplanIdが確定したら実行
  useEffect(() => {
    if (!user || !planId || typeof planId !== 'string') return;

    const _ydoc = new Y.Doc();
    setYdoc(_ydoc);

    //WebSocketプロバイダーの作成
    const provider = new WebsocketProvider(
      `ws://localhost:4000/ws/plan`,
      String(planId),
      _ydoc
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
      _ydoc.destroy();
    };
  }, [user, planId]);

  if (isLoading || !user) {
    return <p style={{ padding: '20px ' }}>読み込み中...</p>
  }

  const safePlanId = Array.isArray(planId) ? planId[0] : planId;

  return (
    <div style={{ padding: '20px ' }}>
      <Header />
      <h1>共同編集室（計画ID: {planId}）</h1>
      <div>
        参加者: <strong>{user.email}</strong>
        <div style={{ marginLeft: '20px', color: connectionStatus === 'connected' ? 'green' : 'red ' }}>
          接続状況
        </div>
      </div>
      {/* ▼▼▼ ここに追加！ ▼▼▼ */}
      {/* safePlanId がある時だけ表示します */}
      {safePlanId && (
        <div style={{ maxWidth: '600px', margin: '20px 0' }}>
          <InviteForm planId={safePlanId} />
        </div>
      )}
      {/* ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ */}
      {/* ▼▼▼ デバッグ用エリア ▼▼▼ */}
      <div style={{ border: '2px dashed blue', padding: '20px', margin: '20px 0' }}>
        <h3>🛠 開発者用データ確認ツール</h3>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <button onClick={() => addNode('root', 'PROCESS', 'test')}>
            ＋ 「1日目」を追加 (Root)
          </button>

          <button onClick={() => {
            // 簡易的に、最初の「DAY」タイプを探して、その子供を追加してみるテスト
            const parent = nodes.find(n => n.type === 'PROCESS');
            if (parent) {
              addNode(parent.id, 'SPOT', 'テスト地点');
            } else {
              alert('先に「1日目」を追加してください');
            }
          }}>
            ＋ 「1日目」の下に地点を追加
          </button>
        </div>

        <pre style={{ background: '#eee', padding: '10px', fontSize: '12px' }}>
          {/* 現在のデータ構造をそのまま表示 */}
          {JSON.stringify(nodes, null, 2)}
        </pre>
      </div>
      {/* ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ */}

      {/* ▼▼▼ デバッグエリアの修正 ▼▼▼ */}
      <div style={{ border: '2px dashed blue', padding: '20px', margin: '20px 0' }}>
        <h3>🛠 ロケーション連携テスト</h3>

        <button onClick={() => {
          // 1. まずロケーションを作る（本来は地図から選択）
          const locId = addLocation('東京タワー', 35.65858, 139.74543, '東京都港区芝公園');

          // 2. そのIDを持って、SPOTノードを作る
          if (locId) {
            addNode(PARENT_ID_ROOT, 'SPOT', '東京タワー観光', { locationId: locId });
          }
        }}>
          ＋ 東京タワー（SPOT）を追加
        </button>
      </div>

      {/* ▼▼▼ JSON表示を削除し、ツリーコンポーネントを配置 ▼▼▼ */}
      <h2 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>工程表</h2>

      <PlanTree
        nodes={nodes}
        onAdd={addNode}
        onDelete={deleteNode}
        onUpdate={updateNode}
      />

      {/* ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ */}

    </div>
  );
};
