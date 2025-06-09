/**
 * 認証ミドルウェア
 * 
 * JWT認証を実装し、リクエストごとにユーザー認証を確認
 * 認証必須エンドポイントの保護を行う
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWTPayload, PUBLIC_ENDPOINTS } from '../../types/index.js';
import { userRepository } from '../../features/auth/auth.model.js';
import { validateJWTPayload, throwIfInvalid } from '../../features/auth/auth.validator.js';
import { logger } from '../utils/logger.js';

// グローバル型拡張（../../types/index.ts）を使用

/**
 * 認証エラーの詳細情報
 */
export interface AuthErrorDetails {
  code: string;
  message: string;
  context?: Record<string, any>;
}

/**
 * 認証エラーレスポンス
 */
export interface AuthErrorResponse {
  success: false;
  error: string;
  meta: {
    code: string;
    message: string;
  };
  details?: Record<string, any>;
}

/**
 * 環境変数取得（必須チェック付き）
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`必須の環境変数が設定されていません: ${key}`);
  }
  return value;
}

/**
 * JWTシークレットキーの取得
 */
function getJWTSecret(): string {
  return getRequiredEnv('JWT_SECRET');
}

/**
 * Authorization ヘッダーからトークンを抽出
 */
function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1] || null;
}

/**
 * リクエストからトークンを抽出（Cookieまたはヘッダー）
 */
function extractToken(req: Request): string | null {
  // 1. Cookieからトークンを取得
  const cookieToken = req.cookies?.['authToken'];
  if (cookieToken) {
    return cookieToken;
  }

  // 2. Authorizationヘッダーからトークンを取得
  return extractTokenFromHeader(req.headers.authorization);
}

/**
 * JWT トークンの検証
 */
async function verifyJWTToken(token: string): Promise<JWTPayload> {
  try {
    const secret = getJWTSecret();
    const payload = jwt.verify(token, secret) as any;
    
    // ペイロードの構造検証
    const validation = validateJWTPayload(payload);
    throwIfInvalid(validation);
    
    return payload as JWTPayload;
  } catch (error) {
    logger.warn('JWT検証エラー', {
      error: error instanceof Error ? error.message : String(error),
      tokenLength: token.length,
    });
    
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthError('TOKEN_EXPIRED', 'トークンが期限切れです');
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthError('INVALID_TOKEN', 'トークンが無効です');
    }
    
    throw new AuthError('TOKEN_VERIFICATION_FAILED', 'トークンの検証に失敗しました');
  }
}

/**
 * ユーザー存在確認
 */
async function verifyUserExists(userId: string): Promise<void> {
  try {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AuthError('USER_NOT_FOUND', 'ユーザーが見つかりません');
    }
    
    logger.debug('ユーザー認証成功', {
      userId: user.id,
      username: user.username,
    });
  } catch (error) {
    logger.error('ユーザー存在確認エラー', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    
    if (error instanceof AuthError) {
      throw error;
    }
    
    throw new AuthError('USER_VERIFICATION_FAILED', 'ユーザーの確認に失敗しました');
  }
}

/**
 * 認証エラークラス
 */
export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * エラーレスポンスの生成
 */
function createErrorResponse(
  error: AuthError,
  statusCode: number = 401
): { statusCode: number; response: AuthErrorResponse } {
  const response: AuthErrorResponse = {
    success: false,
    error: error.message,
    meta: {
      code: error.code,
      message: error.message,
    },
  };

  if (error.context) {
    response.details = error.context;
  }

  return { statusCode, response };
}

/**
 * パスが認証対象外かどうかをチェック
 */
function isPublicEndpoint(path: string): boolean {
  return PUBLIC_ENDPOINTS.some(publicPath => {
    // 完全一致
    if (publicPath === path) {
      return true;
    }
    
    // ワイルドカード対応（将来の拡張用）
    if (publicPath.endsWith('*')) {
      const basePath = publicPath.slice(0, -1);
      return path.startsWith(basePath);
    }
    
    return false;
  });
}

/**
 * リクエストログの出力
 */
function logRequest(req: Request, success: boolean, details?: Record<string, any>): void {
  const baseLog = {
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    success,
    ...details,
  };

  if (success) {
    logger.info('認証成功', baseLog);
  } else {
    logger.warn('認証失敗', baseLog);
  }
}

/**
 * メイン認証ミドルウェア
 * 
 * すべてのリクエストに適用し、必要に応じて認証チェックを行う
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // パブリックエンドポイントは認証チェックをスキップ
  if (isPublicEndpoint(req.path)) {
    logger.debug('パブリックエンドポイント', { path: req.path });
    return next();
  }

  // プリフライトリクエストは通す
  if (req.method === 'OPTIONS') {
    return next();
  }

  // 非同期処理のラッパー
  (async () => {
    try {
      // リクエストからトークンを抽出（Cookieまたはヘッダー）
      const token = extractToken(req);
      if (!token) {
        throw new AuthError('NO_TOKEN', '認証トークンが提供されていません');
      }

      // JWT検証
      const payload = await verifyJWTToken(token);
      
      // ユーザー存在確認
      await verifyUserExists(payload.sub);

      // リクエストオブジェクトにユーザー情報を設定
      req.user = {
        id: payload.sub,
        githubId: payload.githubId,
        username: payload.username,
      };

      logRequest(req, true, {
        userId: payload.sub,
        username: payload.username,
      });

      next();
    } catch (error) {
      const authError = error instanceof AuthError 
        ? error 
        : new AuthError('AUTHENTICATION_FAILED', '認証に失敗しました');

      const { statusCode, response } = createErrorResponse(authError);
      
      logRequest(req, false, {
        errorCode: authError.code,
        errorMessage: authError.message,
      });

      res.status(statusCode).json(response);
    }
  })();
}

/**
 * 認証必須ミドルウェア（明示的）
 * 
 * 特定のルートで明示的に認証を要求する場合に使用
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // 既に認証済みの場合はスキップ
  if (req.user) {
    return next();
  }

  // 認証ミドルウェアを強制実行
  authMiddleware(req, res, next);
}

/**
 * オプショナル認証ミドルウェア
 * 
 * 認証があれば使用し、なくてもエラーにしない
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  
  if (!token) {
    // トークンがない場合はそのまま進む
    return next();
  }

  // 非同期処理のラッパー
  (async () => {
    try {
      const payload = await verifyJWTToken(token);
      await verifyUserExists(payload.sub);

      req.user = {
        id: payload.sub,
        githubId: payload.githubId,
        username: payload.username,
      };

      logRequest(req, true, {
        userId: payload.sub,
        username: payload.username,
        optional: true,
      });
    } catch (error) {
      // オプショナル認証なのでエラーログのみ
      logger.debug('オプショナル認証失敗', {
        path: req.path,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    next();
  })();
}

/**
 * 管理者権限チェック（将来の拡張用）
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    const { statusCode, response } = createErrorResponse(
      new AuthError('AUTH_REQUIRED', '認証が必要です')
    );
    res.status(statusCode).json(response);
    return;
  }

  // 現在は全ユーザーが管理者として扱う（将来の拡張ポイント）
  logger.debug('管理者権限チェック通過', {
    userId: req.user.id,
    username: req.user.username,
  });

  next();
}

/**
 * 認証情報の取得ヘルパー
 */
export function getAuthenticatedUser(req: Request): { id: string; githubId: string; username: string } | null {
  return req.user || null;
}

/**
 * 認証状態の確認ヘルパー
 */
export function isAuthenticated(req: Request): boolean {
  return getAuthenticatedUser(req) !== null;
}