import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import React, { useState } from 'react';
import { useRouter } from 'next/router';

export const HomeContent = () => {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  const [newPlanTitle, setNewPlanTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanTitle.trim()) return;

    setIsCreating(true);

    try {
      const res = await fetch('http://localhost:4000/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: newPlanTitle }),
      });

      if (!res.ok) {
        throw new Error('作成に失敗しました');
      }

      const newPlan = await res.json();
      router.push(`/plan/${newPlan.id}`);

    } catch (err) {
      alert('計画の作成に失敗しました。サーバーが起動しているか確認してください。');
      console.error(err);
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '20px' }}>
        <p>読み込み中...</p>
      </div>
    );
  }

  if (user) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>ようこそ</h1>
        <p>
          あなたは <strong>{user.email}</strong> としてログインしています。
        </p>
        <p>（ここに、共同編集ページへのリンクなどを今後追加します）</p>
        
        <div style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
          <h2 style={{ marginTop: 0 }}>新しい旅行計画を立てる</h2>
          <form onSubmit={handleCreatePlan} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={newPlanTitle}
              onChange={(e) => setNewPlanTitle(e.target.value)}
              placeholder="例: 北海道グルメツアー"
              disabled={isCreating}
              style={{
                flex: 1,
                padding: '10px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
            <button
              type="submit"
              disabled={isCreating || !newPlanTitle.trim()}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                opacity: isCreating ? 0.7 : 1
              }}
            >
              {isCreating ? '作成中...' : '作成して開始'}
            </button>
          </form>
        </div>
        
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          <Link href="/plan/1" passHref>
            <button style={{ padding: '10px 20px', fontSize: '16px' }}>
              テスト用共同編集室（Plan1）へ
            </button>
          </Link>
          <button
            onClick={logout}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#ffdddd',
              border: '1px solid #ff0000',
              color: '#ff0000',
              cursor: 'pointer'
            }}
          >
            ログアウト
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>ようこそ、SOTAプロジェクトへ</h1>
      <p>サービスを利用するには、ログインまたは会員登録が必要です。</p>
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <Link href="/login" passHref>
          <button style={{ padding: '10px 20px' }}>ログイン</button>
        </Link>
        <Link href="/register" passHref>
          <button style={{ padding: '10px 20px' }}>会員登録</button>
        </Link>
      </div>
    </div>
  );
};