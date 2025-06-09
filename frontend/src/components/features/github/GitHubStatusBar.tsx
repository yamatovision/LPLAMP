/**
 * GitHub状態表示バー
 * 
 * エディター画面でのGitHub連携状態をリアルタイム表示
 */

import { useState, useEffect } from 'react';
import { Project, GitHubAuthStatus } from '@/types';
import { AutoSaveIndicator } from './AutoSaveIndicator';
import { DeployStatusIndicator } from './DeployStatusIndicator';
import { useGitHubSync } from '@/hooks/useGitHubSync';
import { logger } from '@/utils/logger';

interface GitHubStatusBarProps {
  project: Project;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved?: Date | null;
}

export const GitHubStatusBar: React.FC<GitHubStatusBarProps> = ({ 
  project, 
  saveStatus,
  lastSaved 
}) => {
  const [githubAuth, setGithubAuth] = useState<GitHubAuthStatus | null>(null);
  
  // リアルタイム同期フックの使用
  const { syncState, isConnected } = useGitHubSync(project.id);
  
  // 同期状態から最新情報を取得
  const lastCommit = syncState.lastCommitHash;
  const deployStatus = syncState.deployStatus;
  const deployUrl = syncState.deployUrl || project.deploymentUrl;

  // GitHub認証状態とコミット情報を取得
  useEffect(() => {
    const fetchGitHubStatus = async () => {
      try {
        const { githubService } = await import('@/services/api/github.service');
        
        // GitHub認証状態取得
        const authResponse = await githubService.getAuthStatus();
        if (authResponse.success && authResponse.data) {
          setGithubAuth(authResponse.data);
        }

        // 最新コミット情報取得（GitHub連携が有効な場合）
        // リアルタイム同期により自動更新されるため、初期値のみ設定
        if (project.githubRepo && authResponse.data?.authenticated && !lastCommit) {
          // TODO: 最新コミット情報の取得API実装
          // setLastCommit('a1b2c3d'); // 仮のコミットハッシュ（リアルタイム同期で更新）
        }

        logger.debug('GitHub状態取得完了', {
          component: 'GitHubStatusBar',
          projectId: project.id,
          authenticated: authResponse.data?.authenticated
        });

      } catch (error) {
        logger.error('GitHub状態取得エラー', {
          component: 'GitHubStatusBar',
          projectId: project.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };

    fetchGitHubStatus();
  }, [project.id, project.githubRepo]);

  // GitHub連携が設定されていない場合
  if (!project.githubRepo) {
    return (
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="text-yellow-800 text-sm">
            GitHub連携が設定されていません。自動コミット機能を利用するにはGitHub連携を設定してください。
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
      <div className="flex justify-between items-center">
        {/* GitHub連携情報 */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-gray-600">
              <span className="font-medium">リポジトリ:</span> {project.githubRepo}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="text-sm text-gray-600">
              <span className="font-medium">ブランチ:</span> {project.githubBranch || 'main'}
            </span>
          </div>

          {lastCommit && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm text-gray-600">
                <span className="font-medium">最新:</span> {lastCommit.substring(0, 7)}
              </span>
            </div>
          )}
        </div>

        {/* 状態インジケーター */}
        <div className="flex items-center gap-4">
          {/* デプロイ状態 */}
          <DeployStatusIndicator 
            status={deployStatus} 
            url={deployUrl} 
          />
          
          {/* 自動保存状態 */}
          <AutoSaveIndicator 
            enabled={project.autoCommit || false}
            saveStatus={saveStatus}
            lastSaved={lastSaved}
          />

          {/* WebSocket接続状態 */}
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-blue-600">リアルタイム同期</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-sm text-gray-600">オフライン</span>
              </>
            )}
          </div>

          {/* GitHub認証状態 */}
          <div className="flex items-center gap-2">
            {githubAuth?.authenticated ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-green-600">認証済み</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-sm text-red-600">認証エラー</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};