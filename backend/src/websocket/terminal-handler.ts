import { Socket } from 'socket.io';
import { TerminalSession } from './terminal-session';
import { logger } from '../common/utils/logger';
import { AuthenticatedUser, TerminalMessage, TerminalMessageType } from '../types';

/**
 * ClaudeCodeセッション管理とメッセージ処理
 * 独自ターミナルではなく、ClaudeCode CLIとの直接連携を管理
 */
export class TerminalHandler {
  private sessions: Map<string, TerminalSession> = new Map();

  /**
   * WebSocket接続時の処理
   */
  public handleConnection(socket: Socket, user: AuthenticatedUser): void {
    logger.info(`ClaudeCodeハンドラー: 接続処理開始 - ${user.username}`);

    // ClaudeCodeセッション開始イベント
    socket.on('terminal:start', async (data: { projectId: string }) => {
      try {
        await this.startTerminalSession(socket, user, data.projectId);
      } catch (error) {
        logger.error(`ClaudeCodeセッション開始エラー:`, { error, userId: user.id, projectId: data.projectId });
        socket.emit('terminal:error', { message: 'ClaudeCodeセッションの開始に失敗しました' });
      }
    });

    // ClaudeCode入力送信イベント
    socket.on('terminal:input', async (data: { sessionId: string; input: string }) => {
      try {
        await this.handleInput(socket, user, data.sessionId, data.input);
      } catch (error) {
        logger.error(`ClaudeCode入力処理エラー:`, { error, userId: user.id, sessionId: data.sessionId });
        socket.emit('terminal:error', { message: 'ClaudeCodeへの入力送信に失敗しました' });
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

    // 要素情報をClaudeCodeに送信するイベント
    socket.on('terminal:element-context', async (data: { 
      sessionId: string; 
      element: {
        selector: string;
        tagName: string;
        text: string;
        html: string;
        styles: Record<string, string>;
      }
    }) => {
      try {
        await this.sendElementContext(socket, user, data.sessionId, data.element);
      } catch (error) {
        logger.error(`要素コンテキスト送信エラー:`, { error, userId: user.id, sessionId: data.sessionId });
        socket.emit('terminal:error', { message: '要素情報の送信に失敗しました' });
      }
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
      data: `🚀 ClaudeCode セッション開始 (Project: ${projectId})\n` +
            `📁 作業ディレクトリ: ${session.getWorkingDirectory()}\n` +
            `⚡ 要素をクリックして編集を開始してください\n` +
            `🤖 ClaudeCodeの準備が完了するまでお待ちください...\n`,
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

  /**
   * 要素情報をClaudeCodeセッションに送信
   */
  private async sendElementContext(
    socket: Socket, 
    user: AuthenticatedUser, 
    sessionId: string, 
    element: {
      selector: string;
      tagName: string;
      text: string;
      html: string;
      styles: Record<string, string>;
    }
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      socket.emit('terminal:error', { message: `ClaudeCodeセッションが見つかりません: ${sessionId}` });
      return;
    }

    if (session.getUserId() !== user.id) {
      socket.emit('terminal:error', { message: '他のユーザーのセッションにはアクセスできません' });
      return;
    }

    // 要素情報をClaudeCodeが理解しやすい形式で整形
    const contextMessage = `
📍 編集対象要素が選択されました:

**要素情報:**
- セレクター: ${element.selector}
- タグ: ${element.tagName}
- テキスト内容: "${element.text.substring(0, 100)}${element.text.length > 100 ? '...' : ''}"

**スタイル情報:**
${Object.entries(element.styles)
  .filter(([, value]) => value && value !== 'initial' && value !== 'auto')
  .map(([styleName, value]) => `- ${styleName}: ${value}`)
  .slice(0, 10)
  .join('\n')}

**HTML構造:**
\`\`\`html
${element.html.substring(0, 500)}${element.html.length > 500 ? '...' : ''}
\`\`\`

この要素を編集したい場合は、具体的な編集内容を指示してください。
例：「このテキストを『新しいタイトル』に変更して」
    `.trim();

    logger.info(`要素コンテキスト送信: ${sessionId}`, {
      selector: element.selector,
      tagName: element.tagName,
      textLength: element.text.length
    });

    // ClaudeCodeに要素情報を送信
    await session.sendInput(contextMessage);

    // フロントエンドに送信完了を通知
    socket.emit('terminal:element-sent', { sessionId, element: element.selector });
  }
}