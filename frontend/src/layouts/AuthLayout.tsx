import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        {/* アプリケーションロゴ */}
        <div className="text-center">
          <div className="mx-auto w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
            <span className="text-white font-bold text-3xl">LP</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">LPlamp</h1>
          <p className="text-gray-600 text-lg">参考サイトから理想のLP/HPを簡単作成</p>
        </div>

        {/* メインコンテンツ */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {children}
        </div>

        {/* フッター */}
        <div className="text-center text-sm text-gray-500">
          <a href="/privacy" className="hover:text-gray-700 transition-colors">プライバシーポリシー</a>
          <span className="mx-3">·</span>
          <a href="/terms" className="hover:text-gray-700 transition-colors">利用規約</a>
        </div>
      </div>
    </div>
  );
}