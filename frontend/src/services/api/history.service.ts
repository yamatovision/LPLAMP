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
  API_PATHS 
} from '@/types';

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