/**
 * デプロイメントのルート定義
 * エンドポイント設定とミドルウェア統合
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as deployController from './deploy.controller';
import { 
  validateTriggerDeploy, 
  validateDeploymentId, 
  validateProjectId,
  validatePagination,
  validateRateLimit
} from './deploy.validator';
import { authMiddleware } from '../../common/middlewares/auth.middleware';
import { logger } from '../../common/utils/logger';

/**
 * デプロイメント関連のルートを作成
 */
export const createDeployRoutes = (): Router => {
  const router = Router();

  // 全エンドポイントで認証が必要
  router.use(authMiddleware);

  // ログ用ミドルウェア
  router.use((req, _res, next) => {
    logger.info('Deploy API リクエスト', {
      component: 'DeployRoutes',
      method: req.method,
      path: req.path,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    next();
  });

  // レート制限の設定
  const triggerDeployLimiter = rateLimit(validateRateLimit.triggerDeploy);
  const checkStatusLimiter = rateLimit(validateRateLimit.checkStatus);
  const getLogsLimiter = rateLimit(validateRateLimit.getLogs);
  const listDeploymentsLimiter = rateLimit(validateRateLimit.listDeployments);

  /**
   * デプロイメント開始
   * POST /api/deploy/trigger
   * 
   * リクエストボディ:
   * {
   *   projectId: string,
   *   repo: string,
   *   provider: 'github-pages' | 'vercel' | 'netlify',
   *   customDomain?: string
   * }
   */
  router.post('/trigger',
    triggerDeployLimiter,
    validateTriggerDeploy,
    deployController.triggerDeployment
  );

  /**
   * デプロイメントステータス確認
   * GET /api/deploy/:deploymentId/status
   */
  router.get('/:deploymentId/status',
    checkStatusLimiter,
    validateDeploymentId,
    deployController.getDeploymentStatus
  );

  /**
   * デプロイメントログ取得
   * GET /api/deploy/:deploymentId/logs
   */
  router.get('/:deploymentId/logs',
    getLogsLimiter,
    validateDeploymentId,
    deployController.getDeploymentLogs
  );

  /**
   * デプロイメント統計情報取得
   * GET /api/deploy/stats
   */
  router.get('/stats',
    listDeploymentsLimiter,
    deployController.getDeploymentStats
  );

  // エラーハンドリングミドルウェア
  router.use((error: any, req: any, res: any, _next: any) => {
    logger.error('Deploy ルートエラー', {
      component: 'DeployRoutes',
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
    return res.status(500).json({
      success: false,
      error: 'デプロイメント関連の処理でエラーが発生しました',
      meta: {
        code: 'DEPLOY_ROUTE_ERROR'
      }
    });
  });

  return router;
};

/**
 * プロジェクト関連デプロイメントルートを作成
 * プロジェクトルートと統合される想定
 */
export const createProjectDeployRoutes = (): Router => {
  const router = Router();

  // 認証ミドルウェア
  router.use(authMiddleware);

  // レート制限
  const listDeploymentsLimiter = rateLimit(validateRateLimit.listDeployments);

  /**
   * プロジェクトのデプロイメント一覧取得
   * GET /api/projects/:projectId/deployments
   */
  router.get('/:projectId/deployments',
    listDeploymentsLimiter,
    validateProjectId,
    validatePagination,
    deployController.getProjectDeployments
  );

  return router;
};

/**
 * 開発環境用のテストルート
 * 本番環境では無効化することを推奨
 */
export const createDeployTestRoutes = (): Router => {
  const router = Router();

  if (process.env['NODE_ENV'] !== 'production') {
    router.use(authMiddleware);

    /**
     * デプロイメント機能テスト
     * GET /api/deploy/test/capabilities
     */
    router.get('/test/capabilities', (req, res) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: '認証が必要です'
          });
        }

        return res.json({
          success: true,
          data: {
            supportedProviders: ['github-pages', 'vercel', 'netlify'],
            features: {
              customDomains: true,
              environmentVariables: true,
              buildLogs: true,
              realTimeStatus: true
            },
            rateLimits: {
              triggerDeploy: '10 requests per hour',
              checkStatus: '30 requests per minute',
              getLogs: '20 requests per minute'
            },
            message: 'デプロイメント機能テスト成功',
            timestamp: new Date().toISOString()
          }
        });
      } catch (error: any) {
        logger.error('Deploy 機能テストエラー', {
          component: 'DeployTestRoutes',
          userId: req.user?.id,
          error: error.message
        });

        return res.status(500).json({
          success: false,
          error: 'デプロイメント機能テストに失敗しました',
          meta: {
            code: 'DEPLOY_CAPABILITY_TEST_ERROR'
          }
        });
      }
    });

    /**
     * プロバイダー設定情報取得
     * GET /api/deploy/test/providers
     */
    router.get('/test/providers', (req, res) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: '認証が必要です'
          });
        }

        return res.json({
          success: true,
          data: {
            providers: {
              'github-pages': {
                name: 'GitHub Pages',
                features: ['customDomains', 'buildLogs'],
                limitations: ['Static sites only', 'No server-side processing']
              },
              'vercel': {
                name: 'Vercel',
                features: ['customDomains', 'environmentVariables', 'buildLogs', 'rollback'],
                limitations: ['Fair use policy', 'Function timeout limits']
              },
              'netlify': {
                name: 'Netlify',
                features: ['customDomains', 'environmentVariables', 'buildLogs', 'rollback'],
                limitations: ['Build minute limits', 'Bandwidth limits']
              }
            },
            message: 'プロバイダー情報取得成功',
            timestamp: new Date().toISOString()
          }
        });
      } catch (error: any) {
        logger.error('Deploy プロバイダーテストエラー', {
          component: 'DeployTestRoutes',
          userId: req.user?.id,
          error: error.message
        });

        return res.status(500).json({
          success: false,
          error: 'プロバイダー情報の取得に失敗しました',
          meta: {
            code: 'DEPLOY_PROVIDER_TEST_ERROR'
          }
        });
      }
    });

    /**
     * デプロイメントシミュレーション
     * POST /api/deploy/test/simulate
     */
    router.post('/test/simulate', validateTriggerDeploy, (req: any, res: any) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: '認証が必要です'
          });
        }

        const { provider, repo, customDomain } = req.body;
        
        // シミュレーション結果を生成
        const simulationResult = {
          wouldSucceed: Math.random() > 0.1, // 90%の成功率
          estimatedDuration: `${Math.floor(Math.random() * 5) + 1} minutes`,
          estimatedUrl: customDomain ? 
            `https://${customDomain}` : 
            `https://${repo.split('/')[1]}-${Math.random().toString(36).substring(7)}.${provider === 'vercel' ? 'vercel.app' : provider === 'netlify' ? 'netlify.app' : 'github.io'}`,
          warnings: [] as string[],
          requirements: [] as string[]
        };

        // プロバイダー固有の警告や要件を追加
        if (provider === 'github-pages' && !repo.includes('.github.io')) {
          simulationResult.requirements.push('Repository must be public for GitHub Pages');
        }

        if (customDomain && !customDomain.includes('.')) {
          simulationResult.warnings.push('Custom domain should be a valid domain name');
        }

        return res.json({
          success: true,
          data: {
            simulation: simulationResult,
            provider,
            repo,
            customDomain,
            message: 'デプロイメントシミュレーション完了',
            timestamp: new Date().toISOString()
          }
        });
      } catch (error: any) {
        logger.error('Deploy シミュレーションエラー', {
          component: 'DeployTestRoutes',
          userId: req.user?.id,
          error: error.message
        });

        return res.status(500).json({
          success: false,
          error: 'デプロイメントシミュレーションに失敗しました',
          meta: {
            code: 'DEPLOY_SIMULATION_ERROR'
          }
        });
      }
    });

    logger.info('Deploy テストルートが有効化されました', {
      component: 'DeployTestRoutes',
      environment: process.env['NODE_ENV']
    });
  }

  return router;
};

export default createDeployRoutes;