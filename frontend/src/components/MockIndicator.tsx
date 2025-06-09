/**
 * MockIndicator コンポーネント
 * 開発環境でモック機能が使用されていることを視覚的に示す
 */

import React, { ReactNode } from 'react';

interface MockIndicatorProps {
  children: ReactNode;
}

const MockIndicator: React.FC<MockIndicatorProps> = ({ children }) => {
  // 本番環境では表示しない
  const isDevelopment = import.meta.env.DEV;

  if (!isDevelopment) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* モック表示バナー */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-400 text-black text-center py-2 text-sm font-medium">
        🔧 開発モード: モック機能が有効です
      </div>
      
      {/* メインコンテンツ */}
      <div className="pt-10">
        {children}
      </div>
    </div>
  );
};

export default MockIndicator;