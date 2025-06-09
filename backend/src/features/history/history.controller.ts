/**
 * 履歴管理 - コントローラー層
 * 
 * HTTPリクエスト/レスポンスの処理を担当
 * サービス層を呼び出してビジネスロジックを実行
 */

import { Request, Response } from 'express';
import { historyService } from './history.service';
import { HistoryType, ApiResponse, History, PaginatedResponse } from '../../types';
import { logger } from '../../common/utils/logger';


/**
 * 履歴管理コントローラー
 */
export class HistoryController {
  /**
   * 履歴を作成
   * POST /api/projects/:id/history
   */
  async createHistory(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params['id'];
      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'プロジェクトIDが指定されていません'
        });
        return;
      }
      
      const { description, snapshot, type } = req.body;
      const userId = req.user!.id;

      const history = await historyService.createHistory(
        projectId,
        userId,
        description,
        snapshot,
        type || HistoryType.EDIT
      );

      const response: ApiResponse<History> = {
        success: true,
        data: history
      };

      res.status(201).json(response);
    } catch (error: any) {
      logger.error('履歴作成エラー', {
        error,
        projectId: req.params['id'],
        userId: req.user?.id
      });

      const statusCode = error.statusCode || 500;
      const response: ApiResponse = {
        success: false,
        error: error.message || '履歴の作成中にエラーが発生しました'
      };

      res.status(statusCode).json(response);
    }
  }

  /**
   * 履歴一覧を取得
   * GET /api/projects/:id/history
   */
  async getHistoryList(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params['id'];
      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'プロジェクトIDが指定されていません'
        });
        return;
      }
      
      const { page = '1', limit = '20' } = req.query;
      const userId = req.user!.id;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      const result = await historyService.getHistoryList(
        projectId,
        userId,
        pageNum,
        limitNum
      );

      const response: ApiResponse<PaginatedResponse<History>> = {
        success: true,
        data: result
      };

      res.json(response);
    } catch (error: any) {
      logger.error('履歴一覧取得エラー', {
        error,
        projectId: req.params['id'],
        userId: req.user?.id
      });

      const statusCode = error.statusCode || 500;
      const response: ApiResponse = {
        success: false,
        error: error.message || '履歴一覧の取得中にエラーが発生しました'
      };

      res.status(statusCode).json(response);
    }
  }

  /**
   * 特定の履歴を取得
   * GET /api/projects/:id/history/:historyId
   */
  async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params['id'];
      const historyId = req.params['historyId'];
      
      if (!projectId || !historyId) {
        res.status(400).json({
          success: false,
          error: 'プロジェクトIDまたは履歴IDが指定されていません'
        });
        return;
      }
      
      const userId = req.user!.id;

      const history = await historyService.getHistory(
        projectId,
        historyId,
        userId
      );

      const response: ApiResponse<History> = {
        success: true,
        data: history
      };

      res.json(response);
    } catch (error: any) {
      logger.error('履歴取得エラー', {
        error,
        projectId: req.params['id'],
        historyId: req.params['historyId'],
        userId: req.user?.id
      });

      const statusCode = error.statusCode || 500;
      const response: ApiResponse = {
        success: false,
        error: error.message || '履歴の取得中にエラーが発生しました'
      };

      res.status(statusCode).json(response);
    }
  }

  /**
   * 履歴から復元
   * POST /api/projects/:id/history/:historyId/restore
   */
  async restoreFromHistory(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params['id'];
      const historyId = req.params['historyId'];
      
      if (!projectId || !historyId) {
        res.status(400).json({
          success: false,
          error: 'プロジェクトIDまたは履歴IDが指定されていません'
        });
        return;
      }
      
      const userId = req.user!.id;

      const restoredHistory = await historyService.restoreFromHistory(
        projectId,
        historyId,
        userId
      );

      const response: ApiResponse<History> = {
        success: true,
        data: restoredHistory
      };

      res.json(response);
    } catch (error: any) {
      logger.error('履歴復元エラー', {
        error,
        projectId: req.params['id'],
        historyId: req.params['historyId'],
        userId: req.user?.id
      });

      const statusCode = error.statusCode || 500;
      const response: ApiResponse = {
        success: false,
        error: error.message || '履歴からの復元中にエラーが発生しました'
      };

      res.status(statusCode).json(response);
    }
  }
}

// シングルトンインスタンスをエクスポート
export const historyController = new HistoryController();