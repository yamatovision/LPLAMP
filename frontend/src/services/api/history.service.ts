/**
 * 履歴管理 API サービス
 * 
 * 履歴関連のAPI呼び出しを実装
 */

import { apiClient } from '../api-client';
import { 
  History, 
  HistoryType, 
  HistorySnapshot,
  PaginatedResponse,
  ApiResponse,
  API_PATHS,
  ID,
  EditChanges 
} from '@/types';
import { logger } from '@/utils/logger';

/**
 * 履歴作成リクエスト
 */
interface CreateHistoryRequest {
  description: string;
  snapshot: HistorySnapshot;
  type?: HistoryType;
}

/**
 * 履歴復元レスポンス
 */
interface RestoreHistoryResponse {
  success: boolean;
  message: string;
}

/**
 * 履歴管理APIサービス
 */
export const historyApiService = {
  /**
   * 編集履歴の保存
   */
  async createHistory(
    projectId: string, 
    data: CreateHistoryRequest
  ): Promise<ApiResponse<History>> {
    const response = await apiClient.post<ApiResponse<History>>(
      API_PATHS.HISTORY.LIST(projectId),
      data
    );
    return response;
  },

  /**
   * 編集履歴一覧の取得
   */
  async getHistoryList(
    projectId: string,
    page = 1,
    limit = 20
  ): Promise<ApiResponse<PaginatedResponse<History>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<History>>>(
      API_PATHS.HISTORY.LIST(projectId),
      {
        params: { page, limit }
      }
    );
    return response;
  },

  /**
   * 特定履歴の詳細取得
   */
  async getHistory(
    projectId: string,
    historyId: string
  ): Promise<ApiResponse<History>> {
    const response = await apiClient.get<ApiResponse<History>>(
      API_PATHS.HISTORY.DETAIL(projectId, historyId)
    );
    return response;
  },

  /**
   * 履歴からの復元
   */
  async restoreFromHistory(
    projectId: string,
    historyId: string
  ): Promise<ApiResponse<RestoreHistoryResponse>> {
    const response = await apiClient.post<ApiResponse<RestoreHistoryResponse>>(
      API_PATHS.HISTORY.RESTORE(projectId, historyId)
    );
    return response;
  }
};

/**
 * 自動保存サービスクラス（フロントエンド側）
 */
export class AutoSaveService {
  /**
   * 自動保存のスケジュール（デバウンス付き）
   */
  async scheduleAutoSave(projectId: ID, changes: EditChanges): Promise<void> {
    try {
      logger.debug('自動保存スケジュール開始', { 
        projectId, 
        changedFileCount: changes.changedFiles.length 
      });

      // バックエンドの自動保存エンドポイントを呼び出し
      // 実際の実装では、WebSocket経由でバックエンドのAutoSaveServiceに送信
      await this.sendAutoSaveRequest(projectId, changes, false);

      logger.info('自動保存スケジュール完了', { projectId });
    } catch (error) {
      logger.error('自動保存スケジュールエラー', { 
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 明示的保存（Ctrl+S等）
   */
  async explicitSave(projectId: ID, changes: EditChanges): Promise<void> {
    try {
      logger.info('明示的保存開始', { projectId });

      // バックエンドの明示的保存エンドポイントを呼び出し
      await this.sendAutoSaveRequest(projectId, changes, true);

      logger.info('明示的保存完了', { projectId });
    } catch (error) {
      logger.error('明示的保存エラー', { 
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 自動保存リクエストの送信
   */
  private async sendAutoSaveRequest(
    projectId: ID, 
    changes: EditChanges, 
    isExplicit: boolean
  ): Promise<void> {
    try {
      // TODO: 実際の実装では以下のいずれかの方法でバックエンドと連携
      // 1. WebSocket経由でリアルタイム送信
      // 2. 専用のREST APIエンドポイント
      // 3. バックグラウンドタスクキューへの追加

      // 仮実装：REST APIエンドポイント経由
      const endpoint = isExplicit 
        ? `/api/projects/${projectId}/save/explicit`
        : `/api/projects/${projectId}/save/auto`;

      await apiClient.post(endpoint, {
        changes,
        timestamp: new Date().toISOString()
      });

      logger.debug('自動保存リクエスト送信完了', { 
        projectId, 
        isExplicit,
        endpoint 
      });

    } catch (error) {
      logger.error('自動保存リクエスト送信エラー', { 
        projectId, 
        isExplicit,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

/**
 * 自動保存サービスインスタンス
 */
export const autoSaveService = new AutoSaveService();