import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  checkAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = user !== null;

  const checkAuthStatus = async () => {
    try {
      console.log('AuthContext: 認証状態確認開始');
      setIsLoading(true);
      const { authService } = await import('@/services');
      const data = await authService.getAuthStatus();
      
      console.log('AuthContext: 認証API レスポンス:', data);
      
      // APIレスポンスのdata部分から認証情報を取得
      if (data.success && data.data?.authenticated && data.data.user) {
        console.log('AuthContext: 認証成功、ユーザー設定:', data.data.user);
        setUser(data.data.user);
      } else {
        console.log('AuthContext: 認証失敗またはユーザーなし');
        setUser(null);
      }
    } catch (error) {
      console.error('認証状態の確認に失敗:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
      console.log('AuthContext: 認証状態確認完了、loading終了');
    }
  };

  const login = async () => {
    const { authService } = await import('@/services');
    await authService.login();
    await checkAuthStatus();
  };

  const logout = async () => {
    try {
      const { authService } = await import('@/services');
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error('ログアウトに失敗:', error);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuthStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}