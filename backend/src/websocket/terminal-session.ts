import { spawn, ChildProcess } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import fs from 'fs/promises';
import { logger } from '../common/utils/logger';
import { TerminalMessage, TerminalMessageType } from '../types';

type MessageCallback = (message: TerminalMessage) => void;
type CloseCallback = () => void;

/**
 * 個別のターミナルセッション管理
 */
export class TerminalSession {
  private process: ChildProcess | null = null;
  private sessionId: string;
  private userId: string;
  private projectId: string;
  private workingDirectory: string;
  private messageCallback: MessageCallback | null = null;
  private closeCallback: CloseCallback | null = null;
  private isActive: boolean = false;

  constructor(sessionId: string, userId: string, projectId: string) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.projectId = projectId;
    
    // プロジェクト専用の作業ディレクトリを設定
    this.workingDirectory = path.join(
      process.env['PROJECTS_BASE_DIR'] || '/tmp/lplamp-projects',
      projectId
    );
  }

  /**
   * セッションの初期化
   */
  public async initialize(): Promise<void> {
    try {
      logger.info(`ターミナルセッション初期化: ${this.sessionId}`, {
        workingDirectory: this.workingDirectory,
        platform: os.platform()
      });

      // 作業ディレクトリの作成
      await this.ensureWorkingDirectory();

      // プラットフォームに応じたシェルの起動
      await this.startShell();

      this.isActive = true;
      logger.info(`ターミナルセッション初期化完了: ${this.sessionId}`);

    } catch (error) {
      logger.error(`ターミナルセッション初期化エラー: ${this.sessionId}`, { error });
      throw error;
    }
  }

  /**
   * 作業ディレクトリの確保
   */
  private async ensureWorkingDirectory(): Promise<void> {
    
    try {
      await fs.access(this.workingDirectory);
    } catch {
      // ディレクトリが存在しない場合は作成
      await fs.mkdir(this.workingDirectory, { recursive: true });
      logger.info(`作業ディレクトリ作成: ${this.workingDirectory}`);
    }
  }

  /**
   * シェルプロセスの起動
   */
  private async startShell(): Promise<void> {
    const platform = os.platform();
    const shell = platform === 'win32' ? 'cmd.exe' : '/bin/bash';
    const args = platform === 'win32' ? [] : ['-i'];

    logger.debug(`シェル起動: ${shell}`, { args, cwd: this.workingDirectory });

    this.process = spawn(shell, args, {
      cwd: this.workingDirectory,
      env: {
        ...process.env,
        // ClaudeCode特有の環境変数を設定
        CLAUDECODE_SESSION_ID: this.sessionId,
        CLAUDECODE_PROJECT_ID: this.projectId,
        CLAUDECODE_USER_ID: this.userId,
        // カラー出力を有効化
        FORCE_COLOR: '1',
        TERM: 'xterm-256color'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // 標準出力の処理
    this.process.stdout?.on('data', (data: Buffer) => {
      this.sendMessage({
        type: TerminalMessageType.OUTPUT,
        data: data.toString(),
        timestamp: new Date().toISOString()
      });
    });

    // 標準エラーの処理
    this.process.stderr?.on('data', (data: Buffer) => {
      this.sendMessage({
        type: TerminalMessageType.ERROR,
        data: data.toString(),
        timestamp: new Date().toISOString()
      });
    });

    // プロセス終了の処理
    this.process.on('close', (code: number | null, signal: string | null) => {
      logger.info(`シェルプロセス終了: ${this.sessionId}`, { code, signal });
      this.isActive = false;
      
      this.sendMessage({
        type: TerminalMessageType.SYSTEM,
        data: `\\nセッション終了 (終了コード: ${code || signal || 'unknown'})\\n`,
        timestamp: new Date().toISOString()
      });

      if (this.closeCallback) {
        this.closeCallback();
      }
    });

    // プロセスエラーの処理
    this.process.on('error', (error: Error) => {
      logger.error(`シェルプロセスエラー: ${this.sessionId}`, { error });
      this.isActive = false;
      
      this.sendMessage({
        type: TerminalMessageType.ERROR,
        data: `プロセスエラー: ${error.message}\\n`,
        timestamp: new Date().toISOString()
      });

      if (this.closeCallback) {
        this.closeCallback();
      }
    });

    // プロセスの準備完了まで少し待機
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * 入力の送信
   */
  public async sendInput(input: string): Promise<void> {
    if (!this.process || !this.isActive) {
      throw new Error('セッションが非アクティブです');
    }

    if (!this.process.stdin) {
      throw new Error('標準入力が利用できません');
    }

    // 入力メッセージをエコー
    this.sendMessage({
      type: TerminalMessageType.INPUT,
      data: input,
      timestamp: new Date().toISOString()
    });

    // プロセスに入力を送信
    try {
      this.process.stdin.write(input);
    } catch (error) {
      logger.error(`入力送信エラー: ${this.sessionId}`, { error });
      throw error;
    }
  }

  /**
   * メッセージコールバックの設定
   */
  public onMessage(callback: MessageCallback): void {
    this.messageCallback = callback;
  }

  /**
   * クローズコールバックの設定
   */
  public onClose(callback: CloseCallback): void {
    this.closeCallback = callback;
  }

  /**
   * メッセージの送信
   */
  private sendMessage(message: TerminalMessage): void {
    if (this.messageCallback) {
      this.messageCallback(message);
    }
  }

  /**
   * セッション情報の取得
   */
  public getSessionId(): string {
    return this.sessionId;
  }

  public getUserId(): string {
    return this.userId;
  }

  public getProjectId(): string {
    return this.projectId;
  }

  public getWorkingDirectory(): string {
    return this.workingDirectory;
  }

  public getStatus(): 'active' | 'inactive' | 'error' {
    if (!this.process) return 'inactive';
    if (!this.isActive) return 'error';
    return 'active';
  }

  /**
   * セッションの破棄
   */
  public destroy(): void {
    logger.info(`ターミナルセッション破棄: ${this.sessionId}`);
    
    this.isActive = false;

    if (this.process) {
      try {
        // プロセスの強制終了
        this.process.kill('SIGTERM');
        
        // 一定時間後に強制終了
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
            logger.warn(`強制終了: ${this.sessionId}`);
          }
        }, 5000);

      } catch (error) {
        logger.error(`プロセス終了エラー: ${this.sessionId}`, { error });
      }

      this.process = null;
    }

    // コールバックのクリア
    this.messageCallback = null;
    this.closeCallback = null;
  }
}