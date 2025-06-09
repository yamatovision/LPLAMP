/**
 * エクスポート機能 - コントローラー層
 * 
 * HTTPリクエスト/レスポンスの処理を担当
 * サービス層を呼び出してビジネスロジックを実行
 */

import { Request, Response } from 'express';
import { exportService } from './export.service';
import { 
  ApiResponse, 
  Export, 
  ExportPrepareRequest,
  ExportPrepareResponse 
} from '../../types';
import { logger } from '../../common/utils/logger';
import * as fs from 'fs/promises';

/**
 * エクスポート管理コントローラー
 */
export class ExportController {
  /**
   * エクスポート準備
   * POST /api/export/prepare
   */
  async prepareExport(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, format, optimize = true } = req.body;
      const userId = req.user!.id;

      // リクエストデータの構築
      const request: ExportPrepareRequest = {
        projectId,
        format,
        optimize
      };

      const result = await exportService.prepareExport(request, userId);

      const response: ApiResponse<ExportPrepareResponse> = {
        success: true,
        data: result
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error('エクスポート準備エラー', {
        error,
        body: req.body,
        userId: req.user?.id
      });

      const statusCode = error.statusCode || 500;
      const response: ApiResponse = {
        success: false,
        error: error.message || 'エクスポート準備中にエラーが発生しました'
      };

      res.status(statusCode).json(response);
    }
  }

  /**
   * エクスポートファイルダウンロード
   * GET /api/export/:exportId/download
   */
  async downloadExport(req: Request, res: Response): Promise<void> {
    try {
      const exportId = req.params['exportId'];
      if (!exportId) {
        res.status(400).json({
          success: false,
          error: 'エクスポートIDが指定されていません'
        });
        return;
      }

      const userId = req.user!.id;

      const downloadInfo = await exportService.getExportDownload(exportId, userId);

      // ファイルの存在確認
      try {
        await fs.access(downloadInfo.filePath);
      } catch {
        res.status(404).json({
          success: false,
          error: 'エクスポートファイルが見つかりません'
        });
        return;
      }

      // ファイル情報を取得
      const stats = await fs.stat(downloadInfo.filePath);
      const fileName = this.generateDownloadFileName(downloadInfo.export);

      // レスポンスヘッダーを設定
      res.setHeader('Content-Type', downloadInfo.mimeType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'no-cache');

      // ファイルをストリーミング
      const fileStream = require('fs').createReadStream(downloadInfo.filePath);
      
      fileStream.on('error', (streamError: Error) => {
        logger.error('ファイルストリーミングエラー', {
          error: streamError,
          exportId,
          filePath: downloadInfo.filePath
        });
        
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'ファイルの読み込み中にエラーが発生しました'
          });
        }
      });

      fileStream.pipe(res);

      logger.info('エクスポートファイルダウンロード開始', {
        exportId,
        userId,
        fileName,
        fileSize: stats.size
      });

    } catch (error: any) {
      logger.error('エクスポートダウンロードエラー', {
        error,
        exportId: req.params['exportId'],
        userId: req.user?.id
      });

      const statusCode = error.statusCode || 500;
      
      if (!res.headersSent) {
        const response: ApiResponse = {
          success: false,
          error: error.message || 'エクスポートダウンロード中にエラーが発生しました'
        };
        res.status(statusCode).json(response);
      }
    }
  }

  /**
   * プロジェクトのエクスポート履歴取得
   * GET /api/projects/:projectId/exports
   */
  async getExportHistory(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params['projectId'];
      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'プロジェクトIDが指定されていません'
        });
        return;
      }

      const userId = req.user!.id;

      const exports = await exportService.getExportHistory(projectId, userId);

      const response: ApiResponse<Export[]> = {
        success: true,
        data: exports
      };

      res.json(response);
    } catch (error: any) {
      logger.error('エクスポート履歴取得エラー', {
        error,
        projectId: req.params['projectId'],
        userId: req.user?.id
      });

      const statusCode = error.statusCode || 500;
      const response: ApiResponse = {
        success: false,
        error: error.message || 'エクスポート履歴の取得中にエラーが発生しました'
      };

      res.status(statusCode).json(response);
    }
  }

  /**
   * エクスポートクリーンアップ
   * POST /api/export/cleanup (管理者用)
   */
  async cleanupExports(req: Request, res: Response): Promise<void> {
    try {
      await exportService.cleanupOldExports();

      const response: ApiResponse = {
        success: true
      };

      res.json(response);

      logger.info('エクスポートクリーンアップ実行', {
        userId: req.user?.id
      });
    } catch (error: any) {
      logger.error('エクスポートクリーンアップエラー', {
        error,
        userId: req.user?.id
      });

      const statusCode = error.statusCode || 500;
      const response: ApiResponse = {
        success: false,
        error: error.message || 'エクスポートクリーンアップ中にエラーが発生しました'
      };

      res.status(statusCode).json(response);
    }
  }

  /**
   * プライベートメソッド - ダウンロードファイル名生成
   */
  private generateDownloadFileName(exportRecord: Export): string {
    const timestamp = new Date(exportRecord.createdAt).toISOString().slice(0, 19).replace(/[:-]/g, '');
    const extension = exportRecord.format === 'zip' ? 'zip' : 'html';
    return `project_${exportRecord.projectId}_${timestamp}.${extension}`;
  }

}

// シングルトンインスタンスをエクスポート
export const exportController = new ExportController();