import { useState, useEffect } from 'react';
import { GitHubAuthStatus, GitHubRepository, DeployProvider } from '@/types';

interface GitHubIntegrationOptionsProps {
  onOptionsChange: (options: GitHubIntegrationData | null) => void;
}

interface GitHubIntegrationData {
  githubRepo?: string;
  githubBranch?: string;
  deployProvider?: DeployProvider;
  autoCommit?: boolean;
}

export default function GitHubIntegrationOptions({ onOptionsChange }: GitHubIntegrationOptionsProps) {
  const [authStatus, setAuthStatus] = useState<GitHubAuthStatus | null>(null);
  const [repos, setRepos] = useState<GitHubRepository[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [deployProvider, setDeployProvider] = useState<DeployProvider>(DeployProvider.GITHUB_PAGES);
  const [autoCommit, setAutoCommit] = useState(true);
  const [createNewRepo, setCreateNewRepo] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    const options: GitHubIntegrationData = {
      githubRepo: createNewRepo ? newRepoName : selectedRepo,
      githubBranch: selectedBranch,
      deployProvider,
      autoCommit
    };

    if (authStatus?.authenticated && (selectedRepo || newRepoName)) {
      onOptionsChange(options);
    } else {
      onOptionsChange(null);
    }
  }, [authStatus, selectedRepo, selectedBranch, deployProvider, autoCommit, createNewRepo, newRepoName, onOptionsChange]);

  const checkAuthStatus = async () => {
    try {
      const { githubService } = await import('@/services/api/github.service');
      const status = await githubService.getAuthStatus();
      setAuthStatus(status);

      if (status.authenticated) {
        await loadRepositories();
      }
    } catch (error) {
      console.error('GitHub認証状態の確認に失敗:', error);
      setAuthStatus({ authenticated: false });
    } finally {
      setIsLoading(false);
    }
  };

  const loadRepositories = async () => {
    try {
      const { githubService } = await import('@/services/api/github.service');
      const repositories = await githubService.getRepositories();
      setRepos(repositories);
    } catch (error) {
      console.error('リポジトリ一覧の取得に失敗:', error);
    }
  };

  const handleConnect = async () => {
    try {
      const { githubService } = await import('@/services/api/github.service');
      const authUrl = await githubService.initiateAuth(['repo', 'workflow']);
      window.location.href = authUrl;
    } catch (error) {
      console.error('GitHub認証の開始に失敗:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-sm text-gray-600">GitHub連携を確認中...</span>
      </div>
    );
  }

  if (!authStatus?.authenticated) {
    return (
      <div className="text-center py-6">
        <div className="mb-4">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-sm font-medium text-gray-900 mb-2">
          GitHub連携が必要です
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          自動デプロイを利用するにはGitHubアカウントとの連携が必要です
        </p>
        <button
          onClick={handleConnect}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-900 hover:bg-gray-800"
        >
          <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
          </svg>
          GitHubと連携
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 認証済み状態表示 */}
      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-green-800">
              {authStatus.username} として連携済み
            </p>
          </div>
        </div>
      </div>

      {/* リポジトリ選択 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          リポジトリ設定
        </label>
        
        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="radio"
              checked={!createNewRepo}
              onChange={() => setCreateNewRepo(false)}
              className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">既存のリポジトリを使用</span>
          </label>

          {!createNewRepo && (
            <select
              value={selectedRepo}
              onChange={(e) => setSelectedRepo(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="">リポジトリを選択...</option>
              {repos.map(repo => (
                <option key={repo.id} value={repo.fullName}>
                  {repo.fullName} {repo.private && '(Private)'}
                </option>
              ))}
            </select>
          )}

          <label className="flex items-center">
            <input
              type="radio"
              checked={createNewRepo}
              onChange={() => setCreateNewRepo(true)}
              className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">新しいリポジトリを作成</span>
          </label>

          {createNewRepo && (
            <input
              type="text"
              placeholder="リポジトリ名を入力..."
              value={newRepoName}
              onChange={(e) => setNewRepoName(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          )}
        </div>
      </div>

      {/* ブランチ設定 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          デプロイブランチ
        </label>
        <input
          type="text"
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          placeholder="main"
        />
      </div>

      {/* デプロイプロバイダー */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          デプロイ方法
        </label>
        <select
          value={deployProvider}
          onChange={(e) => setDeployProvider(e.target.value as DeployProvider)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
        >
          <option value={DeployProvider.GITHUB_PAGES}>GitHub Pages</option>
          <option value={DeployProvider.VERCEL}>Vercel</option>
          <option value={DeployProvider.NETLIFY}>Netlify</option>
        </select>
      </div>

      {/* 自動コミット設定 */}
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={autoCommit}
            onChange={(e) => setAutoCommit(e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700">
            編集内容を自動的にコミット
          </span>
        </label>
        <p className="mt-1 text-xs text-gray-500">
          エディターでの変更が自動的にGitHubリポジトリにコミットされます
        </p>
      </div>
    </div>
  );
}