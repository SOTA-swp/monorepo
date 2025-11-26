import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Header } from '../../../components/Header';
import { InviteForm } from '../../../components/InviteForm';
import { usePlanNodes } from '../../../hooks/usePlanNodes';
import { PlanTree } from '../../../components/PlanTree/PlanTree';
import { usePlanLocations } from '../../../hooks/usePlanLocations';

import { PARENT_ID_ROOT } from '../../../types/node';

const PlanEditPage = () => {
  const router = useRouter();
  const { planId } = router.query;

  const { user, isLoading } = useAuth();

  const [syncedList, setSyncedList] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('未接続');

  //const ydocRef = useRef<Y.Doc | null>(null);

  // ydocRef.current ではなく、stateで保持している ydoc を渡す必要があるため、
  // 既存の useEffect 内で setYDoc(ydoc) するように少し変更が必要です。
  // もし面倒なら、一旦 ydocRef.current を使う形にHook側を合わせるか、
  // 以下のように useState で ydoc インスタンスを管理します。
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
    //ydocRef.current = ydoc;

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

    //[共有データ] 'travelItems' という名前の共有配列を取得
    // const yArray = ydoc.getArray<string>('travelItems');

    // setSyncedList(yArray.toArray());

    // //[同期] データが変更されたらReactの画面を更新する
    // yArray.observe(() => {
    //   setSyncedList(yArray.toArray());
    // });

    return () => {
      provider.disconnect();
      provider.destroy();
      _ydoc.destroy();
    };
  }, [user, planId]);

  // const addItem = () => {
  //   if (inputValue.trim() && ydocRef.current) {
  //     const yArray = ydocRef.current.getArray<string>('travelItems');
  //     yArray.push([inputValue]);
  //     setInputValue('');
  //   }
  // };

  // const deleteItem = (index: number) => {
  //   if (ydocRef.current) {
  //     const yArray = ydocRef.current.getArray<string>('travelItems');
  //     yArray.delete(index, 1);
  //   }
  // };

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
            addNode(PARENT_ID_ROOT, 'SPOT', '東京タワー観光', {locationId: locId} );
            // ※注意: addNodeに locationId を渡せるように修正が必要です（後述）
            // 現状の addNode は (parentId, type, name) しか受け取っていないため、
            // 作成後に updateNode で紐付ける形をとります。

            // 本当は addNode の返り値で NodeID が欲しいですが、
            // 非同期や実装の都合上、ここでは簡易的に「更新」で紐付けます。
            // (本来は addNode を拡張すべき)
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



      {/* <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
        <h3>📝 持ち物リスト (リアルタイム同期デモ)</h3>
        <p style={{ fontSize: '0.9rem', color: '#666' }}>
          別のタブやブラウザで同じページを開くと、入力がリアルタイムに同期されます。
          サーバーを再起動してもデータは消えません。
        </p>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="例: パスポート、着替え..."
            style={{ flex: 1, padding: '8px' }}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
          />
          <button onClick={addItem} style={{ padding: '8px 16px' }}>追加</button>
        </div>

        <ul style={{ listStyle: 'none', padding: 0 }}>
          {syncedList.map((item, index) => (
            <li key={index} style={{ padding: '8px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
              <span>{item}</span>
              <button onClick={() => deleteItem(index)} style={{ color: 'red', cursor: 'pointer', border: 'none', background: 'none' }}>
                削除
              </button>
            </li>
          ))}
        </ul>
        {syncedList.length === 0 && <p style={{ color: '#999' }}>リストは空です</p>}
      </div> */}
    </div>
  );
};

export default PlanEditPage;