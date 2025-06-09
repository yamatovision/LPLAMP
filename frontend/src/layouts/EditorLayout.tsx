import { ReactNode, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useParams, Link } from 'react-router-dom';

interface EditorLayoutProps {
  children: ReactNode;
  projectName?: string;
  saveStatus?: 'saved' | 'saving' | 'error';
}

export default function EditorLayout({ children, projectName, saveStatus = 'saved' }: EditorLayoutProps) {
  const { user, logout } = useAuth();
  const { projectId } = useParams();
  const [isTerminalVisible, setIsTerminalVisible] = useState(false);

  const getSaveStatusDisplay = () => {
    switch (saveStatus) {
      case 'saving':
        return <span className="text-yellow-600">保存中...</span>;
      case 'error':
        return <span className="text-red-600">保存エラー</span>;
      default:
        return <span className="text-green-600">保存済み</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            {/* 左側: ロゴとプロジェクト名 */}
            <div className="flex items-center space-x-4">
              <Link to="/" className="flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">LP</span>
                </div>
                <span className="ml-2 text-xl font-semibold text-gray-900">LPlamp</span>
              </Link>
              
              {projectName && (
                <>
                  <span className="text-gray-400">/</span>
                  <span className="text-lg font-medium text-gray-800">{projectName}</span>
                </>
              )}
              
              {/* 保存状態インジケーター */}
              <div className="text-sm">
                {getSaveStatusDisplay()}
              </div>
            </div>

            {/* 右側: ユーザー情報とアクション */}
            <div className="flex items-center space-x-4">
              {/* エクスポートリンク */}
              {projectId && (
                <Link
                  to={`/export/${projectId}`}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  エクスポート
                </Link>
              )}
              
              <a
                href="/help"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ヘルプ
              </a>
              
              {user && (
                <div className="flex items-center space-x-2">
                  {user.avatarUrl && (
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span className="text-sm text-gray-700">{user.username}</span>
                  <button
                    onClick={logout}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    ログアウト
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ツールバー */}
      <div className="bg-gray-800 text-white px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium">エディター</span>
            <button
              onClick={() => setIsTerminalVisible(!isTerminalVisible)}
              className={`px-3 py-1 rounded text-sm ${
                isTerminalVisible 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {isTerminalVisible ? 'ターミナルを隠す' : 'ターミナルを表示'}
            </button>
          </div>
          
          <div className="text-sm text-gray-300">
            AI編集にはClaudeCodeを使用します
          </div>
        </div>
      </div>

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* エディターコンテンツ */}
        <div className={`flex-1 ${isTerminalVisible ? 'h-2/3' : 'h-full'} overflow-auto`}>
          {children}
        </div>
        
        {/* ターミナルエリア（条件表示） */}
        {isTerminalVisible && (
          <div className="h-1/3 border-t bg-black text-white flex flex-col">
            <div className="p-4 flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">ClaudeCode ターミナル</h3>
                <button
                  onClick={() => setIsTerminalVisible(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="bg-gray-900 p-3 rounded text-sm font-mono h-full overflow-auto">
                <div className="text-green-400">$ claude</div>
                <div className="text-gray-400 mt-1">ClaudeCodeターミナルが利用可能です。要素を選択してAI編集を開始してください。</div>
                <div className="text-yellow-400 mt-2">⚡ ターミナルが正常に表示されました！</div>
                <div className="text-gray-500 mt-1">ここでClaudeCodeコマンドを実行できます。</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}