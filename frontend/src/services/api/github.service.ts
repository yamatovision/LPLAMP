import { apiClient } from '../api-client';
import { 
  GitHubAuthStatus, 
  GitHubRepository, 
  GitHubPushRequest, 
  GitHubPushResponse,
  ApiResponse,
  API_PATHS 
} from '../../types';

/**
 * GitHub連携APIサービス
 * バックエンドのGitHub APIエンドポイントと連携
 */
export const githubApiService = {
  /**
   * GitHub認証状態確認
   */
  async getAuthStatus(): Promise<GitHubAuthStatus> {
    try {
      const response = await apiClient.get<ApiResponse<GitHubAuthStatus>>(
        API_PATHS.GITHUB.AUTH_STATUS
      );
      
      const apiResponse = response.data as unknown as ApiResponse<GitHubAuthStatus>;
      if (apiResponse?.success && apiResponse?.data) {
        return apiResponse.data;
      }
      
      throw new Error(apiResponse?.error || 'GitHub認証状態の取得に失敗しました');
    } catch (error: any) {
      console.error('GitHub認証状態確認エラー:', error);
      
      if (error.response?.status === 401) {
        throw new Error('認証が必要です');
      }
      
      throw new Error(error.message || 'GitHub認証状態の確認に失敗しました');
    }
  },

  /**
   * GitHubリポジトリ一覧取得
   */
  async getRepositories(): Promise<GitHubRepository[]> {
    try {
      const response = await apiClient.get<ApiResponse<GitHubRepository[]>>(
        API_PATHS.GITHUB.REPOS
      );
      
      const apiResponse = response.data as unknown as ApiResponse<GitHubRepository[]>;
      if (apiResponse?.success && apiResponse?.data) {
        return apiResponse.data;
      }
      
      throw new Error(apiResponse?.error || 'リポジトリ一覧の取得に失敗しました');
    } catch (error: any) {
      console.error('GitHubリポジトリ一覧取得エラー:', error);
      
      if (error.response?.status === 401) {
        throw new Error('GitHub認証が必要です');
      }
      
      if (error.response?.status === 403) {
        throw new Error('GitHub APIのレート制限に達しました。しばらく待ってから再試行してください');
      }
      
      throw new Error(error.message || 'リポジトリ一覧の取得に失敗しました');
    }
  },

  /**
   * 新規GitHubリポジトリ作成
   */
  async createRepository(name: string, isPrivate = false): Promise<GitHubRepository> {
    try {
      const response = await apiClient.post<ApiResponse<GitHubRepository>>(
        API_PATHS.GITHUB.REPOS_CREATE,
        {
          name,
          private: isPrivate,
          description: `LPlamp project: ${name}`
        }
      );
      
      const apiResponse = response.data as unknown as ApiResponse<GitHubRepository>;
      if (apiResponse?.success && apiResponse?.data) {
        return apiResponse.data;
      }
      
      throw new Error(apiResponse?.error || 'リポジトリの作成に失敗しました');
    } catch (error: any) {
      console.error('GitHubリポジトリ作成エラー:', error);
      
      if (error.response?.status === 401) {
        throw new Error('GitHub認証が必要です');
      }
      
      if (error.response?.status === 403) {
        throw new Error('リポジトリの作成権限がありません');
      }
      
      if (error.response?.status === 422) {
        throw new Error('同名のリポジトリが既に存在します');
      }
      
      throw new Error(error.message || 'リポジトリの作成に失敗しました');
    }
  },

  /**
   * GitHubへファイルプッシュ
   */
  async pushToRepository(pushData: GitHubPushRequest): Promise<GitHubPushResponse> {
    try {
      const response = await apiClient.post<ApiResponse<GitHubPushResponse>>(
        API_PATHS.GITHUB.PUSH,
        pushData
      );
      
      const apiResponse = response.data as unknown as ApiResponse<GitHubPushResponse>;
      if (apiResponse?.success && apiResponse?.data) {
        return apiResponse.data;
      }
      
      throw new Error(apiResponse?.error || 'GitHubへのプッシュに失敗しました');
    } catch (error: any) {
      console.error('GitHubプッシュエラー:', error);
      
      if (error.response?.status === 401) {
        throw new Error('GitHub認証が必要です');
      }
      
      if (error.response?.status === 403) {
        throw new Error('リポジトリへの書き込み権限がありません');
      }
      
      if (error.response?.status === 404) {
        throw new Error('指定されたリポジトリまたはエクスポートIDが見つかりません');
      }
      
      throw new Error(error.message || 'GitHubへのプッシュに失敗しました');
    }
  }
};