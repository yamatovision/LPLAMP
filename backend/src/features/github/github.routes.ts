/**
 * GitHub連携のルート定義
 * エンドポイント設定とミドルウェア統合
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as githubController from './github.controller';
import { 
  validateCreateRepository, 
  validatePushFiles,
  validateRateLimit
} from './github.validator';
import { authMiddleware } from '../../common/middlewares/auth.middleware';
import { logger } from '../../common/utils/logger';

/**
 * GitHub関連のルートを作成
 */
export const createGitHubRoutes = (): Router => {
  const router = Router();

  // 全エンドポイントで認証が必要
  router.use(authMiddleware);

  // ログ用ミドルウェア
  router.use((req, _res, next) => {
    logger.info('GitHub API リクエスト', {
      component: 'GitHubRoutes',
      method: req.method,
      path: req.path,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    next();
  });

  // レート制限の設定
  const createRepoLimiter = rateLimit(validateRateLimit.createRepository);
  const pushFilesLimiter = rateLimit(validateRateLimit.pushFiles);
  const listReposLimiter = rateLimit(validateRateLimit.listRepositories);

  /**
   * GitHub認証状態確認
   * GET /api/github/auth/status
   */
  router.get('/auth/status', githubController.getAuthStatus);

  /**
   * GitHub認証トークン設定（開発・テスト用）
   * POST /api/github/auth/token
   * 
   * 本番環境では OAuth フローを使用し、このエンドポイントは無効化することを推奨
   */
  router.post('/auth/token', githubController.setAuthToken);

  /**
   * GitHub認証解除
   * DELETE /api/github/auth
   */
  router.delete('/auth', githubController.removeAuth);

  /**
   * リポジトリ一覧取得
   * GET /api/github/repos
   */
  router.get('/repos', 
    listReposLimiter,
    githubController.getRepositories
  );

  /**
   * 新規リポジトリ作成
   * POST /api/github/repos/create
   */
  router.post('/repos/create',
    createRepoLimiter,
    validateCreateRepository,
    githubController.createRepository
  );

  /**
   * ファイルをGitHubにプッシュ
   * POST /api/github/push
   */
  router.post('/push',
    pushFilesLimiter,
    validatePushFiles,
    githubController.pushFiles
  );

  // エラーハンドリングミドルウェア
  router.use((error: any, req: any, res: any, _next: any) => {
    logger.error('GitHub ルートエラー', {
      component: 'GitHubRoutes',
      method: req.method,
      path: req.path,
      userId: req.user?.id,
      error: error.message,
      stack: error.stack
    });

    // レート制限エラーの処理
    if (error.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'リクエスト制限に達しました。しばらく待ってから再試行してください。',
        meta: {
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: error.retryAfter
        }
      });
    }

    // その他のエラー
    res.status(500).json({
      success: false,
      error: 'GitHub関連の処理でエラーが発生しました',
      meta: {
        code: 'GITHUB_ROUTE_ERROR'
      }
    });
  });

  return router;
};

/**
 * 開発環境用のテストルート
 * 本番環境では無効化することを推奨
 */
export const createGitHubTestRoutes = (): Router => {
  const router = Router();

  if (process.env['NODE_ENV'] !== 'production') {
    router.use(authMiddleware);

    /**
     * GitHub API接続テスト
     * GET /api/github/test/connection
     */
    router.get('/test/connection', async (req, res) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: '認証が必要です'
          });
        }

        // 簡単な接続テスト（認証状態確認のみ）
        await githubController.getAuthStatus(req as any, res as any);
        
        return res.json({
          success: true,
          data: {
            message: 'GitHub API接続テスト成功',
            timestamp: new Date().toISOString()
          }
        });
      } catch (error: any) {
        logger.error('GitHub 接続テストエラー', {
          component: 'GitHubTestRoutes',
          userId: req.user?.id,
          error: error.message
        });

        return res.status(500).json({
          success: false,
          error: 'GitHub API接続テストに失敗しました',
          meta: {
            code: 'GITHUB_CONNECTION_TEST_ERROR'
          }
        });
      }
    });

    /**
     * レート制限状況確認
     * GET /api/github/test/rate-limit
     */
    router.get('/test/rate-limit', (_req, res) => {
      res.json({
        success: true,
        data: {
          rateLimits: {
            createRepository: validateRateLimit.createRepository,
            pushFiles: validateRateLimit.pushFiles,
            listRepositories: validateRateLimit.listRepositories
          },
          message: 'レート制限設定情報',
          timestamp: new Date().toISOString()
        }
      });
    });

    logger.info('GitHub テストルートが有効化されました', {
      component: 'GitHubTestRoutes',
      environment: process.env['NODE_ENV']
    });
  }

  return router;
};

export default createGitHubRoutes;