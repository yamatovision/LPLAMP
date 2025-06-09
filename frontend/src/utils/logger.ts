/**
 * フロントエンド用ログユーティリティ
 * 
 * バックエンドのloggerと同様の構造で開発・デバッグ用のログ出力を提供
 */

export interface LogContext {
  [key: string]: any;
}

export class Logger {
  private isDevelopment = import.meta.env.DEV;

  /**
   * デバッグログ
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug('[DEBUG]', message, context || '');
    }
  }

  /**
   * 情報ログ
   */
  info(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.info('[INFO]', message, context || '');
    }
  }

  /**
   * 警告ログ
   */
  warn(message: string, context?: LogContext): void {
    console.warn('[WARN]', message, context || '');
  }

  /**
   * エラーログ
   */
  error(message: string, context?: LogContext): void {
    console.error('[ERROR]', message, context || '');
  }
}

/**
 * ログインスタンス
 */
export const logger = new Logger();