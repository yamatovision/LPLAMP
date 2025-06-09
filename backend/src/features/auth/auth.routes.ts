/**
 * 認証関連ルート定義
 * 
 * GitHub OAuth認証とJWT管理のエンドポイントを定義
 * ミドルウェアとコントローラーを組み合わせてルートを構成
 */

import { Router } from 'express';
import { 
  getAuthStatus,
  startGitHubAuth,
  handleGitHubCallback,
  logout,
  getCurrentUser,
  updateProfile,
  refreshToken,
  validateSession
} from './auth.controller.js';
import { 
  requireAuth, 
  optionalAuth 
} from '../../common/middlewares/auth.middleware.js';
import { API_PATHS } from '../../types/index.js';
import { logger } from '../../common/utils/logger.js';

/**
 * 認証ルーターの作成
 */
export function createAuthRoutes(): Router {
  const router = Router();

  // ログ用のルーター情報
  logger.info('認証ルート初期化開始');

  /**
   * 認証状態確認
   * GET /api/auth/status
   * 
   * 認証不要。現在の認証状態を返す
   * 認証済みの場合はユーザー情報も含む
   */
  router.get('/status', optionalAuth, getAuthStatus);

  /**
   * GitHub認証開始
   * GET /api/auth/github/login
   * 
   * 認証不要。GitHub OAuthの認証URLを生成して返す
   * フロントエンドがこのURLにリダイレクトしてOAuth開始
   */
  router.get('/github/login', startGitHubAuth);

  /**
   * GitHub認証コールバック
   * GET /api/auth/github/callback
   * 
   * 認証不要。GitHubからのOAuthコールバックを処理
   * 認証成功時はJWTトークンと共にフロントエンドにリダイレクト
   */
  router.get('/github/callback', handleGitHubCallback);

  /**
   * ログアウト
   * POST /api/auth/logout
   * 
   * 認証必須。現在のセッションを無効化
   */
  router.post('/logout', requireAuth, logout);

  /**
   * 現在のユーザー情報取得
   * GET /api/auth/me
   * 
   * 認証必須。認証済みユーザーの詳細情報を返す
   */
  router.get('/me', requireAuth, getCurrentUser);

  /**
   * セッション検証（デバッグ用）
   * GET /api/auth/validate
   * 
   * 認証必須。現在のセッション情報を詳細に返す
   * 開発・デバッグ時の認証状態確認に使用
   */
  router.get('/validate', requireAuth, validateSession);

  /**
   * プロフィール更新（将来の拡張用）
   * PUT /api/auth/profile
   * 
   * 認証必須。ユーザープロフィール情報の更新
   * 現在は未実装（501 Not Implemented）
   */
  router.put('/profile', requireAuth, updateProfile);

  /**
   * トークンリフレッシュ（将来の拡張用）
   * POST /api/auth/refresh
   * 
   * 認証不要。リフレッシュトークンを使用してアクセストークンを更新
   * 現在は未実装（501 Not Implemented）
   */
  router.post('/refresh', refreshToken);

  // ルート登録完了ログ
  const registeredRoutes = [
    'GET /status',
    'GET /github/login',
    'GET /github/callback',
    'POST /logout',
    'GET /me',
    'GET /validate',
    'PUT /profile (未実装)',
    'POST /refresh (未実装)',
  ];

  logger.info('認証ルート初期化完了', {
    routeCount: registeredRoutes.length,
    routes: registeredRoutes,
  });

  return router;
}

/**
 * 認証ルートの検証
 * 
 * API_PATHSで定義されたパスとルート定義の整合性をチェック
 */
export function validateAuthRoutes(): boolean {
  const definedPaths = [
    API_PATHS.AUTH.STATUS,
    API_PATHS.AUTH.GITHUB_LOGIN,
    API_PATHS.AUTH.GITHUB_CALLBACK,
    API_PATHS.AUTH.LOGOUT,
    API_PATHS.AUTH.ME,
  ];

  const implementedPaths = [
    '/api/auth/status',
    '/api/auth/github/login',
    '/api/auth/github/callback',
    '/api/auth/logout',
    '/api/auth/me',
  ];

  const missingPaths = definedPaths.filter(
    path => !implementedPaths.includes(path)
  );

  if (missingPaths.length > 0) {
    logger.error('認証ルート定義に不整合があります', {
      missingPaths,
      definedPaths,
      implementedPaths,
    });
    return false;
  }

  logger.info('認証ルート定義の検証完了', {
    pathCount: definedPaths.length,
  });

  return true;
}

/**
 * ルートヘルスチェック用のメタデータ
 */
export const authRouteMetadata = {
  name: 'Authentication Routes',
  version: '1.0.0',
  endpoints: {
    status: {
      method: 'GET',
      path: '/api/auth/status',
      auth: false,
      description: '認証状態確認',
    },
    githubLogin: {
      method: 'GET',
      path: '/api/auth/github/login',
      auth: false,
      description: 'GitHub認証開始',
    },
    githubCallback: {
      method: 'GET',
      path: '/api/auth/github/callback',
      auth: false,
      description: 'GitHub認証コールバック',
    },
    logout: {
      method: 'POST',
      path: '/api/auth/logout',
      auth: true,
      description: 'ログアウト',
    },
    me: {
      method: 'GET',
      path: '/api/auth/me',
      auth: true,
      description: '現在のユーザー情報取得',
    },
    validate: {
      method: 'GET',
      path: '/api/auth/validate',
      auth: true,
      description: 'セッション検証',
    },
  },
  dependencies: [
    'auth.controller',
    'auth.middleware',
    'auth.service',
  ],
};

/**
 * デバッグ用：登録されたルートの一覧出力
 */
export function logAuthRoutes(): void {
  const routes = Object.entries(authRouteMetadata.endpoints).map(
    ([key, endpoint]) => ({
      key,
      method: endpoint.method,
      path: endpoint.path,
      auth: endpoint.auth ? '🔒' : '🌐',
      description: endpoint.description,
    })
  );

  logger.debug('認証ルート一覧', { routes });
}