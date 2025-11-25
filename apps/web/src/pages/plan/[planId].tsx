import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext'; 
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Header } from '../../../components/Header';

const PlanEditPage = () => {
  const router = useRouter();
  const { planId } = router.query;

  const { user, isLoading } = useAuth();

  const [syncedList, setSyncedList] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('未接続');

  const ydocRef = useRef<Y.Doc | null>(null);

  //未ログインなら強制的にloginページに
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  //[Yjs接続] ユーザーとplanIdが確定したら実行
  useEffect(() => {
    if (!user || !planId || typeof planId !== 'string') return;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

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

    //[共有データ] 'travelItems' という名前の共有配列を取得
    const yArray = ydoc.getArray<string>('travelItems');

    setSyncedList(yArray.toArray());

    //[同期] データが変更されたらReactの画面を更新する
    yArray.observe(() => {
      setSyncedList(yArray.toArray());
    });

    return () => {
      provider.disconnect();
      provider.destroy();
      ydoc.destroy();
    };
  }, [user, planId]);

  const addItem = () => {
    if (inputValue.trim() && ydocRef.current){
      const yArray = ydocRef.current.getArray<string>('travelItems');
      yArray.push([inputValue]);
      setInputValue('');
    }
  };

  const deleteItem = (index: number) => {
    if (ydocRef.current) {
      const yArray = ydocRef.current.getArray<string>('travelItems');
      yArray.delete(index, 1);
    }
  };

  if (isLoading || !user){
    return <p style={{ padding: '20px '}}>読み込み中...</p>
  }

  return (
    <div style={{ padding: '20px '}}>
      <Header />
      <h1>共同編集室（計画ID: {planId}）</h1>
      <div>
        参加者: <strong>{user.email}</strong>
        <div style={{ marginLeft: '20px', color: connectionStatus === 'connected' ? 'green' : 'red '}}>
          接続状況
        </div>
      </div>

    <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
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
        {syncedList.length === 0 && <p style={{color: '#999'}}>リストは空です</p>}
      </div>
    </div>
  );
};

export default PlanEditPage;