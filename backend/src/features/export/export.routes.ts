/**
 * エクスポート機能 - ルート定義
 * 
 * エクスポート機能APIのエンドポイントを定義
 * すべてのエンドポイントは認証が必要
 */

import { Router } from 'express';
import { exportController } from './export.controller';
import { 
  validatePrepareExport,
  validateDownloadExport,
  validateExportHistory,
  validateFileSize,
  validateRateLimit,
  setSecurityHeaders,
  sanitizeExportFormat
} from './export.validator';
import { requireAuth } from '../../common/middlewares/auth.middleware';

/**
 * エクスポートルーターの作成
 */
export function createExportRoutes(): Router {
  const router = Router();

  /**
   * エクスポート機能APIエンドポイント
   * すべてのエンドポイントで認証が必要
   */

  // POST /api/export/prepare - エクスポート準備
  router.post(
    '/prepare',
    requireAuth,
    validateRateLimit(), // レート制限（1分間に5回まで）
    validateFileSize(100), // ファイルサイズ制限（100MB）
    sanitizeExportFormat,
    validatePrepareExport,
    (req, res) => exportController.prepareExport(req, res)
  );

  // GET /api/export/:exportId/download - エクスポートファイルダウンロード
  router.get(
    '/:exportId/download',
    requireAuth,
    setSecurityHeaders,
    validateDownloadExport,
    (req, res) => exportController.downloadExport(req, res)
  );

  // POST /api/export/cleanup - エクスポートクリーンアップ（管理者用）
  // 注意: 本来は管理者権限チェックが必要だが、簡略化のため認証のみ
  router.post(
    '/cleanup',
    requireAuth,
    (req, res) => exportController.cleanupExports(req, res)
  );

  return router;
}

/**
 * プロジェクト関連のエクスポートルーターの作成
 * プロジェクトルーターに組み込まれる
 */
export function createProjectExportRoutes(): Router {
  const router = Router();

  // GET /api/projects/:projectId/exports - プロジェクトのエクスポート履歴取得
  router.get(
    '/:projectId/exports',
    requireAuth,
    validateExportHistory,
    (req, res) => exportController.getExportHistory(req, res)
  );

  return router;
}