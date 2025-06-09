/**
 * レプリカ管理 - コントローラー層
 * 
 * レプリカ関連のHTTPリクエストを処理し、適切なレスポンスを返す
 */

import { Request, Response } from 'express';
import { ApiResponse, Replica } from '../../types';
import { replicaService, ReplicaServiceError } from './replica.service';
import { logger } from '../../common/utils/logger';

/**
 * レプリカコントローラークラス
 */
export class ReplicaController {
  /**
   * プロジェクトのレプリカデータを取得
   * GET /api/projects/:id/replica
   */
  async getReplicaByProjectId(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id: projectId } = req.params;
      
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: '認証が必要です'
        });
        return;
      }
      
      const userId = req.user.id;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'プロジェクトIDが指定されていません'
        });
        return;
      }

      logger.info('レプリカ取得リクエスト受信', {
        projectId,
        userId,
        username: req.user.username
      });

      // レプリカ取得
      const replica = await replicaService.getReplicaByProjectId(projectId, userId);

      logger.info('レプリカ取得成功', {
        projectId,
        replicaId: replica.id,
        htmlLength: replica.html.length,
        cssLength: replica.css.length,
        assetsCount: replica.assets.length
      });

      res.status(200).json({
        success: true,
        data: replica
      });

    } catch (error) {
      this.handleError(error, res, 'レプリカ取得');
    }
  }

  /**
   * プロジェクトのアセット一覧を取得
   * GET /api/projects/:id/replica/assets
   */
  async getAssetsByProjectId(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id: projectId } = req.params;
      
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: '認証が必要です'
        });
        return;
      }
      
      const userId = req.user.id;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'プロジェクトIDが指定されていません'
        });
        return;
      }

      logger.info('アセット一覧取得リクエスト受信', {
        projectId,
        userId,
        username: req.user?.username
      });

      // アセット一覧取得
      const assets = await replicaService.getAssetsByProjectId(projectId, userId);

      logger.info('アセット一覧取得成功', {
        projectId,
        assetsCount: assets.length,
        totalSize: assets.reduce((sum, asset) => sum + asset.size, 0)
      });

      res.status(200).json({
        success: true,
        data: assets,
        meta: {
          count: assets.length,
          totalSize: assets.reduce((sum, asset) => sum + asset.size, 0)
        }
      });

    } catch (error) {
      this.handleError(error, res, 'アセット一覧取得');
    }
  }

  /**
   * レプリカを更新（内部API、通常はエディター機能から使用）
   * PUT /api/projects/:id/replica
   */
  async updateReplica(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id: projectId } = req.params;
      
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: '認証が必要です'
        });
        return;
      }
      
      const userId = req.user.id;
      const { html, css } = req.body;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'プロジェクトIDが指定されていません'
        });
        return;
      }

      logger.info('レプリカ更新リクエスト受信', {
        projectId,
        userId,
        username: req.user?.username,
        htmlProvided: !!html,
        cssProvided: !!css
      });

      // 更新データの準備
      const updates: Partial<Pick<Replica, 'html' | 'css'>> = {};
      if (html !== undefined) updates.html = html;
      if (css !== undefined) updates.css = css;

      if (Object.keys(updates).length === 0) {
        logger.warn('更新データが指定されていません');
        res.status(400).json({
          success: false,
          error: '更新するデータを指定してください'
        });
        return;
      }

      // レプリカ更新
      const updatedReplica = await replicaService.updateReplica(
        projectId,
        userId,
        updates
      );

      logger.info('レプリカ更新成功', {
        projectId,
        replicaId: updatedReplica.id,
        updatedFields: Object.keys(updates)
      });

      res.status(200).json({
        success: true,
        data: updatedReplica
      });

    } catch (error) {
      this.handleError(error, res, 'レプリカ更新');
    }
  }

  /**
   * エラーハンドリング共通処理
   */
  private handleError(
    error: unknown,
    res: Response<ApiResponse>,
    operation: string
  ): void {
    if (error instanceof ReplicaServiceError) {
      logger.warn(`${operation}でビジネスエラー発生`, {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode
      });

      res.status(error.statusCode).json({
        success: false,
        error: error.message
      });
      return;
    }

    logger.error(`${operation}で予期しないエラーが発生`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
}

/**
 * レプリカコントローラーのシングルトンインスタンス
 */
export const replicaController = new ReplicaController();