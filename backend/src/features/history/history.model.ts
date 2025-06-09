import { ID, History, HistoryType, HistorySnapshot } from '../../types';
import { logger } from '../../common/utils/logger';

// メモリストア（実装の最初の段階として使用）
// TODO: 将来的にデータベースに移行
interface HistoryStore {
  [projectId: string]: History[];
}

class HistoryModel {
  private store: HistoryStore = {};
  private historyIdCounter = 0;

  /**
   * 新しい履歴を作成
   */
  async create(
    projectId: ID,
    description: string,
    snapshot: HistorySnapshot,
    type: HistoryType = HistoryType.EDIT
  ): Promise<History> {
    const now = new Date().toISOString();
    const historyId = `history_${++this.historyIdCounter}`;

    const history: History = {
      id: historyId,
      projectId,
      description,
      snapshot,
      type,
      createdAt: now,
      updatedAt: now
    };

    // プロジェクトの履歴配列を初期化（必要な場合）
    if (!this.store[projectId]) {
      this.store[projectId] = [];
    }

    // 履歴を追加
    this.store[projectId].push(history);

    logger.info('履歴を作成しました', {
      historyId,
      projectId,
      type,
      description
    });

    return history;
  }

  /**
   * 変更情報付きで新しい履歴を作成
   */
  async createWithChanges(
    projectId: ID,
    description: string,
    snapshot: HistorySnapshot,
    type: HistoryType = HistoryType.EDIT,
    changes?: any
  ): Promise<History> {
    const now = new Date().toISOString();
    const historyId = `history_${++this.historyIdCounter}`;

    const history: History = {
      id: historyId,
      projectId,
      description,
      snapshot,
      type,
      createdAt: now,
      updatedAt: now,
      changes: changes
    };

    // プロジェクトの履歴配列を初期化（必要な場合）
    if (!this.store[projectId]) {
      this.store[projectId] = [];
    }

    // 履歴を追加
    this.store[projectId].push(history);

    logger.info('履歴を作成しました（変更情報付き）', {
      historyId,
      projectId,
      type,
      description,
      hasChanges: !!changes
    });

    return history;
  }

  /**
   * プロジェクトの履歴一覧を取得
   */
  async findByProjectId(projectId: ID): Promise<History[]> {
    const histories = this.store[projectId] || [];
    
    logger.info('履歴一覧を取得しました', {
      projectId,
      count: histories.length
    });

    // 新しい順にソートして返す
    return histories.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * 特定の履歴を取得
   */
  async findById(projectId: ID, historyId: ID): Promise<History | null> {
    const histories = this.store[projectId] || [];
    const history = histories.find(h => h.id === historyId);

    if (history) {
      logger.info('履歴を取得しました', {
        historyId,
        projectId
      });
    } else {
      logger.warn('履歴が見つかりませんでした', {
        historyId,
        projectId
      });
    }

    return history || null;
  }

  /**
   * プロジェクトに関連する全ての履歴を削除
   */
  async deleteByProjectId(projectId: ID): Promise<void> {
    const count = this.store[projectId]?.length || 0;
    delete this.store[projectId];

    logger.info('プロジェクトの履歴を削除しました', {
      projectId,
      deletedCount: count
    });
  }

  /**
   * 最新の履歴を取得
   */
  async findLatest(projectId: ID): Promise<History | null> {
    const histories = await this.findByProjectId(projectId);
    return histories.length > 0 ? histories[0]! : null;
  }

  /**
   * 履歴の総数を取得
   */
  async count(projectId: ID): Promise<number> {
    return this.store[projectId]?.length || 0;
  }

  /**
   * 特定のタイプの履歴を取得
   */
  async findByType(projectId: ID, type: HistoryType): Promise<History[]> {
    const histories = this.store[projectId] || [];
    return histories.filter(h => h.type === type);
  }

  /**
   * ページネーション付きで履歴を取得
   */
  async findWithPagination(
    projectId: ID,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    items: History[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const histories = await this.findByProjectId(projectId);
    const total = histories.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const items = histories.slice(start, end);
    const hasMore = end < total;

    logger.info('ページネーション付き履歴を取得しました', {
      projectId,
      page,
      limit,
      total,
      itemsCount: items.length
    });

    return {
      items,
      total,
      page,
      limit,
      hasMore
    };
  }
}

// シングルトンインスタンスをエクスポート
export const historyModel = new HistoryModel();