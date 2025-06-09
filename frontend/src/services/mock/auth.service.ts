import { AuthStatusResponse, LoginResponse } from '@/types';
import { MOCK_USER_DATA } from './data/users.mock';

let isAuthenticated = false;

export const mockAuthService = {
  async getAuthStatus(): Promise<AuthStatusResponse> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return {
      authenticated: isAuthenticated,
      user: isAuthenticated ? MOCK_USER_DATA : undefined,
    };
  },

  async login(): Promise<LoginResponse> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    isAuthenticated = true;
    
    return {
      redirectUrl: '/',
    };
  },

  async logout(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    isAuthenticated = false;
  },

  setAuthenticatedForTesting(authenticated: boolean) {
    isAuthenticated = authenticated;
  },
};