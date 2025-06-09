import { ID, Export, ExportFormat, FileInfo } from '../../types';
import { logger } from '../../common/utils/logger';

interface ExportStore {
  [exportId: string]: Export;
}

interface ExportFilesStore {
  [exportId: string]: FileInfo[];
}

class ExportModel {
  private store: ExportStore = {};
  private filesStore: ExportFilesStore = {};
  private exportIdCounter = 0;

  /**
   * 新しいエクスポートを作成
   */
  async create(
    projectId: ID,
    format: ExportFormat,
    files: FileInfo[]
  ): Promise<Export> {
    const now = new Date().toISOString();
    const exportId = `export_${++this.exportIdCounter}`;

    const exportRecord: Export = {
      id: exportId,
      projectId,
      format,
      url: `/api/export/${exportId}/download`,
      createdAt: now,
      updatedAt: now
    };

    this.store[exportId] = exportRecord;
    this.filesStore[exportId] = files;

    logger.info('エクスポートを作成しました', {
      exportId,
      projectId,
      format,
      filesCount: files.length
    });

    return exportRecord;
  }

  /**
   * エクスポートIDで検索
   */
  async findById(exportId: ID): Promise<Export | null> {
    const exportRecord = this.store[exportId];
    
    if (exportRecord) {
      logger.info('エクスポートを取得しました', {
        exportId,
        projectId: exportRecord.projectId
      });
    } else {
      logger.warn('エクスポートが見つかりませんでした', {
        exportId
      });
    }

    return exportRecord || null;
  }

  /**
   * エクスポートのファイル一覧を取得
   */
  async getFiles(exportId: ID): Promise<FileInfo[]> {
    const files = this.filesStore[exportId] || [];
    
    logger.info('エクスポートファイル一覧を取得しました', {
      exportId,
      filesCount: files.length
    });

    return files;
  }

  /**
   * エクスポートのファイル情報を更新
   */
  async updateFiles(exportId: ID, files: FileInfo[]): Promise<void> {
    if (!this.store[exportId]) {
      throw new Error('エクスポートが見つかりません');
    }

    this.filesStore[exportId] = files;
    this.store[exportId].updatedAt = new Date().toISOString();

    logger.info('エクスポートファイル情報を更新しました', {
      exportId,
      filesCount: files.length
    });
  }

  /**
   * プロジェクトのエクスポート履歴を取得
   */
  async findByProjectId(projectId: ID): Promise<Export[]> {
    const exports = Object.values(this.store)
      .filter(exp => exp.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    logger.info('プロジェクトのエクスポート履歴を取得しました', {
      projectId,
      count: exports.length
    });

    return exports;
  }

  /**
   * エクスポートを削除
   */
  async delete(exportId: ID): Promise<void> {
    const exportRecord = this.store[exportId];
    if (exportRecord) {
      delete this.store[exportId];
      delete this.filesStore[exportId];

      logger.info('エクスポートを削除しました', {
        exportId,
        projectId: exportRecord.projectId
      });
    }
  }

  /**
   * プロジェクトに関連する全てのエクスポートを削除
   */
  async deleteByProjectId(projectId: ID): Promise<void> {
    const exports = await this.findByProjectId(projectId);
    let deletedCount = 0;

    for (const exp of exports) {
      delete this.store[exp.id];
      delete this.filesStore[exp.id];
      deletedCount++;
    }

    logger.info('プロジェクトのエクスポートを削除しました', {
      projectId,
      deletedCount
    });
  }

  /**
   * 古いエクスポートをクリーンアップ（1週間経過したもの）
   */
  async cleanup(): Promise<void> {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const [exportId, exportRecord] of Object.entries(this.store)) {
      if (new Date(exportRecord.createdAt) < oneWeekAgo) {
        delete this.store[exportId];
        delete this.filesStore[exportId];
        deletedCount++;
      }
    }

    logger.info('古いエクスポートをクリーンアップしました', {
      deletedCount
    });
  }

  /**
   * エクスポートの総数を取得
   */
  async count(): Promise<number> {
    return Object.keys(this.store).length;
  }

  /**
   * プロジェクトのエクスポート総数を取得
   */
  async countByProjectId(projectId: ID): Promise<number> {
    const exports = await this.findByProjectId(projectId);
    return exports.length;
  }
}

export const exportModel = new ExportModel();