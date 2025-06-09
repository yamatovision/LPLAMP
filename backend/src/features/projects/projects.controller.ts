/**
 * プロジェクト管理 - コントローラー層
 * 
 * HTTPリクエスト/レスポンス処理とエラーハンドリング
 * 認証ミドルウェアと連携してユーザー情報を取得
 */

import { Request, Response } from 'express';
import { 
  projectService, 
  ProjectService, 
  ProjectServiceError, 
  ProjectAccessError, 
  ProjectNotFoundError 
} from './projects.service';
import { 
  ApiResponse, 
  Project, 
  ProjectCreateResponse, 
  ProjectStatusResponse, 
  ProjectFileResponse, 
  ProjectFileUpdateResponse, 
  ProjectDirectory 
} from '../../types';
import { logger } from '../../common/utils/logger';


/**
 * プロジェクトコントローラークラス
 */
export class ProjectController {
  constructor(private service: ProjectService = projectService) {}

  /**
   * 新規プロジェクト作成
   * POST /api/projects/create
   */
  async createProject(req: Request, res: Response): Promise<void> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    try {
      logger.info('[プロジェクト作成] リクエスト開始', {
        requestId,
        userId: req.user?.id,
        body: req.body
      });

      if (!req.user) {
        logger.warn('[プロジェクト作成] 認証情報なし', { requestId });
        res.status(401).json({
          success: false,
          error: '認証が必要です'
        } as ApiResponse);
        return;
      }

      const result = await this.service.createProject(req.body, req.user.id);

      logger.info('[プロジェクト作成] 成功', {
        requestId,
        userId: req.user.id,
        projectId: result.projectId
      });

      res.status(201).json({
        success: true,
        data: result
      } as ApiResponse<ProjectCreateResponse>);

    } catch (error) {
      this.handleError(error, res, requestId, 'プロジェクト作成');
    }
  }

  /**
   * プロジェクト一覧取得
   * GET /api/projects
   */
  async getProjects(req: Request, res: Response): Promise<void> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    try {
      logger.info('[プロジェクト一覧取得] リクエスト開始', {
        requestId,
        userId: req.user?.id
      });

      if (!req.user) {
        logger.warn('[プロジェクト一覧取得] 認証情報なし', { requestId });
        res.status(401).json({
          success: false,
          error: '認証が必要です'
        } as ApiResponse);
        return;
      }

      const projects = await this.service.getProjectsByUser(req.user.id);

      logger.info('[プロジェクト一覧取得] 成功', {
        requestId,
        userId: req.user.id,
        projectCount: projects.length
      });

      res.status(200).json({
        success: true,
        data: { projects }
      } as ApiResponse<{ projects: Project[] }>);

    } catch (error) {
      this.handleError(error, res, requestId, 'プロジェクト一覧取得');
    }
  }

  /**
   * プロジェクト詳細取得
   * GET /api/projects/:id
   */
  async getProjectById(req: Request, res: Response): Promise<void> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const projectId = req.params['id'];
    
    try {
      logger.info('[プロジェクト詳細取得] リクエスト開始', {
        requestId,
        userId: req.user?.id,
        projectId
      });

      if (!req.user) {
        logger.warn('[プロジェクト詳細取得] 認証情報なし', { requestId });
        res.status(401).json({
          success: false,
          error: '認証が必要です'
        } as ApiResponse);
        return;
      }

      if (!projectId) {
        logger.warn('[プロジェクト詳細取得] プロジェクトIDなし', { requestId });
        res.status(400).json({
          success: false,
          error: 'プロジェクトIDが必要です'
        } as ApiResponse);
        return;
      }

      const project = await this.service.getProjectById(projectId, req.user.id);

      logger.info('[プロジェクト詳細取得] 成功', {
        requestId,
        userId: req.user.id,
        projectId
      });

      res.status(200).json({
        success: true,
        data: project
      } as ApiResponse<Project>);

    } catch (error) {
      this.handleError(error, res, requestId, 'プロジェクト詳細取得');
    }
  }

  /**
   * プロジェクト情報更新
   * PUT /api/projects/:id
   */
  async updateProject(req: Request, res: Response): Promise<void> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const projectId = req.params['id'];
    
    try {
      logger.info('[プロジェクト更新] リクエスト開始', {
        requestId,
        userId: req.user?.id,
        projectId,
        body: req.body
      });

      if (!req.user) {
        logger.warn('[プロジェクト更新] 認証情報なし', { requestId });
        res.status(401).json({
          success: false,
          error: '認証が必要です'
        } as ApiResponse);
        return;
      }

      if (!projectId) {
        logger.warn('[プロジェクト更新] プロジェクトIDなし', { requestId });
        res.status(400).json({
          success: false,
          error: 'プロジェクトIDが必要です'
        } as ApiResponse);
        return;
      }

      const updatedProject = await this.service.updateProject(projectId, req.body, req.user.id);

      logger.info('[プロジェクト更新] 成功', {
        requestId,
        userId: req.user.id,
        projectId
      });

      res.status(200).json({
        success: true,
        data: updatedProject
      } as ApiResponse<Project>);

    } catch (error) {
      this.handleError(error, res, requestId, 'プロジェクト更新');
    }
  }

  /**
   * プロジェクト削除
   * DELETE /api/projects/:id
   */
  async deleteProject(req: Request, res: Response): Promise<void> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const projectId = req.params['id'];
    
    try {
      logger.info('[プロジェクト削除] リクエスト開始', {
        requestId,
        userId: req.user?.id,
        projectId
      });

      if (!req.user) {
        logger.warn('[プロジェクト削除] 認証情報なし', { requestId });
        res.status(401).json({
          success: false,
          error: '認証が必要です'
        } as ApiResponse);
        return;
      }

      if (!projectId) {
        logger.warn('[プロジェクト削除] プロジェクトIDなし', { requestId });
        res.status(400).json({
          success: false,
          error: 'プロジェクトIDが必要です'
        } as ApiResponse);
        return;
      }

      await this.service.deleteProject(projectId, req.user.id);

      logger.info('[プロジェクト削除] 成功', {
        requestId,
        userId: req.user.id,
        projectId
      });

      res.status(200).json({
        success: true,
        data: { message: 'プロジェクトを削除しました' }
      } as ApiResponse<{ message: string }>);

    } catch (error) {
      this.handleError(error, res, requestId, 'プロジェクト削除');
    }
  }

  /**
   * プロジェクト作成ステータス確認
   * GET /api/projects/:id/status
   */
  async getProjectStatus(req: Request, res: Response): Promise<void> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const projectId = req.params['id'];
    
    try {
      logger.info('[プロジェクトステータス確認] リクエスト開始', {
        requestId,
        userId: req.user?.id,
        projectId
      });

      if (!req.user) {
        logger.warn('[プロジェクトステータス確認] 認証情報なし', { requestId });
        res.status(401).json({
          success: false,
          error: '認証が必要です'
        } as ApiResponse);
        return;
      }

      if (!projectId) {
        logger.warn('[プロジェクトステータス確認] プロジェクトIDなし', { requestId });
        res.status(400).json({
          success: false,
          error: 'プロジェクトIDが必要です'
        } as ApiResponse);
        return;
      }

      const status = await this.service.getProjectStatus(projectId, req.user.id);

      logger.info('[プロジェクトステータス確認] 成功', {
        requestId,
        userId: req.user.id,
        projectId,
        status: status.status
      });

      res.status(200).json({
        success: true,
        data: status
      } as ApiResponse<ProjectStatusResponse>);

    } catch (error) {
      this.handleError(error, res, requestId, 'プロジェクトステータス確認');
    }
  }

  /**
   * エラーハンドリング
   */
  private handleError(error: any, res: Response, requestId: string, operation: string): void {
    logger.error(`[${operation}] エラー発生`, {
      requestId,
      error: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode
    });

    if (error instanceof ProjectNotFoundError) {
      res.status(404).json({
        success: false,
        error: error.message
      } as ApiResponse);
      return;
    }

    if (error instanceof ProjectAccessError) {
      res.status(403).json({
        success: false,
        error: error.message
      } as ApiResponse);
      return;
    }

    if (error instanceof ProjectServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        ...(process.env['NODE_ENV'] === 'development' && { details: error.code })
      } as ApiResponse);
      return;
    }

    // 予期しないエラー
    res.status(500).json({
      success: false,
      error: '内部サーバーエラーが発生しました',
      ...(process.env['NODE_ENV'] === 'development' && { 
        details: error.message,
        requestId 
      })
    } as ApiResponse);
  }

  /**
   * 編集バリエーション取得
   * GET /api/projects/:id/variations
   */
  async getEditVariations(req: Request, res: Response): Promise<void> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const projectId = req.params['id'];
    const elementSelector = req.query['selector'] as string;

    try {
      logger.info('[編集バリエーション取得] リクエスト開始', {
        requestId,
        projectId,
        elementSelector,
        userId: req.user?.id
      });

      // 認証チェック
      if (!req.user?.id) {
        logger.warn('[編集バリエーション取得] 認証エラー', { requestId });
        res.status(401).json({
          success: false,
          error: '認証が必要です'
        } as ApiResponse);
        return;
      }

      // プロジェクトIDチェック
      if (!projectId) {
        logger.warn('[編集バリエーション取得] プロジェクトIDなし', { requestId });
        res.status(400).json({
          success: false,
          error: 'プロジェクトIDが必要です'
        } as ApiResponse);
        return;
      }

      // セレクタパラメータチェック
      if (!elementSelector) {
        logger.warn('[編集バリエーション取得] セレクタパラメータ不足', { requestId, projectId });
        res.status(400).json({
          success: false,
          error: 'セレクタパラメータが必要です'
        } as ApiResponse);
        return;
      }

      const variations = await this.service.getEditVariations(
        projectId,
        elementSelector as string,
        req.user.id
      );

      logger.info('[編集バリエーション取得] 成功', {
        requestId,
        projectId,
        elementSelector,
        variationCount: variations.length,
        userId: req.user.id
      });

      res.status(200).json({
        success: true,
        data: variations,
        meta: {
          requestId,
          projectId,
          elementSelector,
          count: variations.length
        }
      } as ApiResponse<typeof variations>);

    } catch (error: any) {
      logger.error('[編集バリエーション取得] エラー', {
        requestId,
        projectId,
        elementSelector,
        error: error.message || String(error),
        userId: req.user?.id
      });

      this.handleError(error, res, requestId, 'バリエーション生成');
    }
  }

  /**
   * ヘルスチェック（デバッグ用）
   * GET /api/projects/health
   */
  async healthCheck(_req: Request, res: Response): Promise<void> {
    const timestamp = new Date().toISOString();
    
    logger.debug('[プロジェクト管理] ヘルスチェック', { timestamp });

    res.status(200).json({
      success: true,
      data: {
        service: 'プロジェクト管理',
        status: 'healthy',
        timestamp,
        environment: process.env['NODE_ENV'] || 'development'
      }
    } as ApiResponse<{ service: string; status: string; timestamp: string; environment: string }>);
  }

  /**
   * プロジェクトファイル取得
   * GET /api/projects/:id/files/:path
   */
  async getProjectFile(req: Request, res: Response): Promise<void> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const projectId = req.params['id'];
    const filePath = decodeURIComponent(req.params['path'] || '');

    try {
      logger.info('[プロジェクトファイル取得] リクエスト開始', {
        requestId,
        projectId,
        filePath,
        userId: req.user?.id
      });

      if (!req.user?.id) {
        logger.warn('[プロジェクトファイル取得] 認証エラー', { requestId });
        res.status(401).json({
          success: false,
          error: '認証が必要です'
        } as ApiResponse);
        return;
      }

      if (!projectId) {
        logger.warn('[プロジェクトファイル取得] プロジェクトIDなし', { requestId });
        res.status(400).json({
          success: false,
          error: 'プロジェクトIDが必要です'
        } as ApiResponse);
        return;
      }

      if (!filePath) {
        logger.warn('[プロジェクトファイル取得] ファイルパスなし', { requestId });
        res.status(400).json({
          success: false,
          error: 'ファイルパスが必要です'
        } as ApiResponse);
        return;
      }

      const result = await this.service.getProjectFile(projectId, filePath, req.user.id);

      logger.info('[プロジェクトファイル取得] 成功', {
        requestId,
        projectId,
        filePath,
        fileExists: result.exists,
        fileSize: result.file.size
      });

      res.status(200).json({
        success: true,
        data: result,
        meta: {
          requestId,
          projectId,
          filePath
        }
      } as ApiResponse<ProjectFileResponse>);

    } catch (error: any) {
      logger.error('[プロジェクトファイル取得] エラー', {
        requestId,
        projectId,
        filePath,
        error: error.message || String(error),
        userId: req.user?.id
      });

      this.handleError(error, res, requestId, 'ファイル取得');
    }
  }

  /**
   * プロジェクトファイル更新
   * PUT /api/projects/:id/files/:path
   */
  async updateProjectFile(req: Request, res: Response): Promise<void> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const projectId = req.params['id'];
    const filePath = decodeURIComponent(req.params['path'] || '');

    try {
      logger.info('[プロジェクトファイル更新] リクエスト開始', {
        requestId,
        projectId,
        filePath,
        userId: req.user?.id,
        contentLength: req.body?.content?.length || 0
      });

      if (!req.user?.id) {
        logger.warn('[プロジェクトファイル更新] 認証エラー', { requestId });
        res.status(401).json({
          success: false,
          error: '認証が必要です'
        } as ApiResponse);
        return;
      }

      if (!projectId) {
        logger.warn('[プロジェクトファイル更新] プロジェクトIDなし', { requestId });
        res.status(400).json({
          success: false,
          error: 'プロジェクトIDが必要です'
        } as ApiResponse);
        return;
      }

      if (!filePath) {
        logger.warn('[プロジェクトファイル更新] ファイルパスなし', { requestId });
        res.status(400).json({
          success: false,
          error: 'ファイルパスが必要です'
        } as ApiResponse);
        return;
      }

      if (!req.body?.content && req.body?.content !== '') {
        logger.warn('[プロジェクトファイル更新] コンテンツなし', { requestId });
        res.status(400).json({
          success: false,
          error: 'ファイルコンテンツが必要です'
        } as ApiResponse);
        return;
      }

      const result = await this.service.updateProjectFile(
        projectId, 
        filePath, 
        req.body, 
        req.user.id
      );

      logger.info('[プロジェクトファイル更新] 成功', {
        requestId,
        projectId,
        filePath,
        newSize: result.file.size
      });

      res.status(200).json({
        success: true,
        data: result,
        meta: {
          requestId,
          projectId,
          filePath
        }
      } as ApiResponse<ProjectFileUpdateResponse>);

    } catch (error: any) {
      logger.error('[プロジェクトファイル更新] エラー', {
        requestId,
        projectId,
        filePath,
        error: error.message || String(error),
        userId: req.user?.id
      });

      this.handleError(error, res, requestId, 'ファイル更新');
    }
  }

  /**
   * プロジェクトファイル一覧取得
   * GET /api/projects/:id/files
   */
  async getProjectFiles(req: Request, res: Response): Promise<void> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const projectId = req.params['id'];
    const dirPath = req.query['path'] as string || '';

    try {
      logger.info('[プロジェクトファイル一覧取得] リクエスト開始', {
        requestId,
        projectId,
        dirPath,
        userId: req.user?.id
      });

      if (!req.user?.id) {
        logger.warn('[プロジェクトファイル一覧取得] 認証エラー', { requestId });
        res.status(401).json({
          success: false,
          error: '認証が必要です'
        } as ApiResponse);
        return;
      }

      if (!projectId) {
        logger.warn('[プロジェクトファイル一覧取得] プロジェクトIDなし', { requestId });
        res.status(400).json({
          success: false,
          error: 'プロジェクトIDが必要です'
        } as ApiResponse);
        return;
      }

      const result = await this.service.getProjectDirectory(projectId, dirPath, req.user.id);

      logger.info('[プロジェクトファイル一覧取得] 成功', {
        requestId,
        projectId,
        dirPath,
        itemCount: result.length
      });

      res.status(200).json({
        success: true,
        data: result,
        meta: {
          requestId,
          projectId,
          dirPath,
          count: result.length
        }
      } as ApiResponse<ProjectDirectory[]>);

    } catch (error: any) {
      logger.error('[プロジェクトファイル一覧取得] エラー', {
        requestId,
        projectId,
        dirPath,
        error: error.message || String(error),
        userId: req.user?.id
      });

      this.handleError(error, res, requestId, 'ファイル一覧取得');
    }
  }
}

/**
 * プロジェクトコントローラーのシングルトンインスタンス
 */
export const projectController = new ProjectController();