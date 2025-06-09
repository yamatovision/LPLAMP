import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../common/utils/logger';
import { AuthenticatedUser } from '../types';
import { authenticateSocket } from './auth';
import { TerminalHandler } from './terminal-handler';

/**
 * WebSocketサーバーの初期化と設定
 */
export class WebSocketServer {
  private io: SocketIOServer;
  private terminalHandler: TerminalHandler;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env['FRONTEND_URL'] || "http://localhost:5173",
        credentials: true
      },
      path: '/ws/socket.io'
    });

    this.terminalHandler = new TerminalHandler();
    this.setupMiddleware();
    this.setupEventHandlers();
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