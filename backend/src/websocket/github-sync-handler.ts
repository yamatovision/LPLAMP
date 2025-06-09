/**
 * GitHub同期WebSocketハンドラー
 * 
 * GitHub関連のリアルタイム同期イベントを処理
 */

import { WebSocket } from 'ws';
import { ID, DeploymentStatus } from '../types/index.js';
import { logger } from '../common/utils/logger.js';
import { projectService } from '../features/projects/projects.service.js';

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
 * 接続されたクライアント情報
 */
interface ConnectedClient {
  ws: WebSocket;
  projectId: ID;
  userId?: ID;
  connectedAt: Date;
}

/**
 * GitHub同期WebSocketハンドラー
 */
export class GitHubSyncHandler {
  private clients = new Map<string, ConnectedClient>();
  private readonly HEARTBEAT_INTERVAL = 30000; // 30秒
  private heartbeatTimer?: NodeJS.Timeout;

  constructor() {
    this.startHeartbeat();
  }

  /**
   * クライアント接続の処理
   */
  handleConnection(ws: WebSocket, projectId: ID, userId?: ID): void {
    const clientId = this.generateClientId();
    
    const client: ConnectedClient = {
      ws,
      projectId,
      userId,
      connectedAt: new Date()
    };

    this.clients.set(clientId, client);

    logger.info('GitHub同期クライアント接続', {
      clientId,
      projectId,
      userId,
      totalClients: this.clients.size
    });

    // 接続確認メッセージ
    this.sendToClient(clientId, {
      type: 'auth',
      projectId,
      data: { 
        connected: true,
        message: 'GitHub同期WebSocket接続成功' 
      },
      timestamp: new Date().toISOString()
    });

    // WebSocketイベントハンドラーの設定
    this.setupClientHandlers(clientId, ws);
  }

  /**
   * クライアント切断の処理
   */
  handleDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      logger.info('GitHub同期クライアント切断', {
        clientId,
        projectId: client.projectId,
        userId: client.userId,
        totalClients: this.clients.size - 1
      });
      
      this.clients.delete(clientId);
    }
  }

  /**
   * コミットイベントの送信
   */
  async broadcastCommitEvent(
    projectId: ID, 
    commitHash: string, 
    message: string,
    userId?: ID
  ): Promise<void> {
    const event: GitHubSyncEvent = {
      type: 'commit',
      projectId,
      data: {
        commitHash,
        message,
        userId,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    await this.broadcastToProject(projectId, event);

    logger.info('コミットイベント送信', {
      projectId,
      commitHash: commitHash.substring(0, 7),
      message
    });
  }

  /**
   * デプロイイベントの送信
   */
  async broadcastDeployEvent(
    projectId: ID,
    status: DeploymentStatus,
    url?: string,
    logs?: string[]
  ): Promise<void> {
    const event: GitHubSyncEvent = {
      type: 'deploy',
      projectId,
      data: {
        status,
        url,
        logs,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    await this.broadcastToProject(projectId, event);

    logger.info('デプロイイベント送信', {
      projectId,
      status,
      url
    });
  }

  /**
   * エラーイベントの送信
   */
  async broadcastErrorEvent(
    projectId: ID,
    error: string,
    details?: any
  ): Promise<void> {
    const event: GitHubSyncEvent = {
      type: 'error',
      projectId,
      data: {
        error,
        details,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    await this.broadcastToProject(projectId, event);

    logger.error('GitHub同期エラーイベント送信', {
      projectId,
      error,
      details
    });
  }

  /**
   * 特定プロジェクトの全クライアントにイベント送信
   */
  private async broadcastToProject(
    projectId: ID, 
    event: GitHubSyncEvent
  ): Promise<void> {
    const projectClients = Array.from(this.clients.entries())
      .filter(([_, client]) => client.projectId === projectId);

    const broadcastPromises = projectClients.map(([clientId, _]) => 
      this.sendToClient(clientId, event)
    );

    await Promise.all(broadcastPromises);

    logger.debug('プロジェクトイベント送信完了', {
      projectId,
      eventType: event.type,
      clientCount: projectClients.length
    });
  }

  /**
   * 特定クライアントにメッセージ送信
   */
  private sendToClient(clientId: string, event: GitHubSyncEvent): Promise<void> {
    return new Promise((resolve) => {
      const client = this.clients.get(clientId);
      if (!client) {
        logger.warn('存在しないクライアントへの送信試行', { clientId });
        resolve();
        return;
      }

      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify(event));
          logger.debug('クライアントにメッセージ送信', {
            clientId,
            eventType: event.type
          });
        } catch (error) {
          logger.error('クライアントメッセージ送信エラー', {
            clientId,
            error: error instanceof Error ? error.message : String(error)
          });
          this.handleDisconnection(clientId);
        }
      } else {
        logger.debug('非アクティブクライアントを削除', { clientId });
        this.handleDisconnection(clientId);
      }

      resolve();
    });
  }

  /**
   * クライアントイベントハンドラーの設定
   */
  private setupClientHandlers(clientId: string, ws: WebSocket): void {
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(clientId, message);
      } catch (error) {
        logger.error('クライアントメッセージ解析エラー', {
          clientId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    ws.on('error', (error) => {
      logger.error('クライアントWebSocketエラー', {
        clientId,
        error: error.message
      });
      this.handleDisconnection(clientId);
    });

    ws.on('pong', () => {
      logger.debug('クライアントpong受信', { clientId });
    });
  }

  /**
   * クライアントからのメッセージ処理
   */
  private handleClientMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    logger.debug('クライアントメッセージ受信', {
      clientId,
      messageType: message.type,
      projectId: client.projectId
    });

    // クライアントからの特定メッセージ処理（必要に応じて拡張）
    switch (message.type) {
      case 'ping':
        this.sendToClient(clientId, {
          type: 'auth',
          projectId: client.projectId,
          data: { pong: true },
          timestamp: new Date().toISOString()
        });
        break;

      default:
        logger.debug('未対応クライアントメッセージ', {
          clientId,
          messageType: message.type
        });
    }
  }

  /**
   * ハートビート開始
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat();
    }, this.HEARTBEAT_INTERVAL);

    logger.debug('GitHub同期ハートビート開始', {
      interval: this.HEARTBEAT_INTERVAL
    });
  }

  /**
   * ハートビート実行
   */
  private performHeartbeat(): void {
    const activeClients = Array.from(this.clients.entries());
    
    activeClients.forEach(([clientId, client]) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.ping();
        } catch (error) {
          logger.error('ハートビートping送信エラー', {
            clientId,
            error: error instanceof Error ? error.message : String(error)
          });
          this.handleDisconnection(clientId);
        }
      } else {
        this.handleDisconnection(clientId);
      }
    });

    logger.debug('ハートビート実行完了', {
      totalClients: this.clients.size,
      activeClients: activeClients.length
    });
  }

  /**
   * クライアントID生成
   */
  private generateClientId(): string {
    return `github_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * サービス停止処理
   */
  shutdown(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    // 全クライアントを切断
    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close(1001, 'Server shutdown');
      }
    });

    this.clients.clear();

    logger.info('GitHub同期ハンドラー停止完了');
  }

  /**
   * 統計情報取得
   */
  getStats(): { totalClients: number; projectStats: Record<string, number> } {
    const projectStats: Record<string, number> = {};
    
    this.clients.forEach((client) => {
      projectStats[client.projectId] = (projectStats[client.projectId] || 0) + 1;
    });

    return {
      totalClients: this.clients.size,
      projectStats
    };
  }
}

/**
 * GitHub同期ハンドラーのシングルトンインスタンス
 */
export const githubSyncHandler = new GitHubSyncHandler();