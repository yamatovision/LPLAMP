import { ReactNode } from 'react';

interface MockIndicatorProps {
  children: ReactNode;
}

export function MockIndicator({ children }: MockIndicatorProps) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (!isDevelopment) {
    return <>{children}</>;
  }

  return (
    <>
      {/* モック使用中のバナー */}
      <div className="bg-red-600 text-white text-center py-2 px-4 text-sm font-medium">
        ⚠️ モックデータ使用中 - 本番環境では使用不可
      </div>
      {children}
    </>
  );
}

export function withMockPrefix(text: string): string {
  const isDevelopment = process.env.NODE_ENV === 'development';
  return isDevelopment ? `[MOCK] ${text}` : text;
}