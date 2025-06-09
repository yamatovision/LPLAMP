import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { checkAuthStatus } = useAuthContext();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('AuthCallback: コールバック処理開始');
        console.log('AuthCallback: 現在のURL:', window.location.href);
        
        // URLからエラーパラメータをチェック
        const params = new URLSearchParams(window.location.search);
        const error = params.get('error');
        const status = params.get('status');
        
        console.log('AuthCallback: URLパラメータ', { error, status });
        
        if (error) {
          console.error('認証エラー:', error);
          navigate('/login', { replace: true });
          return;
        }

        console.log('AuthCallback: 認証状態確認を開始');
        // 認証状態を確認
        await checkAuthStatus();
        
        console.log('AuthCallback: 認証状態確認完了、ダッシュボードへリダイレクト');
        // ダッシュボードへリダイレクト
        navigate('/', { replace: true });
      } catch (err) {
        console.error('コールバック処理エラー:', err);
        navigate('/login', { replace: true });
      }
    };

    handleCallback();
  }, [navigate, checkAuthStatus]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">認証処理中...</p>
      </div>
    </div>
  );
}