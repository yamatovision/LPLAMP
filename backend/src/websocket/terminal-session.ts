import { spawn, ChildProcess, exec } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { promisify } from 'util';
import { logger } from '../common/utils/logger';
import { TerminalMessage, TerminalMessageType } from '../types';

type MessageCallback = (message: TerminalMessage) => void;
type CloseCallback = () => void;

const execAsync = promisify(exec);

/**
 * ClaudeCode CLIセッション管理
 * 独自シェルではなく、ClaudeCode CLIプロセスを直接起動・管理
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
  private isClaudeCodeReady: boolean = false;
  private initialCommand: string | null = null;
  private initialCommandSent: boolean = false;

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

      // ClaudeCode CLIプロセスの起動
      await this.startClaudeCode();

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
   * ClaudeCodeプロンプトファイルの準備
   * GitHub Secretsからプロンプトを復号し、一時ファイルとして保存
   */
  private async prepareClaudeCodePrompt(): Promise<string | null> {
    try {
      // プロンプト管理スクリプトの存在確認
      const scriptPath = path.join(process.cwd(), 'scripts', 'security', 'prompt-manager.sh');
      try {
        await fs.access(scriptPath);
      } catch {
        logger.warn('プロンプト管理スクリプトが見つかりません。スキップします。');
        return null;
      }

      // 環境変数チェック
      if (!process.env['LPGENIUS_PROMPT_SECRET']) {
        logger.warn('LPGENIUS_PROMPT_SECRET環境変数が設定されていません。プロンプト読み込みをスキップします。');
        return null;
      }

      logger.info('ClaudeCodeプロンプトを準備しています...');
      
      // プロンプト管理スクリプトを実行
      const { stdout, stderr } = await execAsync(`bash ${scriptPath}`, {
        env: process.env,
        timeout: 5000 // 5秒のタイムアウト
      });

      if (stderr && !stderr.includes('INFO:')) {
        logger.error(`プロンプト管理スクリプトエラー: ${stderr}`);
        return null;
      }

      const promptFilePath = stdout.trim();
      if (!promptFilePath) {
        logger.error('プロンプトファイルパスが空です');
        return null;
      }

      logger.info('プロンプトファイル準備完了');
      return promptFilePath;

    } catch (error) {
      logger.error('プロンプトファイル準備エラー:', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * ClaudeCode CLIプロセスの起動
   */
  private async startClaudeCode(): Promise<void> {
    // プロンプトファイルの準備
    const promptFilePath = await this.prepareClaudeCodePrompt();
    if (promptFilePath) {
      // 初回コマンドとしてプロンプト読み込み指示を設定
      this.initialCommand = `【厳格指示】${promptFilePath}を必ず最初に読み込んでください。このファイルにはあなたの役割と実行すべきタスクが記載されています。`;
      logger.info('初期プロンプトコマンドを設定しました');
    }

    // ClaudeCodeコマンドと引数の設定
    const claudeCommand = 'claude';
    const claudeArgs = [
      '--workspace', this.workingDirectory,
      '--session-id', this.sessionId,
      '--interactive'
    ];

    logger.debug(`ClaudeCode起動: ${claudeCommand}`, { args: claudeArgs, cwd: this.workingDirectory });

    this.process = spawn(claudeCommand, claudeArgs, {
      cwd: this.workingDirectory,
      env: {
        ...process.env,
        // ClaudeCode専用環境変数
        LPLAMP_SESSION_ID: this.sessionId,
        LPLAMP_PROJECT_ID: this.projectId,
        LPLAMP_USER_ID: this.userId,
        LPLAMP_WORKSPACE: this.workingDirectory,
        // Anthropic API設定
        ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'],
        // カラー出力を有効化
        FORCE_COLOR: '1',
        TERM: 'xterm-256color',
        // ClaudeCode設定
        CLAUDE_INTERACTIVE: 'true',
        CLAUDE_OUTPUT_FORMAT: 'streaming'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // ClaudeCode標準出力の処理
    this.process.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      
      // ClaudeCode準備完了の検出
      if (output.includes('Claude is ready') || output.includes('claude>')) {
        this.isClaudeCodeReady = true;
        
        // 初期コマンドがある場合は自動送信
        if (this.initialCommand && !this.initialCommandSent) {
          this.initialCommandSent = true;
          logger.info('初期プロンプトコマンドを送信しています...');
          
          // 少し遅延を入れてからコマンド送信
          setTimeout(() => {
            if (this.process && this.process.stdin) {
              this.process.stdin.write(this.initialCommand + '\n');
              this.sendMessage({
                type: TerminalMessageType.SYSTEM,
                data: '🤖 精密差し替えエージェントプロンプトを読み込みました\n',
                timestamp: new Date().toISOString()
              });
            }
          }, 500); // 500ms待機
        } else {
          this.sendMessage({
            type: TerminalMessageType.SYSTEM,
            data: '🤖 ClaudeCode準備完了 - 編集指示を入力してください\n',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      this.sendMessage({
        type: TerminalMessageType.OUTPUT,
        data: output,
        timestamp: new Date().toISOString()
      });
    });

    // ClaudeCode標準エラーの処理
    this.process.stderr?.on('data', (data: Buffer) => {
      const error = data.toString();
      
      // API認証エラーの特別処理
      if (error.includes('API key') || error.includes('authentication')) {
        this.sendMessage({
          type: TerminalMessageType.ERROR,
          data: '❌ ClaudeCode認証エラー: ANTHROPIC_API_KEYを確認してください\n',
          timestamp: new Date().toISOString()
        });
      } else {
        this.sendMessage({
          type: TerminalMessageType.ERROR,
          data: error,
          timestamp: new Date().toISOString()
        });
      }
    });

    // ClaudeCodeプロセス終了の処理
    this.process.on('close', (code: number | null, signal: string | null) => {
      logger.info(`ClaudeCodeプロセス終了: ${this.sessionId}`, { code, signal });
      this.isActive = false;
      this.isClaudeCodeReady = false;
      
      const exitMessage = code === 0 
        ? '✅ ClaudeCodeセッション正常終了'
        : `❌ ClaudeCodeセッション異常終了 (終了コード: ${code || signal || 'unknown'})`;
      
      this.sendMessage({
        type: TerminalMessageType.SYSTEM,
        data: `\n${exitMessage}\n`,
        timestamp: new Date().toISOString()
      });

      if (this.closeCallback) {
        this.closeCallback();
      }
    });

    // ClaudeCodeプロセスエラーの処理
    this.process.on('error', (error: Error) => {
      logger.error(`ClaudeCodeプロセスエラー: ${this.sessionId}`, { error });
      this.isActive = false;
      this.isClaudeCodeReady = false;
      
      // ClaudeCode未インストールの場合の特別処理
      if (error.message.includes('ENOENT') || error.message.includes('command not found')) {
        this.sendMessage({
          type: TerminalMessageType.ERROR,
          data: '❌ ClaudeCode CLIが見つかりません\n' +
                '🔧 インストール: npm install -g @anthropic-ai/claude-code\n',
          timestamp: new Date().toISOString()
        });
      } else {
        this.sendMessage({
          type: TerminalMessageType.ERROR,
          data: `❌ ClaudeCodeエラー: ${error.message}\n`,
          timestamp: new Date().toISOString()
        });
      }

      if (this.closeCallback) {
        this.closeCallback();
      }
    });

    // プロセスの準備完了まで少し待機
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * ClaudeCodeへの入力送信
   */
  public async sendInput(input: string): Promise<void> {
    if (!this.process || !this.isActive) {
      throw new Error('ClaudeCodeセッションが非アクティブです');
    }

    if (!this.process.stdin) {
      throw new Error('ClaudeCode標準入力が利用できません');
    }

    // ClaudeCodeの準備状態チェック
    if (!this.isClaudeCodeReady) {
      this.sendMessage({
        type: TerminalMessageType.SYSTEM,
        data: '⚠️ ClaudeCodeの準備が完了していません。しばらくお待ちください...\n',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 入力メッセージをエコー（ユーザー入力として表示）
    this.sendMessage({
      type: TerminalMessageType.INPUT,
      data: `👤 ${input}`,
      timestamp: new Date().toISOString()
    });

    // ClaudeCodeに入力を送信
    try {
      // 改行を追加してClaudeCodeがコマンドとして認識するようにする
      const command = input.endsWith('\n') ? input : input + '\n';
      this.process.stdin.write(command);
      
      logger.debug(`ClaudeCode入力送信: ${this.sessionId}`, { 
        input: input.substring(0, 100),
        length: input.length 
      });
    } catch (error) {
      logger.error(`ClaudeCode入力送信エラー: ${this.sessionId}`, { error });
      this.sendMessage({
        type: TerminalMessageType.ERROR,
        data: `❌ 入力送信エラー: ${error}\n`,
        timestamp: new Date().toISOString()
      });
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