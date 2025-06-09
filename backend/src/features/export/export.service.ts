/**
 * エクスポート機能 - サービス層
 * 
 * プロジェクトファイルの最適化、パッケージング、ダウンロード準備のビジネスロジックを実装
 * プロジェクトとレプリカサービスと連携してエクスポート機能を提供
 */

import { 
  Export, 
  ExportFormat, 
  ExportPrepareRequest,
  ExportPrepareResponse,
  FileInfo,
  ID
} from '../../types';
import { exportModel } from './export.model';
import { projectRepository } from '../projects/projects.model';
import { replicaRepository } from '../replica/replica.model';
import { logger } from '../../common/utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import archiver from 'archiver';
import { createWriteStream } from 'fs';

/**
 * サービス層エラー
 */
export class ExportServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ExportServiceError';
  }
}

/**
 * プロジェクト未発見エラー
 */
export class ProjectNotFoundError extends ExportServiceError {
  constructor(message: string = 'プロジェクトが見つかりません') {
    super(message, 'PROJECT_NOT_FOUND', 404);
  }
}

/**
 * レプリカ未発見エラー
 */
export class ReplicaNotFoundError extends ExportServiceError {
  constructor(message: string = 'レプリカが見つかりません') {
    super(message, 'REPLICA_NOT_FOUND', 404);
  }
}

/**
 * エクスポート未発見エラー
 */
export class ExportNotFoundError extends ExportServiceError {
  constructor(message: string = 'エクスポートが見つかりません') {
    super(message, 'EXPORT_NOT_FOUND', 404);
  }
}

/**
 * 権限エラー
 */
export class ExportAccessError extends ExportServiceError {
  constructor(message: string = 'このプロジェクトへのアクセス権限がありません') {
    super(message, 'ACCESS_DENIED', 403);
  }
}

/**
 * ファイル処理エラー
 */
export class FileProcessingError extends ExportServiceError {
  constructor(message: string = 'ファイル処理中にエラーが発生しました') {
    super(message, 'FILE_PROCESSING_ERROR', 500);
  }
}

/**
 * エクスポート管理サービス
 */
export class ExportService {
  private tempDir: string;

  constructor() {
    this.tempDir = process.env['TEMP_DIR'] || '/tmp/lplamp';
  }

  /**
   * エクスポート準備
   */
  async prepareExport(
    request: ExportPrepareRequest,
    userId: ID
  ): Promise<ExportPrepareResponse> {
    const start = Date.now();
    
    try {
      // プロジェクトの存在確認とアクセス権限チェック
      const project = await projectRepository.findById(request.projectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      if (project.userId !== userId) {
        throw new ExportAccessError();
      }

      // レプリカの存在確認
      const replica = await replicaRepository.findByProjectId(request.projectId);
      if (!replica) {
        throw new ReplicaNotFoundError();
      }

      // ファイルを準備
      const files = await this.prepareFiles(
        request.projectId,
        replica,
        request.format,
        request.optimize
      );

      // エクスポートレコードを作成
      const exportRecord = await exportModel.create(
        request.projectId,
        request.format,
        files
      );

      const duration = Date.now() - start;
      logger.info('エクスポート準備が完了しました', {
        exportId: exportRecord.id,
        projectId: request.projectId,
        userId,
        format: request.format,
        filesCount: files.length,
        duration
      });

      return {
        exportId: exportRecord.id,
        files
      };
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('エクスポート準備中にエラーが発生しました', {
        error,
        projectId: request.projectId,
        userId,
        duration
      });
      throw error;
    }
  }

  /**
   * エクスポートファイルのダウンロード
   */
  async getExportDownload(exportId: ID, userId: ID): Promise<{
    export: Export;
    filePath: string;
    mimeType: string;
  }> {
    const start = Date.now();

    try {
      // エクスポートの存在確認
      const exportRecord = await exportModel.findById(exportId);
      if (!exportRecord) {
        throw new ExportNotFoundError();
      }

      // プロジェクトのアクセス権限チェック
      const project = await projectRepository.findById(exportRecord.projectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      if (project.userId !== userId) {
        throw new ExportAccessError();
      }

      // ファイルパスを構築
      const fileName = this.getExportFileName(exportRecord);
      const filePath = path.join(this.tempDir, 'exports', fileName);

      // ファイルの存在確認
      try {
        await fs.access(filePath);
      } catch {
        // ファイルが存在しない場合は再生成
        await this.regenerateExportFile(exportRecord, filePath);
      }

      const mimeType = this.getMimeType(exportRecord.format);

      const duration = Date.now() - start;
      logger.info('エクスポートダウンロード準備が完了しました', {
        exportId,
        projectId: exportRecord.projectId,
        userId,
        filePath,
        duration
      });

      return {
        export: exportRecord,
        filePath,
        mimeType
      };
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('エクスポートダウンロード準備中にエラーが発生しました', {
        error,
        exportId,
        userId,
        duration
      });
      throw error;
    }
  }

  /**
   * プロジェクトのエクスポート履歴を取得
   */
  async getExportHistory(projectId: ID, userId: ID): Promise<Export[]> {
    const start = Date.now();

    try {
      // プロジェクトの存在確認とアクセス権限チェック
      const project = await projectRepository.findById(projectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      if (project.userId !== userId) {
        throw new ExportAccessError();
      }

      // エクスポート履歴を取得
      const exports = await exportModel.findByProjectId(projectId);

      const duration = Date.now() - start;
      logger.info('エクスポート履歴を取得しました', {
        projectId,
        userId,
        count: exports.length,
        duration
      });

      return exports;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('エクスポート履歴取得中にエラーが発生しました', {
        error,
        projectId,
        userId,
        duration
      });
      throw error;
    }
  }

  /**
   * プライベートメソッド - ファイル準備
   */
  private async prepareFiles(
    projectId: ID,
    replica: any,
    format: ExportFormat,
    optimize: boolean
  ): Promise<FileInfo[]> {
    const files: FileInfo[] = [];

    try {
      // 一時ディレクトリを作成
      const exportDir = path.join(this.tempDir, 'exports');
      await fs.mkdir(exportDir, { recursive: true });

      if (format === ExportFormat.HTML) {
        // HTML形式の場合
        const htmlContent = optimize ? 
          await this.optimizeHtml(replica.html) : 
          replica.html;

        const htmlFile = path.join(exportDir, `${projectId}.html`);
        await fs.writeFile(htmlFile, htmlContent, 'utf8');

        files.push({
          path: 'index.html',
          size: Buffer.byteLength(htmlContent, 'utf8'),
          mimeType: 'text/html'
        });

        // CSSファイルも含める場合
        if (replica.css) {
          const cssContent = optimize ? 
            await this.optimizeCss(replica.css) : 
            replica.css;

          const cssFile = path.join(exportDir, `${projectId}.css`);
          await fs.writeFile(cssFile, cssContent, 'utf8');

          files.push({
            path: 'style.css',
            size: Buffer.byteLength(cssContent, 'utf8'),
            mimeType: 'text/css'
          });
        }
      } else if (format === ExportFormat.ZIP) {
        // ZIP形式の場合
        const zipFile = path.join(exportDir, `${projectId}.zip`);
        await this.createZipFile(projectId, replica, zipFile, optimize);

        const stats = await fs.stat(zipFile);
        files.push({
          path: `${projectId}.zip`,
          size: stats.size,
          mimeType: 'application/zip'
        });
      }

      logger.info('ファイル準備が完了しました', {
        projectId,
        format,
        filesCount: files.length
      });

      return files;
    } catch (error) {
      logger.error('ファイル準備中にエラーが発生しました', {
        error,
        projectId,
        format
      });
      throw new FileProcessingError();
    }
  }

  /**
   * HTMLの最適化
   */
  private async optimizeHtml(html: string): Promise<string> {
    // 簡単な最適化処理（コメント削除、空白圧縮など）
    return html
      .replace(/<!--[\s\S]*?-->/g, '') // コメント削除
      .replace(/\s+/g, ' ') // 連続する空白を1つにまとめる
      .trim();
  }

  /**
   * CSSの最適化
   */
  private async optimizeCss(css: string): Promise<string> {
    // 簡単な最適化処理
    return css
      .replace(/\/\*[\s\S]*?\*\//g, '') // コメント削除
      .replace(/\s+/g, ' ') // 連続する空白を1つにまとめる
      .replace(/;\s*}/g, '}') // 最後のセミコロンを削除
      .trim();
  }

  /**
   * ZIPファイル作成
   */
  private async createZipFile(
    projectId: ID,
    replica: any,
    zipPath: string,
    optimize: boolean
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // 最高圧縮レベル
      });

      output.on('close', () => {
        logger.info('ZIPファイル作成完了', {
          projectId,
          size: archive.pointer()
        });
        resolve();
      });

      archive.on('error', (err: Error) => {
        logger.error('ZIPファイル作成エラー', { error: err, projectId });
        reject(err);
      });

      archive.pipe(output);

      // HTMLファイルを追加
      const htmlContent = optimize ? 
        this.optimizeHtml(replica.html) : 
        replica.html;
      archive.append(htmlContent, { name: 'index.html' });

      // CSSファイルを追加
      if (replica.css) {
        const cssContent = optimize ? 
          this.optimizeCss(replica.css) : 
          replica.css;
        archive.append(cssContent, { name: 'style.css' });
      }

      // アセットファイルを追加（必要に応じて）
      if (replica.assets && Array.isArray(replica.assets)) {
        for (const asset of replica.assets) {
          // アセットファイルの処理（実装簡略化）
          logger.info('アセット追加', { asset: asset.localPath });
        }
      }

      archive.finalize();
    });
  }

  /**
   * エクスポートファイル名を生成
   */
  private getExportFileName(exportRecord: Export): string {
    const timestamp = new Date(exportRecord.createdAt).toISOString().slice(0, 10);
    const extension = exportRecord.format === ExportFormat.ZIP ? 'zip' : 'html';
    return `${exportRecord.projectId}_${timestamp}_${exportRecord.id}.${extension}`;
  }

  /**
   * MIMEタイプを取得
   */
  private getMimeType(format: ExportFormat): string {
    switch (format) {
      case ExportFormat.HTML:
        return 'text/html';
      case ExportFormat.ZIP:
        return 'application/zip';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * エクスポートファイルを再生成
   */
  private async regenerateExportFile(exportRecord: Export, filePath: string): Promise<void> {
    logger.info('エクスポートファイルを再生成します', {
      exportId: exportRecord.id,
      filePath
    });

    // レプリカを取得
    const replica = await replicaRepository.findByProjectId(exportRecord.projectId);
    if (!replica) {
      throw new ReplicaNotFoundError();
    }

    // ディレクトリを作成
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    if (exportRecord.format === ExportFormat.ZIP) {
      await this.createZipFile(exportRecord.projectId, replica, filePath, true);
    } else {
      // HTML形式
      const htmlContent = await this.optimizeHtml(replica.html);
      await fs.writeFile(filePath, htmlContent, 'utf8');
    }

    logger.info('エクスポートファイル再生成完了', {
      exportId: exportRecord.id,
      filePath
    });
  }

  /**
   * 古いエクスポートファイルのクリーンアップ
   */
  async cleanupOldExports(): Promise<void> {
    try {
      await exportModel.cleanup();
      
      // ファイルシステムのクリーンアップも実行
      const exportDir = path.join(this.tempDir, 'exports');
      try {
        const files = await fs.readdir(exportDir);
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

        for (const file of files) {
          const filePath = path.join(exportDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() < oneWeekAgo) {
            await fs.unlink(filePath);
            logger.info('古いエクスポートファイルを削除しました', { filePath });
          }
        }
      } catch (error) {
        logger.warn('エクスポートディレクトリのクリーンアップ中にエラー', { error });
      }

      logger.info('エクスポートクリーンアップ完了');
    } catch (error) {
      logger.error('エクスポートクリーンアップ中にエラーが発生しました', { error });
      throw error;
    }
  }
}

// シングルトンインスタンスをエクスポート
export const exportService = new ExportService();