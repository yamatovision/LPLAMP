/**
 * 認証コントローラー
 * 
 * 認証関連のHTTPリクエストを処理
 * GitHub OAuth認証フローとJWT管理を実装
 */

import { Request, Response } from 'express';
import { 
  ApiResponse, 
  AuthStatusResponse, 
  LoginResponse 
} from '../../types/index.js';
import { getAuthService, AuthServiceError } from './auth.service.js';
import { getAuthenticatedUser } from '../../common/middlewares/auth.middleware.js';
import { logger, PerformanceLogger } from '../../common/utils/logger.js';

/**
 * コントローラーエラー
 */
export class AuthControllerError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AuthControllerError';
  }
}

/**
 * エラーレスポンスの生成
 */
function createErrorResponse(
  error: Error, 
  defaultStatusCode: number = 500
): { statusCode: number; response: ApiResponse<null> } {
  let statusCode = defaultStatusCode;
  let errorMessage = 'サーバーエラーが発生しました';
  let errorCode = 'INTERNAL_SERVER_ERROR';

  if (error instanceof AuthServiceError) {
    statusCode = error.statusCode;
    errorMessage = error.message;
    errorCode = error.code;
  } else if (error instanceof AuthControllerError) {
    statusCode = error.statusCode;
    errorMessage = error.message;
    errorCode = 'CONTROLLER_ERROR';
  }

  return {
    statusCode,
    response: {
      success: false,
      error: errorMessage,
      meta: { code: errorCode },
    },
  };
}

/**
 * 成功レスポンスの生成（dataありバージョン）
 */
function createSuccessResponse<T>(data: T): ApiResponse<T>;
/**
 * 成功レスポンスの生成（dataなしバージョン）
 */
function createSuccessResponse(): ApiResponse<undefined>;
/**
 * 成功レスポンスの生成（実装）
 */
function createSuccessResponse<T>(data?: T): ApiResponse<T> | ApiResponse<undefined> {
  if (data !== undefined) {
    return {
      success: true,
      data: data,
    };
  } else {
    return {
      success: true,
    };
  }
}

/**
 * 認証状態確認
 * GET /api/auth/status
 */
export async function getAuthStatus(req: Request, res: Response): Promise<void> {
  const perfLog = new PerformanceLogger('認証状態確認');
  
  try {
    // 認証済みユーザー情報を取得
    const authenticatedUser = getAuthenticatedUser(req);
    const userId = authenticatedUser?.id;

    // 認証状態を取得
    const authStatus = await getAuthService().getAuthStatus(userId);
    
    perfLog.end({
      authenticated: authStatus.data?.authenticated,
      userId: authStatus.data?.user?.id,
    });

    res.json(authStatus);
  } catch (error) {
    perfLog.error(error as Error);
    
    const { statusCode, response } = createErrorResponse(error as Error);
    res.status(statusCode).json(response);
  }
}

/**
 * GitHub認証開始
 * GET /api/auth/github/login
 */
export async function startGitHubAuth(req: Request, res: Response): Promise<void> {
  const perfLog = new PerformanceLogger('GitHub認証開始');
  
  try {
    // GitHub認証URLを生成
    const loginResponse = getAuthService().generateGitHubAuthUrl();
    
    perfLog.end({
      redirectUrl: loginResponse.redirectUrl,
    });

    // Accept ヘッダーをチェックしてAPIリクエストかブラウザリクエストかを判定
    const acceptHeader = req.headers.accept || '';
    const isJsonRequest = acceptHeader.includes('application/json');
    
    if (isJsonRequest) {
      // APIリクエストの場合はJSONレスポンスを返す
      const response = createSuccessResponse<LoginResponse>(loginResponse);
      res.json(response);
    } else {
      // ブラウザからの直接アクセスの場合はリダイレクト
      res.redirect(loginResponse.redirectUrl);
    }
  } catch (error) {
    perfLog.error(error as Error);
    
    const { statusCode, response } = createErrorResponse(error as Error);
    res.status(statusCode).json(response);
  }
}

/**
 * GitHub認証コールバック処理
 * GET /api/auth/github/callback
 */
export async function handleGitHubCallback(req: Request, res: Response): Promise<void> {
  const perfLog = new PerformanceLogger('GitHub認証コールバック');
  
  try {
    const { code, state, error } = req.query;

    // GitHubからのエラーレスポンスをチェック
    if (error) {
      throw new AuthControllerError(
        `GitHub認証エラー: ${error}`,
        400,
        { githubError: error, description: req.query['error_description'] }
      );
    }

    // 認証コードの存在確認
    if (!code || typeof code !== 'string') {
      throw new AuthControllerError(
        '認証コードが提供されていません',
        400,
        { code, state }
      );
    }

    // OAuth認証処理
    const oauthResult = await getAuthService().processGitHubCallback(code, state as string);
    
    // JWTトークン生成
    const authSession = await getAuthService().createAuthSession(oauthResult.user);
    
    // フロントエンドURL（リダイレクト先）
    const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:3000';
    
    // JWTトークンをHTTP-onlyクッキーに設定
    res.cookie('authToken', authSession.token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7日間
    });
    
    // 認証成功後のリダイレクト
    const redirectUrl = `${frontendUrl}/auth/callback?status=success`;
    
    perfLog.end({
      userId: oauthResult.user.id,
      username: oauthResult.user.username,
      isNewUser: oauthResult.isNewUser,
      redirectUrl,
    });

    // リダイレクト実行
    res.redirect(redirectUrl);
  } catch (error) {
    perfLog.error(error as Error);
    
    logger.error('GitHub認証コールバックエラー', {
      query: req.query,
      error: error instanceof Error ? error.message : String(error),
    });

    // エラー時のリダイレクト
    const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:3000';
    const errorRedirectUrl = `${frontendUrl}/login?error=auth_failed`;
    
    res.redirect(errorRedirectUrl);
  }
}

/**
 * ログアウト処理
 * POST /api/auth/logout
 */
export async function logout(req: Request, res: Response): Promise<void> {
  const perfLog = new PerformanceLogger('ログアウト');
  
  try {
    const authenticatedUser = getAuthenticatedUser(req);
    
    if (!authenticatedUser) {
      throw new AuthControllerError(
        '認証が必要です',
        401
      );
    }

    // ログアウト処理
    await getAuthService().logout(authenticatedUser.id);
    
    perfLog.end({
      userId: authenticatedUser.id,
      username: authenticatedUser.username,
    });

    const response = createSuccessResponse<{ message: string }>({
      message: 'ログアウトしました',
    });
    
    res.json(response);
  } catch (error) {
    perfLog.error(error as Error);
    
    const { statusCode, response } = createErrorResponse(error as Error);
    res.status(statusCode).json(response);
  }
}

/**
 * 現在のユーザー情報取得
 * GET /api/auth/me
 */
export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  const perfLog = new PerformanceLogger('現在のユーザー情報取得');
  
  try {
    const authenticatedUser = getAuthenticatedUser(req);
    
    if (!authenticatedUser) {
      throw new AuthControllerError(
        '認証が必要です',
        401
      );
    }

    // 最新のユーザー情報を取得
    const authStatus = await getAuthService().getAuthStatus(authenticatedUser.id);
    
    if (!authStatus.authenticated || !authStatus.user) {
      throw new AuthControllerError(
        'ユーザー情報が見つかりません',
        404
      );
    }

    perfLog.end({
      userId: authStatus.user.id,
      username: authStatus.user.username,
    });

    const response = createSuccessResponse(authStatus.user);
    res.json(response);
  } catch (error) {
    perfLog.error(error as Error);
    
    const { statusCode, response } = createErrorResponse(error as Error);
    res.status(statusCode).json(response);
  }
}

/**
 * 認証情報の更新（将来の拡張用）
 * PUT /api/auth/profile
 */
export async function updateProfile(_req: Request, res: Response): Promise<void> {
  const perfLog = new PerformanceLogger('プロフィール更新');
  
  try {
    // 現在は実装しない（将来の拡張用）
    throw new AuthControllerError(
      'この機能は現在利用できません',
      501
    );
  } catch (error) {
    perfLog.error(error as Error);
    
    const { statusCode, response } = createErrorResponse(error as Error);
    res.status(statusCode).json(response);
  }
}

/**
 * トークンリフレッシュ（将来の拡張用）
 * POST /api/auth/refresh
 */
export async function refreshToken(_req: Request, res: Response): Promise<void> {
  const perfLog = new PerformanceLogger('トークンリフレッシュ');
  
  try {
    // 現在は実装しない（将来の拡張用）
    throw new AuthControllerError(
      'この機能は現在利用できません',
      501
    );
  } catch (error) {
    perfLog.error(error as Error);
    
    const { statusCode, response } = createErrorResponse(error as Error);
    res.status(statusCode).json(response);
  }
}

/**
 * セッション検証（デバッグ用）
 * GET /api/auth/validate
 */
export async function validateSession(req: Request, res: Response): Promise<void> {
  const perfLog = new PerformanceLogger('セッション検証');
  
  try {
    const authenticatedUser = getAuthenticatedUser(req);
    
    if (!authenticatedUser) {
      throw new AuthControllerError(
        '認証が必要です',
        401
      );
    }

    // セッション情報の詳細を返す
    const sessionInfo = {
      valid: true,
      user: {
        id: authenticatedUser.id,
        githubId: authenticatedUser.githubId,
        username: authenticatedUser.username,
      },
      timestamp: new Date().toISOString(),
    };

    perfLog.end({
      userId: authenticatedUser.id,
      username: authenticatedUser.username,
    });

    const response = createSuccessResponse(sessionInfo);
    res.json(response);
  } catch (error) {
    perfLog.error(error as Error);
    
    const { statusCode, response } = createErrorResponse(error as Error);
    res.status(statusCode).json(response);
  }
}