import React from 'react';
import { useAuth } from '../context/AuthContext';
import Link from 'next/link';

const HomePage = () => {
  // バックエンドからの応答を保存する場所
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ padding: '20px'}}>
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
      <div style={{ marginTop: '20px' }}>
          <Link href="/editor" passHref>
            <button style={{ padding: '10px 20px', fontSize: '16px' }}>
              会員専用エディターページへ
            </button>
          </Link>
        </div>
        {/* 将来的にフェーズ6でログアウト機能を追加します */}
        {/* <button>ログアウト</button> */}
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

export default HomePage;