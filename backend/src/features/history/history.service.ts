/**
 * 履歴管理 - サービス層
 * 
 * 編集履歴の保存、取得、復元のビジネスロジックを実装
 * プロジェクトとレプリカサービスと連携して履歴機能を提供
 */

import { 
  History, 
  HistoryType, 
  HistorySnapshot,
  ID,
  PaginatedResponse
} from '../../types';
import { historyModel } from './history.model';
import { projectRepository } from '../projects/projects.model';
import { replicaRepository } from '../replica/replica.model';
import { logger } from '../../common/utils/logger';

/**
 * サービス層エラー
 */
export class HistoryServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'HistoryServiceError';
  }
}

/**
 * 履歴未発見エラー
 */
export class HistoryNotFoundError extends HistoryServiceError {
  constructor(message: string = '履歴が見つかりません') {
    super(message, 'HISTORY_NOT_FOUND', 404);
  }
}

/**
 * プロジェクト未発見エラー
 */
export class ProjectNotFoundError extends HistoryServiceError {
  constructor(message: string = 'プロジェクトが見つかりません') {
    super(message, 'PROJECT_NOT_FOUND', 404);
  }
}

/**
 * レプリカ未発見エラー
 */
export class ReplicaNotFoundError extends HistoryServiceError {
  constructor(message: string = 'レプリカが見つかりません') {
    super(message, 'REPLICA_NOT_FOUND', 404);
  }
}

/**
 * 権限エラー
 */
export class HistoryAccessError extends HistoryServiceError {
  constructor(message: string = 'この履歴へのアクセス権限がありません') {
    super(message, 'ACCESS_DENIED', 403);
  }
}

/**
 * 履歴管理サービス
 */
export class HistoryService {
  /**
   * 履歴を作成
   */
  async createHistory(
    projectId: ID,
    userId: ID,
    description: string,
    snapshot: HistorySnapshot,
    type: HistoryType = HistoryType.EDIT
  ): Promise<History> {
    const start = Date.now();
    
    try {
      // プロジェクトの存在確認とアクセス権限チェック
      const project = await projectRepository.findById(projectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      if (project.userId !== userId) {
        throw new HistoryAccessError();
      }

      // 履歴を作成
      const history = await historyModel.create(
        projectId,
        description,
        snapshot,
        type
      );

      const duration = Date.now() - start;
      logger.info('履歴を作成しました', {
        historyId: history.id,
        projectId,
        userId,
        type,
        duration
      });

      return history;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('履歴作成中にエラーが発生しました', {
        error,
        projectId,
        userId,
        duration
      });
      throw error;
    }
  }

  /**
   * プロジェクトの履歴一覧を取得
   */
  async getHistoryList(
    projectId: ID,
    userId: ID,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<History>> {
    const start = Date.now();

    try {
      // プロジェクトの存在確認とアクセス権限チェック
      const project = await projectRepository.findById(projectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      if (project.userId !== userId) {
        throw new HistoryAccessError();
      }

      // ページネーション付きで履歴を取得
      const result = await historyModel.findWithPagination(projectId, page, limit);

      const duration = Date.now() - start;
      logger.info('履歴一覧を取得しました', {
        projectId,
        userId,
        page,
        limit,
        total: result.total,
        duration
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('履歴一覧取得中にエラーが発生しました', {
        error,
        projectId,
        userId,
        duration
      });
      throw error;
    }
  }

  /**
   * 特定の履歴を取得
   */
  async getHistory(
    projectId: ID,
    historyId: ID,
    userId: ID
  ): Promise<History> {
    const start = Date.now();

    try {
      // プロジェクトの存在確認とアクセス権限チェック
      const project = await projectRepository.findById(projectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      if (project.userId !== userId) {
        throw new HistoryAccessError();
      }

      // 履歴を取得
      const history = await historyModel.findById(projectId, historyId);
      if (!history) {
        throw new HistoryNotFoundError();
      }

      const duration = Date.now() - start;
      logger.info('履歴を取得しました', {
        historyId,
        projectId,
        userId,
        duration
      });

      return history;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('履歴取得中にエラーが発生しました', {
        error,
        historyId,
        projectId,
        userId,
        duration
      });
      throw error;
    }
  }

  /**
   * 履歴から復元
   */
  async restoreFromHistory(
    projectId: ID,
    historyId: ID,
    userId: ID
  ): Promise<History> {
    const start = Date.now();

    try {
      // プロジェクトの存在確認とアクセス権限チェック
      const project = await projectRepository.findById(projectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      if (project.userId !== userId) {
        throw new HistoryAccessError();
      }

      // 履歴を取得
      const history = await historyModel.findById(projectId, historyId);
      if (!history) {
        throw new HistoryNotFoundError();
      }

      // レプリカの存在確認
      const replica = await replicaRepository.findByProjectId(projectId);
      if (!replica) {
        throw new ReplicaNotFoundError();
      }

      // 復元前の状態を履歴として保存
      await this.createHistory(
        projectId,
        userId,
        `履歴ID: ${historyId} からの復元前の状態`,
        {
          html: replica.html,
          changedElements: []
        },
        HistoryType.REVERT
      );

      // レプリカを更新（スナップショットのHTMLで上書き）
      await replicaRepository.update(replica.id, { html: history.snapshot.html });

      // 復元後の履歴を作成
      const restoredHistory = await this.createHistory(
        projectId,
        userId,
        `履歴ID: ${historyId} から復元しました`,
        history.snapshot,
        HistoryType.REVERT
      );

      const duration = Date.now() - start;
      logger.info('履歴から復元しました', {
        historyId,
        projectId,
        userId,
        duration
      });

      return restoredHistory;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('履歴復元中にエラーが発生しました', {
        error,
        historyId,
        projectId,
        userId,
        duration
      });
      throw error;
    }
  }

  /**
   * プロジェクトの履歴を全て削除
   */
  async deleteProjectHistory(projectId: ID, userId: ID): Promise<void> {
    const start = Date.now();

    try {
      // プロジェクトの存在確認とアクセス権限チェック
      const project = await projectRepository.findById(projectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      if (project.userId !== userId) {
        throw new HistoryAccessError();
      }

      // 履歴を削除
      await historyModel.deleteByProjectId(projectId);

      const duration = Date.now() - start;
      logger.info('プロジェクトの履歴を削除しました', {
        projectId,
        userId,
        duration
      });
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('履歴削除中にエラーが発生しました', {
        error,
        projectId,
        userId,
        duration
      });
      throw error;
    }
  }

  /**
   * 最新の履歴を取得
   */
  async getLatestHistory(projectId: ID, userId: ID): Promise<History | null> {
    const start = Date.now();

    try {
      // プロジェクトの存在確認とアクセス権限チェック
      const project = await projectRepository.findById(projectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      if (project.userId !== userId) {
        throw new HistoryAccessError();
      }

      // 最新の履歴を取得
      const history = await historyModel.findLatest(projectId);

      const duration = Date.now() - start;
      logger.info('最新の履歴を取得しました', {
        projectId,
        userId,
        hasHistory: !!history,
        duration
      });

      return history;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('最新履歴取得中にエラーが発生しました', {
        error,
        projectId,
        userId,
        duration
      });
      throw error;
    }
  }
}

// シングルトンインスタンスをエクスポート
export const historyService = new HistoryService();