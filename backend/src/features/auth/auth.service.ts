/**
 * 認証サービス
 * 
 * GitHub OAuth認証とJWT管理を担当
 * ユーザー登録・ログイン・トークン生成を統合
 */

import jwt from 'jsonwebtoken';
// Node.js 18+ 組み込みfetchを使用
import { 
  User, 
  JWTPayload, 
  AuthStatusResponse, 
  LoginResponse 
} from '../../types/index.js';
import { 
  userRepository, 
  UserRepository,
  GitHubUserInfo,
  OAuthResult,
  JWTOptions,
  AuthSession,
  toPublicUser,
  createJWTPayload,
  mapGitHubUser
} from './auth.model.js';
import {
  validateOAuthCode,
  validateGitHubUser,
  validateAccessToken,
  validateCreateUserInput,
  throwIfInvalid
} from './auth.validator.js';
import { logger, PerformanceLogger } from '../../common/utils/logger.js';

/**
 * GitHub OAuth設定
 */
interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  scope: string;
}

/**
 * JWT設定
 */
interface JWTConfig {
  secret: string;
  expiresIn: string;
  issuer?: string;
  audience?: string;
}

/**
 * 認証サービスエラー
 */
export class AuthServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

/**
 * 認証サービス実装
 */
export class AuthService {
  private githubConfig: GitHubOAuthConfig;
  private jwtConfig: JWTConfig;
  private repository: UserRepository;

  constructor(repository: UserRepository = userRepository) {
    this.repository = repository;
    this.githubConfig = this.loadGitHubConfig();
    this.jwtConfig = this.loadJWTConfig();
    
    logger.info('認証サービス初期化完了', {
      githubClientId: this.githubConfig.clientId,
      jwtIssuer: this.jwtConfig.issuer,
    });
  }

  /**
   * GitHub OAuth設定の読み込み
   */
  private loadGitHubConfig(): GitHubOAuthConfig {
    const clientId = process.env['GITHUB_CLIENT_ID'];
    const clientSecret = process.env['GITHUB_CLIENT_SECRET'];
    const callbackUrl = process.env['GITHUB_CALLBACK_URL'] || 'http://localhost:8080/api/auth/github/callback';
    const scope = process.env['GITHUB_SCOPE'] || 'user:email';

    if (!clientId || !clientSecret) {
      throw new AuthServiceError(
        'GitHub OAuth設定が不完全です',
        'GITHUB_CONFIG_MISSING',
        500,
        { 
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret 
        }
      );
    }

    return {
      clientId,
      clientSecret,
      callbackUrl,
      scope,
    };
  }

  /**
   * JWT設定の読み込み
   */
  private loadJWTConfig(): JWTConfig {
    const secret = process.env['JWT_SECRET'];
    const expiresIn = process.env['JWT_EXPIRES_IN'] || '30d';
    const issuer = process.env['JWT_ISSUER'] || 'LPlamp';
    const audience = process.env['JWT_AUDIENCE'] || 'LPlamp-users';

    if (!secret) {
      throw new AuthServiceError(
        'JWT設定が不完全です',
        'JWT_CONFIG_MISSING',
        500
      );
    }

    return {
      secret,
      expiresIn,
      issuer,
      audience,
    };
  }

  /**
   * GitHub認証開始URLの生成
   */
  generateGitHubAuthUrl(): LoginResponse {
    const params = new URLSearchParams({
      client_id: this.githubConfig.clientId,
      redirect_uri: this.githubConfig.callbackUrl,
      scope: this.githubConfig.scope,
      state: this.generateState(),
    });

    const redirectUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
    
    logger.info('GitHub認証URL生成', {
      clientId: this.githubConfig.clientId,
      callbackUrl: this.githubConfig.callbackUrl,
      scope: this.githubConfig.scope,
    });

    return { redirectUrl };
  }

  /**
   * GitHub OAuth認証処理
   */
  async processGitHubCallback(code: string, _state?: string): Promise<OAuthResult> {
    const perfLog = new PerformanceLogger('GitHub OAuth認証');
    
    try {
      // コード検証
      const codeValidation = validateOAuthCode(code);
      throwIfInvalid(codeValidation);

      // アクセストークン取得
      const accessToken = await this.exchangeCodeForToken(code);
      
      // ユーザー情報取得
      const githubUser = await this.fetchGitHubUser(accessToken);
      
      // ユーザー登録・更新
      const result = await this.findOrCreateUser(githubUser, accessToken);
      
      perfLog.end({
        userId: result.user.id,
        username: result.user.username,
        isNewUser: result.isNewUser,
      });

      return result;
    } catch (error) {
      perfLog.error(error as Error);
      
      if (error instanceof AuthServiceError) {
        throw error;
      }
      
      throw new AuthServiceError(
        'GitHub認証処理に失敗しました',
        'GITHUB_AUTH_FAILED',
        500,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * コードをアクセストークンに交換
   */
  private async exchangeCodeForToken(code: string): Promise<string> {
    try {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.githubConfig.clientId,
          client_secret: this.githubConfig.clientSecret,
          code,
        }),
      });

      if (!response.ok) {
        throw new AuthServiceError(
          'GitHubトークン取得に失敗しました',
          'GITHUB_TOKEN_EXCHANGE_FAILED',
          response.status,
          { 
            status: response.status, 
            statusText: response.statusText 
          }
        );
      }

      const data = await response.json() as any;
      
      if (data.error) {
        throw new AuthServiceError(
          `GitHub認証エラー: ${data.error_description || data.error}`,
          'GITHUB_AUTH_ERROR',
          400,
          { 
            error: data.error, 
            description: data.error_description 
          }
        );
      }

      if (!data.access_token) {
        throw new AuthServiceError(
          'アクセストークンが取得できませんでした',
          'ACCESS_TOKEN_MISSING',
          500,
          { responseData: data }
        );
      }

      // トークン検証
      const tokenValidation = validateAccessToken(data.access_token);
      throwIfInvalid(tokenValidation);

      logger.debug('GitHubアクセストークン取得成功', {
        tokenType: data.token_type,
        scope: data.scope,
      });

      return data.access_token;
    } catch (error) {
      logger.error('GitHubトークン交換エラー', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      if (error instanceof AuthServiceError) {
        throw error;
      }
      
      throw new AuthServiceError(
        'トークン交換処理に失敗しました',
        'TOKEN_EXCHANGE_FAILED',
        500,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * GitHubユーザー情報の取得
   */
  private async fetchGitHubUser(accessToken: string): Promise<GitHubUserInfo> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'LPlamp/1.0',
        },
      });

      if (!response.ok) {
        throw new AuthServiceError(
          'GitHubユーザー情報取得に失敗しました',
          'GITHUB_USER_FETCH_FAILED',
          response.status,
          { 
            status: response.status, 
            statusText: response.statusText 
          }
        );
      }

      const userData = await response.json() as any;
      
      // ユーザー情報検証
      const userValidation = validateGitHubUser(userData);
      throwIfInvalid(userValidation);

      const githubUser: GitHubUserInfo = {
        id: String(userData.id),
        login: userData.login,
        email: userData.email,
        avatar_url: userData.avatar_url,
        name: userData.name,
      };

      logger.debug('GitHubユーザー情報取得成功', {
        githubId: githubUser.id,
        username: githubUser.login,
        hasEmail: !!githubUser.email,
      });

      return githubUser;
    } catch (error) {
      logger.error('GitHubユーザー情報取得エラー', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      if (error instanceof AuthServiceError) {
        throw error;
      }
      
      throw new AuthServiceError(
        'ユーザー情報取得処理に失敗しました',
        'USER_FETCH_FAILED',
        500,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * ユーザーの検索または作成
   */
  private async findOrCreateUser(githubUser: GitHubUserInfo, accessToken: string): Promise<OAuthResult> {
    try {
      // 既存ユーザーを検索
      const existingUser = await this.repository.findByGitHubId(githubUser.id);
      
      if (existingUser) {
        // 既存ユーザーの更新
        const updatedUser = await this.repository.update(existingUser.id, {
          username: githubUser.login,
          email: githubUser.email,
          avatarUrl: githubUser.avatar_url,
          accessToken,
          lastLoginAt: new Date().toISOString(),
        });

        logger.info('既存ユーザーでログイン', {
          userId: updatedUser.id,
          username: updatedUser.username,
        });

        return {
          user: toPublicUser(updatedUser),
          accessToken,
          isNewUser: false,
        };
      } else {
        // 新規ユーザーの作成
        const createInput = mapGitHubUser(githubUser, accessToken);
        
        // 入力検証
        const inputValidation = validateCreateUserInput(createInput);
        throwIfInvalid(inputValidation);
        
        const newUser = await this.repository.create(createInput);

        logger.info('新規ユーザー作成', {
          userId: newUser.id,
          username: newUser.username,
          githubId: newUser.githubId,
        });

        return {
          user: toPublicUser(newUser),
          accessToken,
          isNewUser: true,
        };
      }
    } catch (error) {
      logger.error('ユーザー検索・作成エラー', {
        githubId: githubUser.id,
        username: githubUser.login,
        error: error instanceof Error ? error.message : String(error),
      });
      
      if (error instanceof AuthServiceError) {
        throw error;
      }
      
      throw new AuthServiceError(
        'ユーザー処理に失敗しました',
        'USER_PROCESSING_FAILED',
        500,
        { 
          githubId: githubUser.id,
          originalError: error instanceof Error ? error.message : String(error) 
        }
      );
    }
  }

  /**
   * JWTトークンの生成
   */
  generateJWT(user: User, options?: JWTOptions): string {
    try {
      const payload = createJWTPayload(user);
      
      const expiresInValue = options?.expiresIn || this.jwtConfig.expiresIn;
      const jwtOptions: jwt.SignOptions = {
        expiresIn: expiresInValue as any,
        issuer: options?.issuer || this.jwtConfig.issuer,
        audience: options?.audience || this.jwtConfig.audience,
      };

      const token = jwt.sign(payload, this.jwtConfig.secret, jwtOptions);
      
      logger.debug('JWT生成成功', {
        userId: user.id,
        username: user.username,
        expiresIn: jwtOptions.expiresIn,
      });

      return token;
    } catch (error) {
      logger.error('JWT生成エラー', {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw new AuthServiceError(
        'JWT生成に失敗しました',
        'JWT_GENERATION_FAILED',
        500,
        { 
          userId: user.id,
          originalError: error instanceof Error ? error.message : String(error) 
        }
      );
    }
  }

  /**
   * JWTトークンの検証
   */
  verifyJWT(token: string): JWTPayload {
    try {
      const payload = jwt.verify(token, this.jwtConfig.secret, {
        issuer: this.jwtConfig.issuer,
        audience: this.jwtConfig.audience,
      }) as JWTPayload;

      logger.debug('JWT検証成功', {
        userId: payload.sub,
        username: payload.username,
      });

      return payload;
    } catch (error) {
      logger.warn('JWT検証失敗', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthServiceError(
          'トークンの有効期限が切れています',
          'TOKEN_EXPIRED',
          401
        );
      }
      
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthServiceError(
          'トークンが無効です',
          'INVALID_TOKEN',
          401
        );
      }
      
      throw new AuthServiceError(
        'トークン検証に失敗しました',
        'TOKEN_VERIFICATION_FAILED',
        500,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * 認証セッションの作成
   */
  async createAuthSession(user: User): Promise<AuthSession> {
    const token = this.generateJWT(user);
    const payload = this.verifyJWT(token);
    
    return {
      user,
      token,
      expiresAt: new Date(payload.exp * 1000),
    };
  }

  /**
   * ユーザー認証状態の確認
   */
  async getAuthStatus(userId?: string): Promise<AuthStatusResponse> {
    if (!userId) {
      return { authenticated: false };
    }

    try {
      const user = await this.repository.findById(userId);
      
      if (!user) {
        logger.warn('認証状態確認: ユーザーが見つかりません', { userId });
        return { authenticated: false };
      }

      return {
        authenticated: true,
        user: toPublicUser(user),
      };
    } catch (error) {
      logger.error('認証状態確認エラー', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return { authenticated: false };
    }
  }

  /**
   * ユーザーのログアウト処理
   */
  async logout(userId: string): Promise<void> {
    try {
      // 現在はトークンの無効化は実装しない（ステートレス）
      // 将来的にはブラックリストやリフレッシュトークンの削除を実装
      
      logger.info('ユーザーログアウト', { userId });
    } catch (error) {
      logger.error('ログアウト処理エラー', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw new AuthServiceError(
        'ログアウト処理に失敗しました',
        'LOGOUT_FAILED',
        500,
        { 
          userId,
          originalError: error instanceof Error ? error.message : String(error) 
        }
      );
    }
  }

  /**
   * State生成（CSRF防止用）
   */
  private generateState(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

/**
 * デフォルト認証サービスインスタンス
 */
export const authService = new AuthService();