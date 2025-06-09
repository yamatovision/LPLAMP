/**
 * レプリカ管理 - ルート定義
 * 
 * レプリカ関連のAPIエンドポイントを定義
 */

import { Router } from 'express';
import { replicaController } from './replica.controller';
import { requireAuth } from '../../common/middlewares/auth.middleware';
import { validateProjectIdParam } from './replica.validator';
import { API_PATHS } from '../../types';

/**
 * レプリカルーターの作成
 */
export function createReplicaRoutes(): Router {
  const router = Router();

  /**
   * GET /api/projects/:id/replica
   * プロジェクトのレプリカデータを取得
   * 
   * 認証: 必要
   * 権限: プロジェクトの所有者のみ
   */
  router.get(
    API_PATHS.REPLICA.GET(':id').replace('/api/projects/', '/'),
    requireAuth,
    validateProjectIdParam,
    (req, res) => replicaController.getReplicaByProjectId(req, res)
  );

  /**
   * GET /api/projects/:id/replica/assets
   * プロジェクトのアセット一覧を取得
   * 
   * 認証: 必要
   * 権限: プロジェクトの所有者のみ
   */
  router.get(
    `/:id/replica/assets`,
    requireAuth,
    validateProjectIdParam,
    (req, res) => replicaController.getAssetsByProjectId(req, res)
  );

  /**
   * PUT /api/projects/:id/replica
   * レプリカを更新（内部API）
   * 
   * 認証: 必要
   * 権限: プロジェクトの所有者のみ
   * 
   * ※ このエンドポイントは通常エディター機能から内部的に使用される
   */
  router.put(
    API_PATHS.REPLICA.UPDATE(':id').replace('/api/projects/', '/'),
    requireAuth,
    validateProjectIdParam,
    (req, res) => replicaController.updateReplica(req, res)
  );

  return router;
}

/**
 * デフォルトエクスポート
 */
const replicaRoutes = createReplicaRoutes();
export default replicaRoutes;