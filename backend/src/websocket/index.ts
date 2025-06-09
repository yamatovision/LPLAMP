import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../common/utils/logger';
import { AuthenticatedUser } from '../types';
import { authenticateSocket } from './auth';
import { TerminalHandler } from './terminal-handler';
// import { GitHubSyncHandler } from './github-sync-handler'; // 未使用

/**
 * WebSocketサーバーの初期化と設定
 */
export class WebSocketServer {
  private io: SocketIOServer;
  private terminalHandler: TerminalHandler;
  // private githubSyncHandler: GitHubSyncHandler; // 未使用

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env['FRONTEND_URL'] || "http://localhost:5173",
        credentials: true
      },
      path: '/ws/socket.io'
    });

    this.terminalHandler = new TerminalHandler();
    // this.githubSyncHandler = new GitHubSyncHandler(); // 未使用
    
    console.log('WebSocketサーバー初期化開始');
    this.setupMiddleware();
    this.setupEventHandlers();
    this.setupGitHubSyncNamespace();
    console.log('WebSocketサーバー初期化完了');
  }

  /**
   * 認証ミドルウェアの設定
   */
  private setupMiddleware(): void {
    this.io.use(authenticateSocket);
  }

  /**
   * イベントハンドラーの設定
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      const user = socket.data.user as AuthenticatedUser;
      logger.info(`WebSocket接続確立: ${user.username} (${socket.id})`);

      // ターミナル関連のイベント処理
      this.terminalHandler.handleConnection(socket, user);

      // 切断時の処理
      socket.on('disconnect', (reason) => {
        logger.info(`WebSocket切断: ${user.username} (${socket.id}) - ${reason}`);
        this.terminalHandler.handleDisconnection(socket, user);
      });

      // エラーハンドリング
      socket.on('error', (error) => {
        logger.error(`WebSocketエラー: ${user.username} (${socket.id})`, { error });
      });
    });
  }

  /**
   * GitHub同期用の名前空間設定
   */
  private setupGitHubSyncNamespace(): void {
    const githubNamespace = this.io.of('/github-sync');
    
    console.log('GitHub同期名前空間を設定しました: /github-sync');
    
    // 認証ミドルウェア
    githubNamespace.use(authenticateSocket);
    
    githubNamespace.on('connection', (socket) => {
      const user = socket.data.user as AuthenticatedUser;
      const projectId = socket.handshake.auth['projectId'];
      
      logger.info(`GitHub同期WebSocket接続: ${user.username} - プロジェクト: ${projectId}`);
      
      // プロジェクトルームに参加
      if (projectId) {
        socket.join(`project:${projectId}`);
        console.log(`プロジェクトルーム参加: ${user.username} → project:${projectId}`, {
          socketId: socket.id,
          roomSize: githubNamespace.adapter.rooms.get(`project:${projectId}`)?.size || 0
        });
      }
      
      // デバッグ用イベント（テスト用）
      socket.on('debug:trigger-commit', (data) => {
        const commitData = {
          commitSha: 'test-sha-' + Date.now(),
          message: data.message || 'Test commit',
          timestamp: new Date().toISOString()
        };
        
        console.log(`ブロードキャストイベント送信: project:${projectId}`, {
          roomClients: githubNamespace.adapter.rooms.get(`project:${projectId}`)?.size || 0,
          totalClients: githubNamespace.sockets.size,
          commitData
        });
        
        // プロジェクトルーム内の全クライアントに送信（送信者も含む）
        githubNamespace.in(`project:${projectId}`).emit('commit', commitData);
      });
      
      socket.on('debug:trigger-deploy', (data) => {
        githubNamespace.to(`project:${projectId}`).emit('deploy', {
          status: data.status || 'completed',
          provider: data.provider || 'github-pages',
          url: data.url || 'https://test.github.io',
          timestamp: new Date().toISOString()
        });
      });
      
      socket.on('debug:trigger-error', (data) => {
        socket.emit('sync-error', {
          error: data.error || 'Test error',
          context: data.context || 'Testing',
          timestamp: new Date().toISOString()
        });
      });
      
      // ハートビート（テスト環境では短い間隔）
      const heartbeatDelay = process.env['NODE_ENV'] === 'test' ? 2000 : 30000;
      const heartbeatInterval = setInterval(() => {
        socket.emit('heartbeat', {
          timestamp: new Date().toISOString(),
          connectedClients: githubNamespace.sockets.size
        });
      }, heartbeatDelay);
      
      // 切断時の処理
      socket.on('disconnect', () => {
        clearInterval(heartbeatInterval);
        logger.info(`GitHub同期WebSocket切断: ${user.username}`);
      });
    });
  }

  /**
   * WebSocketサーバーの取得
   */
  public getIO(): SocketIOServer {
    return this.io;
  }

  /**
   * 特定ユーザーにメッセージ送信
   */
  public sendToUser(_userId: string, event: string, data: any): void {
    this.io.emit(event, data);
  }

  /**
   * サーバー終了時のクリーンアップ
   */
  public close(): void {
    this.terminalHandler.cleanup();
    this.io.close();
    logger.info('WebSocketサーバーを終了しました');
  }
}