import { Request, Response, NextFunction } from 'express';
import { ExportFormat } from '../../types';
import { logger } from '../../common/utils/logger';

/**
 * エクスポート準備リクエストのバリデーション
 */
export const validatePrepareExport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId, format, optimize } = req.body;

    // 必須フィールドのチェック
    if (!projectId || typeof projectId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'プロジェクトIDが必要です'
      });
      return;
    }

    // プロジェクトIDの形式チェック
    if (projectId.trim() === '') {
      res.status(400).json({
        success: false,
        error: '無効なプロジェクトIDです'
      });
      return;
    }

    // フォーマットの検証
    if (!format || !Object.values(ExportFormat).includes(format)) {
      res.status(400).json({
        success: false,
        error: '無効なエクスポートフォーマットです。html または zip を指定してください'
      });
      return;
    }

    // 最適化フラグの検証（オプション）
    if (optimize !== undefined && typeof optimize !== 'boolean') {
      res.status(400).json({
        success: false,
        error: '最適化フラグはboolean値で指定してください'
      });
      return;
    }

    // プロジェクトIDのサニタイズ
    req.body.projectId = projectId.trim();

    // デフォルト値の設定
    if (optimize === undefined) {
      req.body.optimize = true;
    }

    logger.info('エクスポート準備リクエストの検証に成功しました', {
      projectId: req.body.projectId,
      format,
      optimize: req.body.optimize
    });

    next();
  } catch (error) {
    logger.error('エクスポート準備リクエストの検証中にエラーが発生しました', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    res.status(500).json({
      success: false,
      error: 'バリデーション中にエラーが発生しました'
    });
  }
};

/**
 * エクスポートダウンロードリクエストのバリデーション
 */
export const validateDownloadExport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { exportId } = req.params;

    if (!exportId) {
      res.status(400).json({
        success: false,
        error: 'エクスポートIDが必要です'
      });
      return;
    }

    // エクスポートIDの形式チェック
    if (!/^export_\d+$/.test(exportId)) {
      res.status(400).json({
        success: false,
        error: '無効なエクスポートIDの形式です'
      });
      return;
    }

    logger.info('エクスポートダウンロードリクエストの検証に成功しました', {
      exportId
    });

    next();
  } catch (error) {
    logger.error('エクスポートダウンロードリクエストの検証中にエラーが発生しました', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    res.status(500).json({
      success: false,
      error: 'バリデーション中にエラーが発生しました'
    });
  }
};

/**
 * エクスポート履歴取得リクエストのバリデーション
 */
export const validateExportHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      res.status(400).json({
        success: false,
        error: 'プロジェクトIDが必要です'
      });
      return;
    }

    // プロジェクトIDの形式チェック
    if (typeof projectId !== 'string' || projectId.trim() === '') {
      res.status(400).json({
        success: false,
        error: '無効なプロジェクトIDです'
      });
      return;
    }

    logger.info('エクスポート履歴取得リクエストの検証に成功しました', {
      projectId
    });

    next();
  } catch (error) {
    logger.error('エクスポート履歴取得リクエストの検証中にエラーが発生しました', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    res.status(500).json({
      success: false,
      error: 'バリデーション中にエラーが発生しました'
    });
  }
};

/**
 * ファイルサイズ制限の検証
 */
export const validateFileSize = (maxSizeInMB: number = 100) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const maxSizeInBytes = maxSizeInMB * 1024 * 1024;

      // Content-Lengthヘッダーからファイルサイズを確認
      const contentLength = req.headers['content-length'];
      if (contentLength) {
        const fileSize = parseInt(contentLength, 10);
        if (fileSize > maxSizeInBytes) {
          res.status(413).json({
            success: false,
            error: `ファイルサイズが制限値（${maxSizeInMB}MB）を超えています`
          });
          return;
        }
      }

      next();
    } catch (error) {
      logger.error('ファイルサイズ検証中にエラーが発生しました', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      res.status(500).json({
        success: false,
        error: 'ファイルサイズ検証中にエラーが発生しました'
      });
    }
  };
};

/**
 * レート制限の検証（エクスポート準備用）
 */
export const validateRateLimit = () => {
  const requestCounts: Map<string, { count: number; resetTime: number }> = new Map();
  const RATE_LIMIT_WINDOW = 60 * 1000; // 1分
  const MAX_REQUESTS = 5; // 1分間に5回まで

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: '認証が必要です'
        });
        return;
      }

      const now = Date.now();
      const userRequests = requestCounts.get(userId);

      if (!userRequests || now > userRequests.resetTime) {
        // 新しいウィンドウまたは初回リクエスト
        requestCounts.set(userId, {
          count: 1,
          resetTime: now + RATE_LIMIT_WINDOW
        });
      } else {
        // 既存のウィンドウ内
        if (userRequests.count >= MAX_REQUESTS) {
          const resetIn = Math.ceil((userRequests.resetTime - now) / 1000);
          res.status(429).json({
            success: false,
            error: `レート制限に達しました。${resetIn}秒後に再試行してください`,
            meta: {
              retryAfter: resetIn
            }
          });
          return;
        }

        userRequests.count++;
      }

      // レスポンスヘッダーに制限情報を追加
      const userRequestsAfter = requestCounts.get(userId)!;
      res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - userRequestsAfter.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(userRequestsAfter.resetTime / 1000));

      next();
    } catch (error) {
      logger.error('レート制限検証中にエラーが発生しました', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      res.status(500).json({
        success: false,
        error: 'レート制限検証中にエラーが発生しました'
      });
    }
  };
};

/**
 * セキュリティヘッダーの設定
 */
export const setSecurityHeaders = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // ダウンロード用のセキュリティヘッダー
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
};

/**
 * エクスポートフォーマットのサニタイズ
 */
export const sanitizeExportFormat = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (req.body.format && typeof req.body.format === 'string') {
    // 小文字に正規化
    req.body.format = req.body.format.toLowerCase().trim();
    
    // 許可されたフォーマットのチェック
    if (!Object.values(ExportFormat).includes(req.body.format as ExportFormat)) {
      res.status(400).json({
        success: false,
        error: '無効なエクスポートフォーマットです。html または zip を指定してください'
      });
      return;
    }
  }

  next();
};