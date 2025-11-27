import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import Link from 'next/link';

const EditorPage = () =>{
  const { user, isLoading } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return <p style={{ padding: '20px'}}>認証情報を確認中...</p>
  }
  
  React.useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  if (user) {
    return (
      <div style={{ padding: '20px'}}>
        <h1>会員専用エディターページ</h1>
        <p>ようこそ、<strong>{user.email}</strong> さん。</p>
        <p>このページは、ログインしているあなただけが見ることができます。</p>
        <br />
        <Link href="/" passHref>
          <button>トップページに戻る</button>
        </Link>
      </div>
    );
  }

  return <p style={{ padding: '20px' }}>リダイレクト中...</p>;
};

export default EditorPage;