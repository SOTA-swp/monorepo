import React, { useState } from 'react';

interface InviteFormProps {
  planId: string;
}

export const InviteForm = ({ planId }: InviteFormProps) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch(`http://localhost:4000/api/plans/${planId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Cookie(JWT)を送信
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        // バックエンドからのエラーメッセージを表示 (例: "ユーザーが見つかりません" 等)
        throw new Error(data.message || '招待に失敗しました');
      }

      setStatus('success');
      setMessage(`✅ ${email} を招待しました`);
      setEmail(''); // 入力欄をクリア

    } catch (err: any) {
      setStatus('error');
      setMessage(`❌ ${err.message}`);
    }
  };

  return (
    <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f4f8', borderRadius: '8px' }}>
      <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#333' }}>メンバーを招待</h3>
      
      <form onSubmit={handleInvite} style={{ display: 'flex', gap: '10px' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="招待したい人のEmail"
          disabled={status === 'loading'}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #ccc'
          }}
        />
        <button
          type="submit"
          disabled={status === 'loading' || !email}
          style={{
            padding: '8px 16px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            opacity: status === 'loading' ? 0.7 : 1
          }}
        >
          {status === 'loading' ? '送信中...' : '招待'}
        </button>
      </form>

      {/* 結果メッセージの表示エリア */}
      {message && (
        <p style={{ 
          marginTop: '10px', 
          marginBottom: 0, 
          fontSize: '0.9rem', 
          color: status === 'error' ? 'red' : 'green' 
        }}>
          {message}
        </p>
      )}
    </div>
  );
};