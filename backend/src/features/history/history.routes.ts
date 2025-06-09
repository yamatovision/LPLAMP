/**
 * 履歴管理 - ルート定義
 * 
 * 履歴管理APIのエンドポイントを定義
 * すべてのエンドポイントは認証が必要
 */

import { Router } from 'express';
import { historyController } from './history.controller';
import { 
  validateCreateHistory, 
  validateRestoreHistory,
  validatePagination 
} from './history.validator';
import { requireAuth } from '../../common/middlewares/auth.middleware';

/**
 * 履歴ルーターの作成
 */
export function createHistoryRoutes(): Router {
  const router = Router();

  /**
   * 履歴管理APIエンドポイント
   * すべてのエンドポイントで認証が必要
   */

  // POST /api/projects/:id/history - 編集履歴保存
  router.post(
    '/:id/history',
    requireAuth,
    validateCreateHistory,
    (req, res) => historyController.createHistory(req, res)
  );

  // GET /api/projects/:id/history - 編集履歴一覧取得
  router.get(
    '/:id/history',
  requireAuth,
  validatePagination,
  (req, res) => historyController.getHistoryList(req, res)
);

  // GET /api/projects/:id/history/:historyId - 特定履歴の詳細取得
  router.get(
    '/:id/history/:historyId',
  requireAuth,
  (req, res) => historyController.getHistory(req, res)
);

  // POST /api/projects/:id/history/:historyId/restore - 履歴から復元
  router.post(
    '/:id/history/:historyId/restore',
  requireAuth,
  validateRestoreHistory,
    (req, res) => historyController.restoreFromHistory(req, res)
  );

  return router;
}