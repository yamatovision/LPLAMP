import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { elementService } from './element.service';
import { ElementContextRequest, ApiResponse, ElementContextResponse, ID } from '../../types';
import { logger } from '../../common/utils/logger';

export class ElementController {

  /**
   * 要素コンテキストを作成
   * POST /api/element/context
   */
  async createContext(req: Request, res: Response): Promise<void> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const startTime = Date.now();
    
    logger.info(`[ElementController] 要素コンテキスト作成リクエスト開始`, {
      requestId,
      body: {
        projectId: req.body.projectId,
        elementSelector: req.body.element?.selector,
        elementTag: req.body.element?.tagName
      },
      userId: req.user?.id
    });

    try {
      // バリデーション結果チェック
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn(`[ElementController] バリデーションエラー`, {
          requestId,
          errors: errors.array(),
          userId: req.user?.id
        });
        
        const response: ApiResponse = {
          success: false,
          error: 'リクエストデータが不正です',
          meta: { 
            validationErrors: errors.array(),
            requestId 
          }
        };
        res.status(400).json(response);
        return;
      }

      // 認証チェック
      if (!req.user?.id) {
        logger.warn(`[ElementController] 認証エラー`, { requestId });
        const response: ApiResponse = {
          success: false,
          error: '認証が必要です'
        };
        res.status(401).json(response);
        return;
      }

      // リクエストデータの構築
      const elementRequest: ElementContextRequest = {
        projectId: req.body.projectId,
        element: req.body.element
      };

      // サービス実行
      const result = await elementService.createElementContext(
        elementRequest,
        req.user!.id
      );

      const processingTime = Date.now() - startTime;
      logger.info(`[ElementController] 要素コンテキスト作成成功`, {
        requestId,
        contextId: result.contextId,
        processingTime: `${processingTime}ms`,
        userId: req.user.id
      });

      const response: ApiResponse<ElementContextResponse> = {
        success: true,
        data: result,
        meta: {
          requestId,
          processingTime
        }
      };

      res.status(201).json(response);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`[ElementController] 要素コンテキスト作成エラー`, {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        processingTime: `${processingTime}ms`,
        userId: req.user?.id
      });

      const response: ApiResponse = {
        success: false,
        error: 'サーバーエラーが発生しました',
        meta: { requestId }
      };

      res.status(500).json(response);
    }
  }

  /**
   * 要素コンテキスト履歴を取得
   * GET /api/element/context/history/:projectId
   */
  async getContextHistory(req: Request, res: Response): Promise<void> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const startTime = Date.now();
    const projectId = req.params['projectId'] as ID;
    const limit = parseInt(req.query['limit'] as string) || 10;

    logger.info(`[ElementController] 要素コンテキスト履歴取得開始`, {
      requestId,
      projectId,
      limit,
      userId: req.user?.id
    });

    try {
      // 認証チェック
      if (!req.user?.id) {
        logger.warn(`[ElementController] 認証エラー`, { requestId, projectId });
        const response: ApiResponse = {
          success: false,
          error: '認証が必要です'
        };
        res.status(401).json(response);
        return;
      }

      // プロジェクトIDの形式チェック
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(projectId)) {
        logger.warn(`[ElementController] 不正なプロジェクトID`, { requestId, projectId });
        const response: ApiResponse = {
          success: false,
          error: 'プロジェクトIDの形式が不正です'
        };
        res.status(400).json(response);
        return;
      }

      const contexts = await elementService.getElementContextHistory(
        projectId,
        req.user.id,
        limit
      );

      const processingTime = Date.now() - startTime;
      logger.info(`[ElementController] 要素コンテキスト履歴取得成功`, {
        requestId,
        projectId,
        count: contexts.length,
        processingTime: `${processingTime}ms`,
        userId: req.user.id
      });

      const response: ApiResponse<typeof contexts> = {
        success: true,
        data: contexts,
        meta: {
          requestId,
          count: contexts.length,
          processingTime
        }
      };

      res.status(200).json(response);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`[ElementController] 要素コンテキスト履歴取得エラー`, {
        requestId,
        projectId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        processingTime: `${processingTime}ms`,
        userId: req.user?.id
      });

      const statusCode = error instanceof Error && error.message.includes('見つからない') ? 404 : 500;
      const response: ApiResponse = {
        success: false,
        error: statusCode === 404 ? 'プロジェクトが見つかりません' : 'サーバーエラーが発生しました',
        meta: { requestId }
      };

      res.status(statusCode).json(response);
    }
  }
}

export const elementController = new ElementController();