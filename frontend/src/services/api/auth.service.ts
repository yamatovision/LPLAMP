import { AuthStatusResponse, LoginResponse, API_PATHS } from '@/types';
import { apiClient } from '../api-client';

export const authApiService = {
  async getAuthStatus(): Promise<AuthStatusResponse> {
    return apiClient.get<AuthStatusResponse>(API_PATHS.AUTH.STATUS);
  },

  async login(): Promise<LoginResponse> {
    // GitHub OAuth ログインを開始
    window.location.href = `${import.meta.env.VITE_BACKEND_URL}${API_PATHS.AUTH.GITHUB_LOGIN}`;
    
    // ダミーのレスポンスを返す（実際にはリダイレクトされるため、この値は使用されない）
    return { redirectUrl: `${import.meta.env.VITE_BACKEND_URL}${API_PATHS.AUTH.GITHUB_LOGIN}` };
  },

  async logout(): Promise<void> {
    await apiClient.post(API_PATHS.AUTH.LOGOUT);
  },
};