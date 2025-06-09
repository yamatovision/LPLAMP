/**
 * デプロイメントのコントローラー層
 * HTTPリクエスト/レスポンス処理とサービス層の呼び出し
 */

import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { DeploymentService } from './deploy.service';
import { logger } from '../../common/utils/logger';
import type { 
  ApiResponse, 
  DeployRequest, 
  DeployResponse, 
  DeploymentDetail 
} from '../../types/index';

/**
 * デプロイメントを開始
 * POST /api/deploy/trigger
 */
export const triggerDeployment = async (req: Request, res: Response<ApiResponse<DeployResponse>>) => {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  try {
    const userId = req.user?.id;
    if (!userId) {
      logger.warn('デプロイメント開始: 未認証リクエスト', {
        component: 'DeployController',
        operation: 'triggerDeployment',
        requestId,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        error: '認証が必要です'
      });
    }

    // バリデーション結果の確認
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('デプロイメント開始: バリデーションエラー', {
        component: 'DeployController',
        operation: 'triggerDeployment',
        requestId,
        userId,
        validationErrors: errors.array()
      });

      return res.status(400).json({
        success: false,
        error: 'リクエストデータが不正です',
        meta: {
          requestId,
          code: 'VALIDATION_ERROR',
          details: errors.array()
        }
      });
    }

    const deployRequest: DeployRequest = req.body;
    const { projectId } = req.body; // プロジェクトIDをリクエストボディから取得

    if (!projectId) {
      logger.warn('デプロイメント開始: プロジェクトIDが不正', {
        component: 'DeployController',
        operation: 'triggerDeployment',
        requestId,
        userId
      });

      return res.status(400).json({
        success: false,
        error: 'プロジェクトIDが必要です',
        meta: {
          requestId,
          code: 'MISSING_PROJECT_ID'
        }
      });
    }

    logger.info('デプロイメント開始', {
      component: 'DeployController',
      operation: 'triggerDeployment',
      requestId,
      userId,
      projectId,
      provider: deployRequest.provider,
      repo: deployRequest.repo,
      ip: req.ip
    });

    const deployResponse = await DeploymentService.triggerDeployment(userId, projectId, deployRequest);

    const duration = Date.now() - startTime;
    logger.info('デプロイメント開始完了', {
      component: 'DeployController',
      operation: 'triggerDeployment',
      requestId,
      userId,
      projectId,
      deploymentId: deployResponse.deploymentId,
      provider: deployRequest.provider,
      duration: `${duration}ms`
    });

    return res.status(201).json({
      success: true,
      data: deployResponse,
      meta: {
        requestId,
        message: 'デプロイメントが正常に開始されました'
      }
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('デプロイメント開始エラー', {
      component: 'DeployController',
      operation: 'triggerDeployment',
      requestId,
      userId: req.user?.id,
      projectId: req.body?.projectId,
      provider: req.body?.provider,
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });

    let statusCode = 500;
    let errorCode = 'DEPLOY_TRIGGER_ERROR';

    if (error.message.includes('プロバイダー') || error.message.includes('制約')) {
      statusCode = 400;
      errorCode = 'PROVIDER_CONSTRAINT_ERROR';
    } else if (error.message.includes('安全でない')) {
      statusCode = 400;
      errorCode = 'UNSAFE_URL_ERROR';
    }

    return res.status(statusCode).json({
      success: false,
      error: error.message,
      meta: {
        requestId,
        code: errorCode
      }
    });
  }
};

/**
 * デプロイメントステータス確認
 * GET /api/deploy/:deploymentId/status
 */
export const getDeploymentStatus = async (req: Request, res: Response<ApiResponse<DeploymentDetail>>) => {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  try {
    const userId = req.user?.id;
    if (!userId) {
      logger.warn('デプロイメントステータス確認: 未認証リクエスト', {
        component: 'DeployController',
        operation: 'getDeploymentStatus',
        requestId,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        error: '認証が必要です'
      });
    }

    // バリデーション結果の確認
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('デプロイメントステータス確認: バリデーションエラー', {
        component: 'DeployController',
        operation: 'getDeploymentStatus',
        requestId,
        userId,
        validationErrors: errors.array()
      });

      return res.status(400).json({
        success: false,
        error: 'リクエストデータが不正です',
        meta: {
          requestId,
          code: 'VALIDATION_ERROR',
          details: errors.array()
        }
      });
    }

    const { deploymentId } = req.params;

    if (!deploymentId) {
      return res.status(400).json({
        success: false,
        error: 'デプロイメントIDが必要です',
        meta: {
          requestId,
          code: 'MISSING_DEPLOYMENT_ID'
        }
      });
    }

    logger.info('デプロイメントステータス確認開始', {
      component: 'DeployController',
      operation: 'getDeploymentStatus',
      requestId,
      userId,
      deploymentId,
      ip: req.ip
    });

    const deploymentDetail = await DeploymentService.getDeploymentStatus(deploymentId, userId);

    if (!deploymentDetail) {
      logger.warn('デプロイメントが見つかりません', {
        component: 'DeployController',
        operation: 'getDeploymentStatus',
        requestId,
        userId,
        deploymentId
      });

      return res.status(404).json({
        success: false,
        error: 'デプロイメントが見つかりません',
        meta: {
          requestId,
          code: 'DEPLOYMENT_NOT_FOUND'
        }
      });
    }

    const duration = Date.now() - startTime;
    logger.info('デプロイメントステータス確認完了', {
      component: 'DeployController',
      operation: 'getDeploymentStatus',
      requestId,
      userId,
      deploymentId,
      status: deploymentDetail.status,
      duration: `${duration}ms`
    });

    return res.json({
      success: true,
      data: deploymentDetail,
      meta: {
        requestId
      }
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('デプロイメントステータス確認エラー', {
      component: 'DeployController',
      operation: 'getDeploymentStatus',
      requestId,
      userId: req.user?.id,
      deploymentId: req.params?.['deploymentId'],
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });

    return res.status(500).json({
      success: false,
      error: 'デプロイメントステータスの取得に失敗しました',
      meta: {
        requestId,
        code: 'DEPLOY_STATUS_ERROR'
      }
    });
  }
};

/**
 * デプロイメントログ取得
 * GET /api/deploy/:deploymentId/logs
 */
export const getDeploymentLogs = async (req: Request, res: Response<ApiResponse<{ logs: string[] }>>) => {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  try {
    const userId = req.user?.id;
    if (!userId) {
      logger.warn('デプロイメントログ取得: 未認証リクエスト', {
        component: 'DeployController',
        operation: 'getDeploymentLogs',
        requestId,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        error: '認証が必要です'
      });
    }

    // バリデーション結果の確認
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('デプロイメントログ取得: バリデーションエラー', {
        component: 'DeployController',
        operation: 'getDeploymentLogs',
        requestId,
        userId,
        validationErrors: errors.array()
      });

      return res.status(400).json({
        success: false,
        error: 'リクエストデータが不正です',
        meta: {
          requestId,
          code: 'VALIDATION_ERROR',
          details: errors.array()
        }
      });
    }

    const { deploymentId } = req.params;

    if (!deploymentId) {
      return res.status(400).json({
        success: false,
        error: 'デプロイメントIDが必要です',
        meta: {
          requestId,
          code: 'MISSING_DEPLOYMENT_ID'
        }
      });
    }

    logger.info('デプロイメントログ取得開始', {
      component: 'DeployController',
      operation: 'getDeploymentLogs',
      requestId,
      userId,
      deploymentId,
      ip: req.ip
    });

    const logs = await DeploymentService.getDeploymentLogs(deploymentId, userId);

    const duration = Date.now() - startTime;
    logger.info('デプロイメントログ取得完了', {
      component: 'DeployController',
      operation: 'getDeploymentLogs',
      requestId,
      userId,
      deploymentId,
      logCount: logs.length,
      duration: `${duration}ms`
    });

    return res.json({
      success: true,
      data: { logs },
      meta: {
        requestId,
        count: logs.length
      }
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('デプロイメントログ取得エラー', {
      component: 'DeployController',
      operation: 'getDeploymentLogs',
      requestId,
      userId: req.user?.id,
      deploymentId: req.params?.['deploymentId'],
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });

    let statusCode = 500;
    let errorCode = 'DEPLOY_LOGS_ERROR';

    if (error.message.includes('見つからない') || error.message.includes('アクセス権限がありません')) {
      statusCode = 404;
      errorCode = 'DEPLOYMENT_NOT_FOUND';
    }

    return res.status(statusCode).json({
      success: false,
      error: error.message,
      meta: {
        requestId,
        code: errorCode
      }
    });
  }
};

/**
 * プロジェクトのデプロイメント一覧取得
 * GET /api/projects/:projectId/deployments
 */
export const getProjectDeployments = async (req: Request, res: Response<ApiResponse<{
  deployments: DeploymentDetail[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}>>) => {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  try {
    const userId = req.user?.id;
    if (!userId) {
      logger.warn('プロジェクトデプロイメント一覧取得: 未認証リクエスト', {
        component: 'DeployController',
        operation: 'getProjectDeployments',
        requestId,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        error: '認証が必要です'
      });
    }

    // バリデーション結果の確認
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('プロジェクトデプロイメント一覧取得: バリデーションエラー', {
        component: 'DeployController',
        operation: 'getProjectDeployments',
        requestId,
        userId,
        validationErrors: errors.array()
      });

      return res.status(400).json({
        success: false,
        error: 'リクエストデータが不正です',
        meta: {
          requestId,
          code: 'VALIDATION_ERROR',
          details: errors.array()
        }
      });
    }

    const { projectId } = req.params;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'プロジェクトIDが必要です',
        meta: {
          requestId,
          code: 'MISSING_PROJECT_ID'
        }
      });
    }

    const page = parseInt((req.query['page'] as string) || '1') || 1;
    const limit = parseInt((req.query['limit'] as string) || '10') || 10;

    logger.info('プロジェクトデプロイメント一覧取得開始', {
      component: 'DeployController',
      operation: 'getProjectDeployments',
      requestId,
      userId,
      projectId,
      page,
      limit,
      ip: req.ip
    });

    const result = await DeploymentService.getProjectDeployments(projectId, userId, page, limit);

    const duration = Date.now() - startTime;
    logger.info('プロジェクトデプロイメント一覧取得完了', {
      component: 'DeployController',
      operation: 'getProjectDeployments',
      requestId,
      userId,
      projectId,
      totalCount: result.total,
      returnedCount: result.deployments.length,
      duration: `${duration}ms`
    });

    return res.json({
      success: true,
      data: {
        deployments: result.deployments,
        total: result.total,
        page,
        limit,
        hasMore: result.hasMore
      },
      meta: {
        requestId
      }
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('プロジェクトデプロイメント一覧取得エラー', {
      component: 'DeployController',
      operation: 'getProjectDeployments',
      requestId,
      userId: req.user?.id,
      projectId: req.params?.['projectId'],
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });

    return res.status(500).json({
      success: false,
      error: 'プロジェクトのデプロイメント一覧取得に失敗しました',
      meta: {
        requestId,
        code: 'PROJECT_DEPLOYMENTS_ERROR'
      }
    });
  }
};

/**
 * デプロイメント統計情報取得（管理者用）
 * GET /api/deploy/stats
 */
export const getDeploymentStats = async (req: Request, res: Response<ApiResponse<any>>) => {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  try {
    const userId = req.user?.id;
    if (!userId) {
      logger.warn('デプロイメント統計取得: 未認証リクエスト', {
        component: 'DeployController',
        operation: 'getDeploymentStats',
        requestId,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        error: '認証が必要です'
      });
    }

    logger.info('デプロイメント統計取得開始', {
      component: 'DeployController',
      operation: 'getDeploymentStats',
      requestId,
      userId,
      ip: req.ip
    });

    const stats = await DeploymentService.getDeploymentStats();

    const duration = Date.now() - startTime;
    logger.info('デプロイメント統計取得完了', {
      component: 'DeployController',
      operation: 'getDeploymentStats',
      requestId,
      userId,
      totalDeployments: stats.total,
      duration: `${duration}ms`
    });

    return res.json({
      success: true,
      data: stats,
      meta: {
        requestId,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('デプロイメント統計取得エラー', {
      component: 'DeployController',
      operation: 'getDeploymentStats',
      requestId,
      userId: req.user?.id,
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });

    return res.status(500).json({
      success: false,
      error: 'デプロイメント統計の取得に失敗しました',
      meta: {
        requestId,
        code: 'DEPLOY_STATS_ERROR'
      }
    });
  }
};