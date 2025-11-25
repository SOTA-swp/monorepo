import Link from 'next/link';
// アイコンを使うと直感的です（例: lucide-react や heroicons など）
// import { ArrowLeft } from 'lucide-react'; 

export const Header = () => {
  return (
    <header className="flex items-center p-4 border-b">
      {/* 戻るボタン */}
      <Link 
        href="/" 
        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
      >
        <span style={{ marginRight: '8px' }}>←</span> {/* またはアイコン */}
        ホームに戻る
      </Link>
      
      <h1 className="ml-4 font-bold">計画編集</h1>
    </header>
  );
};