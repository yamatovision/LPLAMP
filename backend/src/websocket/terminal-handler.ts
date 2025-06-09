import { Socket } from 'socket.io';
import { TerminalSession } from './terminal-session';
import { logger } from '../common/utils/logger';
import { AuthenticatedUser, TerminalMessage, TerminalMessageType } from '../types';

/**
 * ターミナルセッション管理とメッセージ処理
 */
export class TerminalHandler {
  private sessions: Map<string, TerminalSession> = new Map();

  /**
   * WebSocket接続時の処理
   */
  public handleConnection(socket: Socket, user: AuthenticatedUser): void {
    logger.info(`ターミナルハンドラー: 接続処理開始 - ${user.username}`);

    // ターミナル開始イベント
    socket.on('terminal:start', async (data: { projectId: string }) => {
      try {
        await this.startTerminalSession(socket, user, data.projectId);
      } catch (error) {
        logger.error(`ターミナルセッション開始エラー:`, { error, userId: user.id, projectId: data.projectId });
        socket.emit('terminal:error', { message: 'ターミナルセッションの開始に失敗しました' });
      }
    });

    // メッセージ送信イベント
    socket.on('terminal:input', async (data: { sessionId: string; input: string }) => {
      try {
        await this.handleInput(socket, user, data.sessionId, data.input);
      } catch (error) {
        logger.error(`ターミナル入力処理エラー:`, { error, userId: user.id, sessionId: data.sessionId });
        socket.emit('terminal:error', { message: 'コマンドの実行に失敗しました' });
      }
    });

    // ターミナル終了イベント
    socket.on('terminal:stop', async (data: { sessionId: string }) => {
      try {
        await this.stopTerminalSession(socket, user, data.sessionId);
      } catch (error) {
        logger.error(`ターミナルセッション終了エラー:`, { error, userId: user.id, sessionId: data.sessionId });
      }
    });

    // セッション状態確認イベント
    socket.on('terminal:status', (data: { sessionId: string }) => {
      const session = this.sessions.get(data.sessionId);
      const status = session ? session.getStatus() : 'not_found';
      socket.emit('terminal:status', { sessionId: data.sessionId, status });
    });
  }

  /**
   * WebSocket切断時の処理
   */
  public handleDisconnection(_socket: Socket, user: AuthenticatedUser): void {
    logger.info(`ターミナルハンドラー: 切断処理開始 - ${user.username}`);
    
    // ユーザーのすべてのセッションを終了
    const userSessions = Array.from(this.sessions.entries())
      .filter(([_, session]) => session.getUserId() === user.id);

    userSessions.forEach(([sessionId, session]) => {
      try {
        session.destroy();
        this.sessions.delete(sessionId);
        logger.info(`ターミナルセッション強制終了: ${sessionId}`);
      } catch (error) {
        logger.error(`セッション終了エラー: ${sessionId}`, { error });
      }
    });
  }

  /**
   * ターミナルセッションの開始
   */
  private async startTerminalSession(socket: Socket, user: AuthenticatedUser, projectId: string): Promise<void> {
    const sessionId = `terminal_${user.id}_${projectId}_${Date.now()}`;
    
    logger.info(`ターミナルセッション開始: ${sessionId}`, { 
      userId: user.id, 
      projectId,
      socketId: socket.id 
    });

    const session = new TerminalSession(sessionId, user.id, projectId);
    
    // セッションからのメッセージをソケットに転送
    session.onMessage((message: TerminalMessage) => {
      socket.emit('terminal:output', {
        sessionId,
        message
      });
    });

    // セッション終了時の処理
    session.onClose(() => {
      this.sessions.delete(sessionId);
      socket.emit('terminal:closed', { sessionId });
      logger.info(`ターミナルセッション終了: ${sessionId}`);
    });

    await session.initialize();
    this.sessions.set(sessionId, session);

    // セッション開始の通知
    socket.emit('terminal:started', { 
      sessionId,
      projectId,
      workingDirectory: session.getWorkingDirectory()
    });

    // 初期メッセージの送信
    const welcomeMessage: TerminalMessage = {
      type: TerminalMessageType.SYSTEM,
      data: `ClaudeCode ターミナル (Project: ${projectId})\\n準備完了 - コマンドを入力してください\\n`,
      timestamp: new Date().toISOString()
    };
    
    socket.emit('terminal:output', {
      sessionId,
      message: welcomeMessage
    });
  }

  /**
   * ターミナル入力の処理
   */
  private async handleInput(socket: Socket, user: AuthenticatedUser, sessionId: string, input: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      socket.emit('terminal:error', { message: `セッションが見つかりません: ${sessionId}` });
      return;
    }

    if (session.getUserId() !== user.id) {
      socket.emit('terminal:error', { message: '他のユーザーのセッションにはアクセスできません' });
      return;
    }

    logger.debug(`ターミナル入力: ${sessionId}`, { input: input.substring(0, 100) });

    // 入力をセッションに送信
    await session.sendInput(input);
  }

  /**
   * ターミナルセッションの停止
   */
  private async stopTerminalSession(socket: Socket, user: AuthenticatedUser, sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      logger.warn(`停止対象のセッションが見つかりません: ${sessionId}`);
      return;
    }

    if (session.getUserId() !== user.id) {
      socket.emit('terminal:error', { message: '他のユーザーのセッションは停止できません' });
      return;
    }

    logger.info(`ターミナルセッション停止: ${sessionId}`);

    try {
      session.destroy();
      this.sessions.delete(sessionId);
      socket.emit('terminal:stopped', { sessionId });
    } catch (error) {
      logger.error(`セッション停止エラー: ${sessionId}`, { error });
      socket.emit('terminal:error', { message: 'セッションの停止に失敗しました' });
    }
  }

  /**
   * クリーンアップ処理
   */
  public cleanup(): void {
    logger.info(`ターミナルハンドラークリーンアップ: ${this.sessions.size}セッション終了`);
    
    this.sessions.forEach((session, sessionId) => {
      try {
        session.destroy();
        logger.info(`セッション強制終了: ${sessionId}`);
      } catch (error) {
        logger.error(`セッション終了エラー: ${sessionId}`, { error });
      }
    });

    this.sessions.clear();
  }

  /**
   * アクティブセッション数の取得
   */
  public getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * 特定ユーザーのセッション数の取得
   */
  public getUserSessionCount(userId: string): number {
    return Array.from(this.sessions.values())
      .filter(session => session.getUserId() === userId).length;
  }
}