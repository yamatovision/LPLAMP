import { apiClient } from '../api-client';
import { 
  DeployRequest, 
  DeployResponse, 
  DeploymentDetail,
  DeploymentStatus,
  PaginatedResponse,
  PaginationParams,
  ApiResponse,
  API_PATHS,
  ID 
} from '../../types';

/**
 * デプロイメントAPIサービス
 * バックエンドのデプロイメントエンドポイントと連携
 */
export const deployApiService = {
  /**
   * デプロイメント開始
   */
  async triggerDeploy(deployData: DeployRequest): Promise<DeployResponse> {
    try {
      const response = await apiClient.post<ApiResponse<DeployResponse>>(
        API_PATHS.DEPLOY.TRIGGER,
        deployData
      );
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      throw new Error(response.data.error || 'デプロイメントの開始に失敗しました');
    } catch (error: any) {
      console.error('デプロイメント開始エラー:', error);
      
      if (error.response?.status === 401) {
        throw new Error('認証が必要です');
      }
      
      if (error.response?.status === 400) {
        throw new Error('デプロイメント設定が無効です');
      }
      
      if (error.response?.status === 404) {
        throw new Error('指定されたリポジトリが見つかりません');
      }
      
      throw new Error(error.message || 'デプロイメントの開始に失敗しました');
    }
  },

  /**
   * デプロイメントステータス確認
   */
  async getDeploymentStatus(deploymentId: ID): Promise<DeploymentDetail> {
    try {
      const response = await apiClient.get<ApiResponse<DeploymentDetail>>(
        API_PATHS.DEPLOY.STATUS(deploymentId)
      );
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      throw new Error(response.data.error || 'デプロイメントステータスの取得に失敗しました');
    } catch (error: any) {
      console.error('デプロイメントステータス確認エラー:', error);
      
      if (error.response?.status === 401) {
        throw new Error('認証が必要です');
      }
      
      if (error.response?.status === 404) {
        throw new Error('指定されたデプロイメントが見つかりません');
      }
      
      throw new Error(error.message || 'デプロイメントステータスの取得に失敗しました');
    }
  },

  /**
   * デプロイメントログ取得
   */
  async getDeploymentLogs(deploymentId: ID): Promise<string[]> {
    try {
      const response = await apiClient.get<ApiResponse<{ logs: string[] }>>(
        `${API_PATHS.DEPLOY.STATUS(deploymentId)}/logs`
      );
      
      if (response.data.success && response.data.data) {
        return response.data.data.logs;
      }
      
      throw new Error(response.data.error || 'デプロイメントログの取得に失敗しました');
    } catch (error: any) {
      console.error('デプロイメントログ取得エラー:', error);
      
      if (error.response?.status === 401) {
        throw new Error('認証が必要です');
      }
      
      if (error.response?.status === 404) {
        throw new Error('指定されたデプロイメントまたはログが見つかりません');
      }
      
      throw new Error(error.message || 'デプロイメントログの取得に失敗しました');
    }
  },

  /**
   * プロジェクトのデプロイメント一覧取得
   */
  async getProjectDeployments(
    projectId: ID, 
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<DeploymentDetail>> {
    try {
      const params = pagination ? {
        page: pagination.page,
        limit: pagination.limit
      } : {};

      const response = await apiClient.get<ApiResponse<PaginatedResponse<DeploymentDetail>>>(
        API_PATHS.DEPLOY.LIST(projectId),
        { params }
      );
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      throw new Error(response.data.error || 'デプロイメント一覧の取得に失敗しました');
    } catch (error: any) {
      console.error('デプロイメント一覧取得エラー:', error);
      
      if (error.response?.status === 401) {
        throw new Error('認証が必要です');
      }
      
      if (error.response?.status === 404) {
        throw new Error('指定されたプロジェクトが見つかりません');
      }
      
      throw new Error(error.message || 'デプロイメント一覧の取得に失敗しました');
    }
  },

  /**
   * デプロイメントの削除/キャンセル
   */
  async cancelDeployment(deploymentId: ID): Promise<boolean> {
    try {
      const response = await apiClient.delete<ApiResponse<{ cancelled: boolean }>>(
        API_PATHS.DEPLOY.STATUS(deploymentId)
      );
      
      if (response.data.success && response.data.data) {
        return response.data.data.cancelled;
      }
      
      throw new Error(response.data.error || 'デプロイメントのキャンセルに失敗しました');
    } catch (error: any) {
      console.error('デプロイメントキャンセルエラー:', error);
      
      if (error.response?.status === 401) {
        throw new Error('認証が必要です');
      }
      
      if (error.response?.status === 404) {
        throw new Error('指定されたデプロイメントが見つかりません');
      }
      
      if (error.response?.status === 409) {
        throw new Error('このデプロイメントはキャンセルできません');
      }
      
      throw new Error(error.message || 'デプロイメントのキャンセルに失敗しました');
    }
  },

  /**
   * デプロイメントステータスのポーリング
   * 完了するまで定期的にステータスを確認
   */
  async pollDeploymentStatus(
    deploymentId: ID, 
    onStatusChange?: (status: DeploymentStatus) => void,
    maxAttempts = 60,
    intervalMs = 5000
  ): Promise<DeploymentDetail> {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const deployment = await this.getDeploymentStatus(deploymentId);
        
        onStatusChange?.(deployment.status);
        
        // 完了状態の場合は結果を返す
        if (deployment.status === DeploymentStatus.READY || 
            deployment.status === DeploymentStatus.ERROR) {
          return deployment;
        }
        
        // まだ進行中の場合は待機
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        attempts++;
        
      } catch (error) {
        console.error(`ポーリング試行 ${attempts + 1} でエラー:`, error);
        attempts++;
        
        if (attempts >= maxAttempts) {
          throw error;
        }
        
        // エラーが発生した場合も少し待機してリトライ
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
    
    throw new Error('デプロイメントステータスの確認がタイムアウトしました');
  }
};