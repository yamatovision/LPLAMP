import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { checkAuthStatus } = useAuthContext();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // URLからエラーパラメータをチェック
        const params = new URLSearchParams(window.location.search);
        const error = params.get('error');
        
        if (error) {
          console.error('認証エラー:', error);
          navigate('/login', { replace: true });
          return;
        }

        // 認証状態を確認
        await checkAuthStatus();
        
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