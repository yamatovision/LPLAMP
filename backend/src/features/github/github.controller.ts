/**
 * GitHub連携のコントローラー層
 * HTTPリクエスト/レスポンス処理とサービス層の呼び出し
 */

import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { GitHubService } from './github.service';
import { logger } from '../../common/utils/logger';
import type { 
  ApiResponse, 
  GitHubRepository, 
  GitHubAuthStatus, 
  GitHubPushRequest, 
  GitHubPushResponse 
} from '../../types/index';

/**
 * GitHub認証状態確認
 * GET /api/github/auth/status
 */
export const getAuthStatus = async (req: Request, res: Response<ApiResponse<GitHubAuthStatus>>) => {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  try {
    const userId = req.user?.id;
    if (!userId) {
      logger.warn('GitHub 認証状態確認: 未認証リクエスト', {
        component: 'GitHubController',
        operation: 'getAuthStatus',
        requestId,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        error: '認証が必要です'
      });
    }

    logger.info('GitHub 認証状態確認開始', {
      component: 'GitHubController',
      operation: 'getAuthStatus',
      requestId,
      userId,
      ip: req.ip
    });

    const authStatus = GitHubService.getAuthStatus(userId);

    const duration = Date.now() - startTime;
    logger.info('GitHub 認証状態確認完了', {
      component: 'GitHubController',
      operation: 'getAuthStatus',
      requestId,
      userId,
      authenticated: authStatus.authenticated,
      duration: `${duration}ms`
    });

    return res.json({
      success: true,
      data: authStatus
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('GitHub 認証状態確認エラー', {
      component: 'GitHubController',
      operation: 'getAuthStatus',
      requestId,
      userId: req.user?.id,
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });

    return res.status(500).json({
      success: false,
      error: '認証状態の確認に失敗しました',
      meta: {
        requestId,
        code: 'GITHUB_AUTH_STATUS_ERROR'
      }
    });
  }
};

/**
 * リポジトリ一覧取得
 * GET /api/github/repos
 */
export const getRepositories = async (req: Request, res: Response<ApiResponse<{ repos: GitHubRepository[] }>>) => {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  try {
    const userId = req.user?.id;
    if (!userId) {
      logger.warn('GitHub リポジトリ一覧取得: 未認証リクエスト', {
        component: 'GitHubController',
        operation: 'getRepositories',
        requestId,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        error: '認証が必要です'
      });
    }

    logger.info('GitHub リポジトリ一覧取得開始', {
      component: 'GitHubController',
      operation: 'getRepositories',
      requestId,
      userId,
      ip: req.ip
    });

    const repositories = await GitHubService.getRepositories(userId);

    const duration = Date.now() - startTime;
    logger.info('GitHub リポジトリ一覧取得完了', {
      component: 'GitHubController',
      operation: 'getRepositories',
      requestId,
      userId,
      repositoryCount: repositories.length,
      duration: `${duration}ms`
    });

    return res.json({
      success: true,
      data: { repos: repositories },
      meta: {
        count: repositories.length,
        requestId
      }
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('GitHub リポジトリ一覧取得エラー', {
      component: 'GitHubController',
      operation: 'getRepositories',
      requestId,
      userId: req.user?.id,
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });

    const statusCode = error.message.includes('GitHub認証が必要') ? 401 : 500;
    const errorCode = error.message.includes('GitHub認証が必要') ? 'GITHUB_AUTH_REQUIRED' : 'GITHUB_REPOS_FETCH_ERROR';

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
 * 新規リポジトリ作成
 * POST /api/github/repos/create
 */
export const createRepository = async (req: Request, res: Response<ApiResponse<GitHubRepository>>) => {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  try {
    const userId = req.user?.id;
    if (!userId) {
      logger.warn('GitHub リポジトリ作成: 未認証リクエスト', {
        component: 'GitHubController',
        operation: 'createRepository',
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
      logger.warn('GitHub リポジトリ作成: バリデーションエラー', {
        component: 'GitHubController',
        operation: 'createRepository',
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

    const { name, description, private: isPrivate } = req.body;

    logger.info('GitHub リポジトリ作成開始', {
      component: 'GitHubController',
      operation: 'createRepository',
      requestId,
      userId,
      repositoryName: name,
      isPrivate: !!isPrivate,
      ip: req.ip
    });

    const repository = await GitHubService.createRepository(userId, name, description, isPrivate);

    const duration = Date.now() - startTime;
    logger.info('GitHub リポジトリ作成完了', {
      component: 'GitHubController',
      operation: 'createRepository',
      requestId,
      userId,
      repositoryName: name,
      repositoryId: repository.id,
      duration: `${duration}ms`
    });

    return res.status(201).json({
      success: true,
      data: repository,
      meta: {
        requestId,
        message: 'リポジトリが正常に作成されました'
      }
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('GitHub リポジトリ作成エラー', {
      component: 'GitHubController',
      operation: 'createRepository',
      requestId,
      userId: req.user?.id,
      repositoryName: req.body?.name,
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });

    let statusCode = 500;
    let errorCode = 'GITHUB_REPO_CREATE_ERROR';

    if (error.message.includes('GitHub認証が必要')) {
      statusCode = 401;
      errorCode = 'GITHUB_AUTH_REQUIRED';
    } else if (error.message.includes('同名のリポジトリが既に存在')) {
      statusCode = 409;
      errorCode = 'REPOSITORY_NAME_CONFLICT';
    } else if (error.message.includes('無効なGitHubトークン')) {
      statusCode = 401;
      errorCode = 'INVALID_GITHUB_TOKEN';
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
 * ファイルをGitHubにプッシュ
 * POST /api/github/push
 */
export const pushFiles = async (req: Request, res: Response<ApiResponse<GitHubPushResponse>>) => {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  try {
    const userId = req.user?.id;
    if (!userId) {
      logger.warn('GitHub ファイルプッシュ: 未認証リクエスト', {
        component: 'GitHubController',
        operation: 'pushFiles',
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
      logger.warn('GitHub ファイルプッシュ: バリデーションエラー', {
        component: 'GitHubController',
        operation: 'pushFiles',
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

    const pushRequest: GitHubPushRequest = req.body;

    logger.info('GitHub ファイルプッシュ開始', {
      component: 'GitHubController',
      operation: 'pushFiles',
      requestId,
      userId,
      exportId: pushRequest.exportId,
      repo: pushRequest.repo,
      branch: pushRequest.branch,
      ip: req.ip
    });

    const pushResponse = await GitHubService.pushFiles(userId, pushRequest);

    const duration = Date.now() - startTime;
    logger.info('GitHub ファイルプッシュ完了', {
      component: 'GitHubController',
      operation: 'pushFiles',
      requestId,
      userId,
      exportId: pushRequest.exportId,
      repo: pushRequest.repo,
      branch: pushRequest.branch,
      commitHash: pushResponse.commitHash,
      duration: `${duration}ms`
    });

    return res.json({
      success: true,
      data: pushResponse,
      meta: {
        requestId,
        message: 'ファイルが正常にプッシュされました'
      }
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('GitHub ファイルプッシュエラー', {
      component: 'GitHubController',
      operation: 'pushFiles',
      requestId,
      userId: req.user?.id,
      exportId: req.body?.exportId,
      repo: req.body?.repo,
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });

    let statusCode = 500;
    let errorCode = 'GITHUB_PUSH_ERROR';

    if (error.message.includes('GitHub認証が必要')) {
      statusCode = 401;
      errorCode = 'GITHUB_AUTH_REQUIRED';
    } else if (error.message.includes('エクスポートファイルが見つかりません')) {
      statusCode = 404;
      errorCode = 'EXPORT_FILE_NOT_FOUND';
    } else if (error.message.includes('リポジトリが見つかりません')) {
      statusCode = 404;
      errorCode = 'REPOSITORY_NOT_FOUND';
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
 * GitHub認証トークン設定（テスト・開発用）
 * POST /api/github/auth/token
 */
export const setAuthToken = async (req: Request, res: Response<ApiResponse<GitHubAuthStatus>>) => {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  try {
    const userId = req.user?.id;
    if (!userId) {
      logger.warn('GitHub 認証トークン設定: 未認証リクエスト', {
        component: 'GitHubController',
        operation: 'setAuthToken',
        requestId,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        error: '認証が必要です'
      });
    }

    const { accessToken } = req.body;
    if (!accessToken || typeof accessToken !== 'string') {
      logger.warn('GitHub 認証トークン設定: トークンが不正', {
        component: 'GitHubController',
        operation: 'setAuthToken',
        requestId,
        userId
      });

      return res.status(400).json({
        success: false,
        error: '有効なアクセストークンが必要です',
        meta: {
          requestId,
          code: 'INVALID_TOKEN_FORMAT'
        }
      });
    }

    logger.info('GitHub 認証トークン設定開始', {
      component: 'GitHubController',
      operation: 'setAuthToken',
      requestId,
      userId,
      ip: req.ip
    });

    const authStatus = await GitHubService.setAuthToken(userId, accessToken);

    const duration = Date.now() - startTime;
    logger.info('GitHub 認証トークン設定完了', {
      component: 'GitHubController',
      operation: 'setAuthToken',
      requestId,
      userId,
      username: authStatus.username,
      duration: `${duration}ms`
    });

    return res.json({
      success: true,
      data: authStatus,
      meta: {
        requestId,
        message: 'GitHub認証が正常に設定されました'
      }
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('GitHub 認証トークン設定エラー', {
      component: 'GitHubController',
      operation: 'setAuthToken',
      requestId,
      userId: req.user?.id,
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });

    let statusCode = 500;
    let errorCode = 'GITHUB_TOKEN_SET_ERROR';

    if (error.message.includes('無効なアクセストークン') || 
        error.message.includes('無効なGitHubトークン形式')) {
      statusCode = 400;
      errorCode = 'INVALID_GITHUB_TOKEN';
    } else if (error.message.includes('rate limit')) {
      statusCode = 429;
      errorCode = 'RATE_LIMIT_EXCEEDED';
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
 * GitHub認証解除
 * DELETE /api/github/auth
 */
export const removeAuth = async (req: Request, res: Response<ApiResponse<void>>) => {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  try {
    const userId = req.user?.id;
    if (!userId) {
      logger.warn('GitHub 認証解除: 未認証リクエスト', {
        component: 'GitHubController',
        operation: 'removeAuth',
        requestId,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        error: '認証が必要です'
      });
    }

    logger.info('GitHub 認証解除開始', {
      component: 'GitHubController',
      operation: 'removeAuth',
      requestId,
      userId,
      ip: req.ip
    });

    GitHubService.removeAuth(userId);

    const duration = Date.now() - startTime;
    logger.info('GitHub 認証解除完了', {
      component: 'GitHubController',
      operation: 'removeAuth',
      requestId,
      userId,
      duration: `${duration}ms`
    });

    return res.json({
      success: true,
      meta: {
        requestId,
        message: 'GitHub認証が正常に解除されました'
      }
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('GitHub 認証解除エラー', {
      component: 'GitHubController',
      operation: 'removeAuth',
      requestId,
      userId: req.user?.id,
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });

    return res.status(500).json({
      success: false,
      error: '認証解除に失敗しました',
      meta: {
        requestId,
        code: 'GITHUB_AUTH_REMOVE_ERROR'
      }
    });
  }
}