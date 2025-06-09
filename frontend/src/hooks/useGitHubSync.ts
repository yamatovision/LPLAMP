/**
 * GitHub同期フック
 * 
 * リアルタイムでGitHub関連の状態更新を受信・処理
 */

import { useState, useEffect, useCallback } from 'react';
import { ID, DeploymentStatus } from '@/types';
import { logger } from '@/utils/logger';

/**
 * GitHub同期イベントの型定義
 */
export interface GitHubSyncEvent {
  type: 'commit' | 'deploy' | 'auth' | 'error';
  projectId: ID;
  data: any;
  timestamp: string;
}

/**
 * GitHub同期状態
 */
export interface GitHubSyncState {
  lastCommitHash?: string;
  deployStatus: DeploymentStatus;
  deployUrl?: string;
  isConnected: boolean;
  lastUpdate?: Date;
}

/**
 * useGitHubSyncフックの戻り値
 */
export interface UseGitHubSyncReturn {
  syncState: GitHubSyncState;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: any) => void;
}

/**
 * GitHub同期フック
 */
export const useGitHubSync = (projectId: ID): UseGitHubSyncReturn => {
  const [syncState, setSyncState] = useState<GitHubSyncState>({
    deployStatus: DeploymentStatus.READY,
    isConnected: false
  });
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  /**
   * WebSocket接続の確立
   */
  const connect = useCallback(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      logger.debug('WebSocket既に接続済み', { projectId });
      return;
    }

    try {
      // WebSocketエンドポイントを構築
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/github-sync?projectId=${projectId}`;
      
      logger.info('GitHub同期WebSocket接続開始', { projectId, wsUrl });

      const newSocket = new WebSocket(wsUrl);

      newSocket.onopen = () => {
        logger.info('GitHub同期WebSocket接続成功', { projectId });
        setIsConnected(true);
        setSyncState(prev => ({ ...prev, isConnected: true }));
      };

      newSocket.onmessage = (event) => {
        try {
          const syncEvent: GitHubSyncEvent = JSON.parse(event.data);
          handleSyncEvent(syncEvent);
        } catch (error) {
          logger.error('WebSocketメッセージ解析エラー', {
            projectId,
            error: error instanceof Error ? error.message : String(error),
            data: event.data
          });
        }
      };

      newSocket.onclose = (event) => {
        logger.info('GitHub同期WebSocket接続終了', { 
          projectId,
          code: event.code,
          reason: event.reason 
        });
        setIsConnected(false);
        setSyncState(prev => ({ ...prev, isConnected: false }));
        
        // 自動再接続（5秒後）
        if (event.code !== 1000) { // 正常終了以外の場合
          setTimeout(() => {
            logger.info('GitHub同期WebSocket自動再接続', { projectId });
            connect();
          }, 5000);
        }
      };

      newSocket.onerror = (error) => {
        logger.error('GitHub同期WebSocketエラー', {
          projectId,
          error: error
        });
        setIsConnected(false);
        setSyncState(prev => ({ ...prev, isConnected: false }));
      };

      setSocket(newSocket);

    } catch (error) {
      logger.error('GitHub同期WebSocket接続エラー', {
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }, [projectId, socket]);

  /**
   * WebSocket接続の切断
   */
  const disconnect = useCallback(() => {
    if (socket) {
      logger.info('GitHub同期WebSocket手動切断', { projectId });
      socket.close(1000, 'Manual disconnect');
      setSocket(null);
      setIsConnected(false);
      setSyncState(prev => ({ ...prev, isConnected: false }));
    }
  }, [socket, projectId]);

  /**
   * WebSocketメッセージの送信
   */
  const sendMessage = useCallback((message: any) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      logger.debug('WebSocketメッセージ送信', { projectId, message });
    } else {
      logger.warn('WebSocket未接続のためメッセージ送信不可', { projectId });
    }
  }, [socket, projectId]);

  /**
   * 同期イベントの処理
   */
  const handleSyncEvent = useCallback((event: GitHubSyncEvent) => {
    logger.debug('GitHub同期イベント受信', {
      projectId,
      eventType: event.type,
      data: event.data
    });

    setSyncState(prev => {
      const newState = { ...prev, lastUpdate: new Date() };

      switch (event.type) {
        case 'commit':
          newState.lastCommitHash = event.data.commitHash;
          break;

        case 'deploy':
          newState.deployStatus = event.data.status;
          newState.deployUrl = event.data.url;
          break;

        case 'auth':
          // GitHub認証状態の更新
          break;

        case 'error':
          logger.error('GitHub同期エラーイベント', {
            projectId,
            error: event.data.error
          });
          break;

        default:
          logger.warn('未知のGitHub同期イベント', {
            projectId,
            eventType: event.type
          });
      }

      return newState;
    });
  }, [projectId]);

  /**
   * コンポーネントマウント時の自動接続
   */
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  /**
   * プロジェクトIDが変更された時の再接続
   */
  useEffect(() => {
    if (isConnected && socket) {
      disconnect();
      setTimeout(connect, 100);
    }
  }, [projectId]);

  return {
    syncState,
    isConnected,
    connect,
    disconnect,
    sendMessage
  };
};