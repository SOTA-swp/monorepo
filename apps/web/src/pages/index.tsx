import React, { useEffect, useState } from 'react';

const HomePage = () => {
  // バックエンドからの応答を保存する場所
  const [message, setMessage] = useState(
    '...バックエンドからの応答を待っています...'
  );

  // ページが読み込まれた時に1回だけ実行
  useEffect(() => {
    // Next.jsのProxy経由でバックエンドのAPIを叩く
    fetch('/api/hello')
      .then((res) => res.json())
      .then((data) => {
        // 成功したらメッセージを更新
        setMessage(data.message);
      })
      .catch((err) => {
        // 失敗したらエラーを表示
        setMessage('エラー: バックエンドと通信できませんでした');
      });
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Hello, SOTA Project!</h1>
      <p>Next.jsは起動しています。</p>
      <hr />
      <h2>バックエンド通信テスト:</h2>
      <p>{message}</p>
    </div>
  );
};

export default HomePage;
