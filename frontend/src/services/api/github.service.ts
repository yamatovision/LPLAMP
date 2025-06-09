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
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      throw new Error(response.data.error || 'GitHub認証状態の取得に失敗しました');
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
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      throw new Error(response.data.error || 'リポジトリ一覧の取得に失敗しました');
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
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      throw new Error(response.data.error || 'リポジトリの作成に失敗しました');
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
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      throw new Error(response.data.error || 'GitHubへのプッシュに失敗しました');
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