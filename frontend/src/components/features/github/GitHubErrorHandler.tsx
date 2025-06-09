import { XCircleIcon } from '@heroicons/react/24/outline';

export interface GitHubError {
  code: string;
  message: string;
  retryAfter?: number;
}

interface GitHubErrorHandlerProps {
  error: GitHubError;
  onRetry?: () => void;
  onFallback?: () => void;
}

interface ErrorInfo {
  title: string;
  message: string;
  action: 'retry' | 'reauth' | 'fallback';
  retryAfter?: number;
}

export default function GitHubErrorHandler({ error, onRetry, onFallback }: GitHubErrorHandlerProps) {
  const getErrorMessage = (error: GitHubError): ErrorInfo => {
    switch (error.code) {
      case 'RATE_LIMIT_EXCEEDED':
        return {
          title: 'GitHub API制限に達しました',
          message: 'しばらく時間をおいてから再試行してください',
          action: 'retry',
          retryAfter: error.retryAfter
        };
      case 'AUTHENTICATION_FAILED':
        return {
          title: 'GitHub認証が無効です',
          message: 'GitHub連携を再設定してください',
          action: 'reauth'
        };
      case 'REPOSITORY_NOT_FOUND':
        return {
          title: 'リポジトリが見つかりません',
          message: '別のリポジトリを選択するか、新しく作成してください',
          action: 'fallback'
        };
      case 'PERMISSION_DENIED':
        return {
          title: 'アクセス権限がありません',
          message: 'リポジトリへの書き込み権限が必要です',
          action: 'reauth'
        };
      case 'NETWORK_ERROR':
        return {
          title: 'ネットワークエラー',
          message: 'インターネット接続を確認してください',
          action: 'retry'
        };
      default:
        return {
          title: 'GitHub連携エラー',
          message: error.message || '予期しないエラーが発生しました',
          action: 'retry'
        };
    }
  };

  const handleReauth = () => {
    window.location.href = '/api/auth/github/connect';
  };

  const errorInfo = getErrorMessage(error);

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <XCircleIcon className="h-5 w-5 text-red-400" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            {errorInfo.title}
          </h3>
          <p className="mt-1 text-sm text-red-700">
            {errorInfo.message}
          </p>
          {errorInfo.retryAfter && (
            <p className="mt-1 text-xs text-red-600">
              {errorInfo.retryAfter}秒後に再試行できます
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {errorInfo.action === 'retry' && onRetry && (
          <button
            onClick={onRetry}
            className="bg-red-100 text-red-800 px-3 py-1 rounded text-sm hover:bg-red-200 transition-colors"
          >
            再試行
          </button>
        )}
        {errorInfo.action === 'reauth' && (
          <button
            onClick={handleReauth}
            className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
          >
            再認証
          </button>
        )}
        {errorInfo.action === 'fallback' && onFallback && (
          <button
            onClick={onFallback}
            className="bg-gray-100 text-gray-800 px-3 py-1 rounded text-sm hover:bg-gray-200 transition-colors"
          >
            別の方法で続行
          </button>
        )}
      </div>
    </div>
  );
}