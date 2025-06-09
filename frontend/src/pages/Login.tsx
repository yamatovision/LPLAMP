import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AuthLayout from '@/layouts/AuthLayout';

export default function Login() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState('');
  const [showRedirectMessage, setShowRedirectMessage] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      setShowRedirectMessage(true);
      setTimeout(() => {
        
      }, 1500);
    }
  }, [isAuthenticated, isLoading]);

  const handleLogin = async () => {
    setError('');
    setIsLoggingIn(true);

    try {
      await login();
    } catch (err) {
      console.error('ログインエラー:', err);
      setError('ログインに失敗しました。もう一度お試しください。');
      setIsLoggingIn(false);
      
      setTimeout(() => {
        setError('');
      }, 5000);
    }
  };

  if (isLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
        </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
      <AuthLayout>
        <div className="text-center">
          {showRedirectMessage ? (
            <div className="text-blue-600 text-sm">
              ログイン済みです。ダッシュボードへリダイレクトしています...
            </div>
          ) : isLoggingIn ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
              <span className="text-gray-600">認証中...</span>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="flex items-center justify-center w-full px-6 py-4 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-all duration-200 transform hover:-translate-y-1 hover:shadow-xl active:translate-y-0 active:shadow-lg"
            >
              <svg 
                className="w-6 h-6 mr-3" 
                viewBox="0 0 24 24" 
                fill="currentColor"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHubでログイン
            </button>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>
      </AuthLayout>
  );
}