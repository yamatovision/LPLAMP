/**
 * プロジェクト管理 - ルート定義
 * 
 * APIエンドポイントの定義と認証ミドルウェアの設定
 * 型定義ファイルのAPI_PATHSと一致するルート構成
 */

import { Router } from 'express';
import { projectController } from './projects.controller';
import { authMiddleware } from '../../common/middlewares/auth.middleware';
import { logger } from '../../common/utils/logger';
import { createProjectExportRoutes } from '../export/export.routes';

/**
 * プロジェクト関連のルーター作成
 */
export function createProjectRoutes(): Router {
  const router = Router();

  logger.info('プロジェクト管理ルート初期化開始');

  // ===== 認証不要エンドポイント =====
  
  /**
   * ヘルスチェック（デバッグ用）
   * GET /api/projects/health
   */
  router.get('/health', projectController.healthCheck.bind(projectController));

  // ===== 認証必須エンドポイント =====
  // すべてのプロジェクト操作は認証が必要

  /**
   * 新規プロジェクト作成（レプリカ開始）
   * POST /api/projects/create
   * Body: { url: string, name?: string }
   */
  router.post(
    '/create',
    authMiddleware,
    projectController.createProject.bind(projectController)
  );

  /**
   * プロジェクト一覧取得
   * GET /api/projects
   * 認証ユーザーの所有プロジェクトを返す
   */
  router.get(
    '/',
    authMiddleware,
    projectController.getProjects.bind(projectController)
  );

  /**
   * プロジェクト詳細取得
   * GET /api/projects/:id
   * パラメータ: id - プロジェクトID
   */
  router.get(
    '/:id',
    authMiddleware,
    projectController.getProjectById.bind(projectController)
  );

  /**
   * プロジェクト情報更新
   * PUT /api/projects/:id
   * パラメータ: id - プロジェクトID
   * Body: { name?: string, githubRepo?: string, deploymentUrl?: string }
   */
  router.put(
    '/:id',
    authMiddleware,
    projectController.updateProject.bind(projectController)
  );

  /**
   * プロジェクト削除
   * DELETE /api/projects/:id
   * パラメータ: id - プロジェクトID
   */
  router.delete(
    '/:id',
    authMiddleware,
    projectController.deleteProject.bind(projectController)
  );

  /**
   * プロジェクト作成ステータス確認
   * GET /api/projects/:id/status
   * パラメータ: id - プロジェクトID
   * レプリカ作成の進捗状況を確認
   */
  router.get(
    '/:id/status',
    authMiddleware,
    projectController.getProjectStatus.bind(projectController)
  );

  /**
   * 編集バリエーション取得
   * GET /api/projects/:id/variations
   * パラメータ: id - プロジェクトID
   * クエリ: selector - 要素セレクタ
   * ClaudeCodeで生成された編集バリエーションを取得
   */
  router.get(
    '/:id/variations',
    authMiddleware,
    projectController.getEditVariations.bind(projectController)
  );

  /**
   * プロジェクトファイル一覧取得
   * GET /api/projects/:id/files
   * パラメータ: id - プロジェクトID
   * クエリ: path - ディレクトリパス（オプション）
   */
  router.get(
    '/:id/files',
    authMiddleware,
    projectController.getProjectFiles.bind(projectController)
  );

  /**
   * プロジェクトファイル取得
   * GET /api/projects/:id/files/:path
   * パラメータ: id - プロジェクトID, path - ファイルパス（URLエンコード済み）
   */
  router.get(
    '/:id/files/:path',
    authMiddleware,
    projectController.getProjectFile.bind(projectController)
  );

  /**
   * プロジェクトファイル更新
   * PUT /api/projects/:id/files/:path
   * パラメータ: id - プロジェクトID, path - ファイルパス（URLエンコード済み）
   * Body: { content: string, encoding?: 'utf8' | 'base64' }
   */
  router.put(
    '/:id/files/:path',
    authMiddleware,
    projectController.updateProjectFile.bind(projectController)
  );

  // エクスポート履歴取得ルートを組み込み
  router.use('/', createProjectExportRoutes());

  logger.info('プロジェクト管理ルート初期化完了', {
    endpoints: [
      'GET /health',
      'POST /create',
      'GET /',
      'GET /:id',
      'PUT /:id',
      'DELETE /:id',
      'GET /:id/status',
      'GET /:id/variations',
      'GET /:id/files',
      'GET /:id/files/:path',
      'PUT /:id/files/:path'
    ]
  });

  return router;
}

/**
 * プロジェクトルーターのインスタンス
 */
export const projectRoutes = createProjectRoutes();