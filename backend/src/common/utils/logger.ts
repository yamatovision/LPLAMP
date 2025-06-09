/**
 * ロガーユーティリティ
 * 
 * 構造化ログとレベル別出力を提供
 * 開発環境と本番環境で適切なログレベルを設定
 */

/**
 * ログレベル定義
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * ログメッセージ構造
 */
export interface LogMessage {
  timestamp: string;
  level: string;
  message: string;
  context?: Record<string, any>;
  stack?: string;
}

/**
 * ロガー設定
 */
interface LoggerConfig {
  level: LogLevel;
  enableTimestamp: boolean;
  enableContext: boolean;
  enableColors: boolean;
}

/**
 * 環境別デフォルト設定
 */
function getDefaultConfig(): LoggerConfig {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const isDevelopment = process.env['NODE_ENV'] === 'development';
  
  return {
    level: isDevelopment ? LogLevel.DEBUG : LogLevel.INFO,
    enableTimestamp: true,
    enableContext: true,
    enableColors: !isProduction,
  };
}

/**
 * 色付きログ出力用の色定義
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

/**
 * ログレベル別の色とラベル
 */
const levelConfig = {
  [LogLevel.DEBUG]: { label: 'DEBUG', color: colors.gray },
  [LogLevel.INFO]: { label: 'INFO', color: colors.blue },
  [LogLevel.WARN]: { label: 'WARN', color: colors.yellow },
  [LogLevel.ERROR]: { label: 'ERROR', color: colors.red },
};

/**
 * Logger クラス
 */
class Logger {
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = { ...getDefaultConfig(), ...config };
  }

  /**
   * タイムスタンプの生成
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * ログレベルのチェック
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  /**
   * 色付きテキストの生成
   */
  private colorize(text: string, color: string): string {
    if (!this.config.enableColors) {
      return text;
    }
    return `${color}${text}${colors.reset}`;
  }

  /**
   * コンテキストの文字列化
   */
  private formatContext(context?: Record<string, any>): string {
    if (!context || !this.config.enableContext) {
      return '';
    }

    try {
      const formatted = JSON.stringify(context, null, 2);
      return `\n${formatted}`;
    } catch (error) {
      return `\n[Context serialization error: ${error}]`;
    }
  }

  /**
   * ログメッセージのフォーマット
   */
  private formatMessage(level: LogLevel, message: string, context?: Record<string, any>, stack?: string): string {
    const config = levelConfig[level];
    const timestamp = this.config.enableTimestamp ? this.getTimestamp() : '';
    
    let formatted = '';
    
    // タイムスタンプ
    if (timestamp) {
      formatted += this.colorize(`[${timestamp}]`, colors.dim) + ' ';
    }
    
    // ログレベル
    formatted += this.colorize(`[${config.label}]`, config.color) + ' ';
    
    // メッセージ
    formatted += message;
    
    // コンテキスト
    const contextStr = this.formatContext(context);
    if (contextStr) {
      formatted += this.colorize(contextStr, colors.dim);
    }
    
    // スタックトレース
    if (stack) {
      formatted += '\n' + this.colorize(stack, colors.dim);
    }
    
    return formatted;
  }

  /**
   * ログ出力の実行
   */
  private output(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const stack = error?.stack;
    const formatted = this.formatMessage(level, message, context, stack);
    
    // レベルに応じた出力先の選択
    if (level >= LogLevel.ERROR) {
      console.error(formatted);
    } else if (level >= LogLevel.WARN) {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  /**
   * JSON形式でのログ出力（本番環境用）
   */
  private outputJson(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logMessage: LogMessage = {
      timestamp: this.getTimestamp(),
      level: levelConfig[level].label,
      message,
    };

    if (context) {
      logMessage.context = context;
    }

    if (error?.stack) {
      logMessage.stack = error.stack;
    }

    const output = JSON.stringify(logMessage);
    
    if (level >= LogLevel.ERROR) {
      console.error(output);
    } else if (level >= LogLevel.WARN) {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  /**
   * 出力方式の選択
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    const isProduction = process.env['NODE_ENV'] === 'production';
    
    if (isProduction) {
      this.outputJson(level, message, context, error);
    } else {
      this.output(level, message, context, error);
    }
  }

  /**
   * DEBUGログ
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * INFOログ
   */
  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * WARNログ
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * ERRORログ
   */
  error(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * 設定の更新
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

/**
 * デフォルトロガーインスタンス
 */
export const logger = new Logger();

/**
 * カスタムロガーの作成
 */
export function createLogger(config?: Partial<LoggerConfig>): Logger {
  return new Logger(config);
}

/**
 * ログレベルの設定
 */
export function setLogLevel(level: LogLevel): void {
  logger.updateConfig({ level });
}

/**
 * リクエスト用のロガー（将来の拡張用）
 */
export function createRequestLogger(_requestId: string): Logger {
  return createLogger({
    enableContext: true,
  });
}

/**
 * エラーの詳細ログ出力
 */
export function logError(message: string, error: Error, context?: Record<string, any>): void {
  logger.error(message, {
    ...context,
    errorName: error.name,
    errorMessage: error.message,
  }, error);
}

/**
 * パフォーマンス計測用のロガー
 */
export class PerformanceLogger {
  private startTime: number;
  private operation: string;

  constructor(operation: string) {
    this.operation = operation;
    this.startTime = Date.now();
    logger.debug(`開始: ${operation}`);
  }

  /**
   * 完了ログの出力
   */
  end(context?: Record<string, any>): void {
    const duration = Date.now() - this.startTime;
    logger.info(`完了: ${this.operation}`, {
      ...context,
      duration: `${duration}ms`,
    });
  }

  /**
   * エラー完了ログの出力
   */
  error(error: Error, context?: Record<string, any>): void {
    const duration = Date.now() - this.startTime;
    logger.error(`エラー: ${this.operation}`, {
      ...context,
      duration: `${duration}ms`,
    }, error);
  }
}

/**
 * パフォーマンス計測の開始
 */
export function startPerformanceLog(operation: string): PerformanceLogger {
  return new PerformanceLogger(operation);
}