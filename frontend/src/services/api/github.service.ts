import { apiClient } from '../api-client';
import { 
  GitHubAuthStatus, 
  GitHubRepository, 
  GitHubPushRequest, 
  GitHubPushResponse,
  ApiResponse,
  API_PATHS 
} from '../../types';

export interface RepoCreateRequest {
  name: string;
  description?: string;
  private?: boolean;
}

export interface GitHubBranch {
  name: string;
  sha: string;
  protected: boolean;
}

export interface AuthInitiateResponse {
  authUrl: string;
}

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
   * GitHub認証の開始
   */
  async initiateAuth(scopes: string[] = ['repo']): Promise<string> {
    try {
      const response = await apiClient.post<ApiResponse<AuthInitiateResponse>>(
        API_PATHS.GITHUB.CONNECT,
        { scopes }
      );
      
      const apiResponse = response.data as unknown as ApiResponse<AuthInitiateResponse>;
      if (apiResponse?.success && apiResponse?.data) {
        return apiResponse.data.authUrl;
      }
      
      throw new Error(apiResponse?.error || 'GitHub認証開始に失敗しました');
    } catch (error: any) {
      console.error('GitHub認証開始エラー:', error);
      console.error('エラー詳細:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data
        }
      });
      throw new Error(error.message || 'GitHub認証の開始に失敗しました');
    }
  },

  /**
   * GitHubリポジトリ一覧取得
   */
  async getRepositories(): Promise<GitHubRepository[]> {
    try {
      const response = await apiClient.get<ApiResponse<{ repos: GitHubRepository[] }>>(
        API_PATHS.GITHUB.REPOS
      );
      
      const apiResponse = response.data as unknown as ApiResponse<{ repos: GitHubRepository[] }>;
      if (apiResponse?.success && apiResponse?.data) {
        return apiResponse.data.repos;
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
  async createRepository(repoData: RepoCreateRequest): Promise<GitHubRepository> {
    try {
      const response = await apiClient.post<ApiResponse<GitHubRepository>>(
        API_PATHS.GITHUB.REPOS_CREATE,
        repoData
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
   * リポジトリのブランチ一覧取得
   */
  async getBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    try {
      const response = await apiClient.get<ApiResponse<{ branches: GitHubBranch[] }>>(
        API_PATHS.GITHUB.BRANCHES(owner, repo)
      );
      
      const apiResponse = response.data as unknown as ApiResponse<{ branches: GitHubBranch[] }>;
      if (apiResponse?.success && apiResponse?.data) {
        return apiResponse.data.branches;
      }
      
      throw new Error(apiResponse?.error || 'ブランチ一覧の取得に失敗しました');
    } catch (error: any) {
      console.error('GitHubブランチ一覧取得エラー:', error);
      
      if (error.response?.status === 401) {
        throw new Error('GitHub認証が必要です');
      }
      
      if (error.response?.status === 404) {
        throw new Error('指定されたリポジトリが見つかりません');
      }
      
      throw new Error(error.message || 'ブランチ一覧の取得に失敗しました');
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

// 後方互換性のためのエクスポート
export const githubService = githubApiService;
export default githubApiService;