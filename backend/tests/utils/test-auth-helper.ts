/**
 * 認証テスト用ヘルパー
 * 
 * 認証関連の統合テストで使用するユーティリティ関数を提供
 * モックではなく実際の認証フローをテストするためのヘルパー
 */

import jwt from 'jsonwebtoken';
import { User, JWTPayload } from '../../src/types/index.js';
import { userRepository, UserEntity, CreateUserInput } from '../../src/features/auth/auth.model.js';
import { logger } from '../../src/common/utils/logger.js';

/**
 * テスト用ユーザーデータの生成
 */
export function createTestUserData(suffix?: string): CreateUserInput {
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const testSuffix = suffix || uniqueId;
  
  return {
    githubId: `test_github_${testSuffix}`,
    username: `test_user_${testSuffix}`,
    email: `test_${testSuffix}@example.com`,
    avatarUrl: `https://avatars.githubusercontent.com/u/test_${testSuffix}`,
    accessToken: `github_test_token_${testSuffix}`,
  };
}

/**
 * テスト用GitHubユーザー情報の生成
 */
export function createTestGitHubUser(suffix?: string) {
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const testSuffix = suffix || uniqueId;
  
  return {
    id: `test_github_${testSuffix}`,
    login: `test_user_${testSuffix}`,
    email: `test_${testSuffix}@example.com`,
    avatar_url: `https://avatars.githubusercontent.com/u/test_${testSuffix}`,
    name: `Test User ${testSuffix}`,
  };
}

/**
 * テスト用ユーザーの作成
 */
export async function createTestUser(userData?: Partial<CreateUserInput>): Promise<UserEntity> {
  const defaultData = createTestUserData();
  const finalData: CreateUserInput = { 
    githubId: userData?.githubId ?? defaultData.githubId,
    username: userData?.username ?? defaultData.username,
    accessToken: userData?.accessToken ?? defaultData.accessToken!,
    ...(defaultData.email !== undefined && { email: userData?.email ?? defaultData.email }),
    ...(defaultData.avatarUrl !== undefined && { avatarUrl: userData?.avatarUrl ?? defaultData.avatarUrl }),
  };
  
  try {
    const user = await userRepository.create(finalData);
    
    logger.debug('テスト用ユーザー作成成功', {
      userId: user.id,
      username: user.username,
      githubId: user.githubId,
    });
    
    return user;
  } catch (error) {
    logger.error('テスト用ユーザー作成失敗', {
      userData: finalData,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * テスト用JWTトークンの生成
 */
export function createTestJWT(user: User, options?: { expiresIn?: string }): string {
  const secret = process.env['JWT_SECRET'] || 'test_secret';
  const expiresIn = options?.expiresIn || '1h';
  
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    sub: user.id,
    githubId: user.githubId,
    username: user.username,
  };
  
  try {
    const token = jwt.sign(payload, secret, {
      expiresIn,
      issuer: 'LPlamp-Test',
      audience: 'LPlamp-users',
    } as jwt.SignOptions);
    
    logger.debug('テスト用JWT生成成功', {
      userId: user.id,
      username: user.username,
      expiresIn,
    });
    
    return token;
  } catch (error) {
    logger.error('テスト用JWT生成失敗', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 期限切れJWTトークンの生成
 */
export function createExpiredTestJWT(user: User): string {
  const secret = process.env['JWT_SECRET'] || 'test_secret';
  
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    sub: user.id,
    githubId: user.githubId,
    username: user.username,
  };
  
  // 1秒前に期限切れになるトークンを生成
  const token = jwt.sign(payload as any, secret, {
    expiresIn: '-1s',
    issuer: 'LPlamp-Test',
    audience: 'LPlamp-users',
  });
  
  logger.debug('期限切れテスト用JWT生成成功', {
    userId: user.id,
    username: user.username,
  });
  
  return token;
}

/**
 * 無効なJWTトークンの生成
 */
export function createInvalidTestJWT(): string {
  const invalidToken = 'invalid.jwt.token';
  
  logger.debug('無効なテスト用JWT生成成功');
  
  return invalidToken;
}

/**
 * テスト用OAuth認証コードの生成
 */
export function createTestOAuthCode(): string {
  const code = `test_oauth_code_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  
  logger.debug('テスト用OAuth認証コード生成成功', { code });
  
  return code;
}

/**
 * テスト用stateパラメータの生成
 */
export function createTestState(): string {
  const state = `test_state_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  
  logger.debug('テスト用state生成成功', { state });
  
  return state;
}

/**
 * 認証ヘッダーの生成
 */
export function createAuthHeader(token: string): { Authorization: string } {
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * テスト環境の初期化
 */
export async function setupAuthTestEnvironment(): Promise<void> {
  // 必要な環境変数の設定確認
  const requiredEnvVars = [
    'JWT_SECRET',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    // テスト用のデフォルト値を設定
    if (!process.env['JWT_SECRET']) {
      process.env['JWT_SECRET'] = 'test_jwt_secret_for_testing_only';
    }
    if (!process.env['GITHUB_CLIENT_ID']) {
      process.env['GITHUB_CLIENT_ID'] = 'test_github_client_id';
    }
    if (!process.env['GITHUB_CLIENT_SECRET']) {
      process.env['GITHUB_CLIENT_SECRET'] = 'test_github_client_secret';
    }
    
    logger.warn('テスト用環境変数を設定しました', {
      missingVars,
      message: 'これはテスト専用の設定です',
    });
  }
  
  // ユーザーリポジトリのクリア
  userRepository.clear();
  
  logger.info('認証テスト環境初期化完了', {
    userCount: userRepository.size(),
  });
}

/**
 * テスト環境のクリーンアップ
 */
export async function cleanupAuthTestEnvironment(): Promise<void> {
  // ユーザーリポジトリのクリア
  userRepository.clear();
  
  logger.info('認証テスト環境クリーンアップ完了', {
    userCount: userRepository.size(),
  });
}

/**
 * createTestUserWithTokenの拡張インターフェース
 */
interface CreateTestUserWithTokenFunction {
  (userData?: Partial<CreateUserInput>): Promise<{
    user: UserEntity;
    publicUser: User;
    token: string;
    authHeader: { Authorization: string };
  }>;
  getValidAuthToken: (email?: string) => Promise<{
    token: string;
    userId: string;
  }>;
  getApp: () => any;
}

/**
 * テスト用ユーザーとトークンのセットを作成
 */
export const createTestUserWithToken: CreateTestUserWithTokenFunction = async function(userData?: Partial<CreateUserInput>): Promise<{
  user: UserEntity;
  publicUser: User;
  token: string;
  authHeader: { Authorization: string };
}> {
  const user = await createTestUser(userData);
  const publicUser: User = {
    id: user.id,
    githubId: user.githubId,
    username: user.username,
    email: user.email ?? null,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
  
  const token = createTestJWT(publicUser);
  const authHeader = createAuthHeader(token);
  
  logger.debug('テスト用ユーザーとトークンセット作成成功', {
    userId: user.id,
    username: user.username,
  });
  
  return {
    user,
    publicUser,
    token,
    authHeader,
  };
} as CreateTestUserWithTokenFunction;

// 統合テスト用の追加メソッド
createTestUserWithToken.getValidAuthToken = async function(email?: string): Promise<{
  token: string;
  userId: string;
}> {
  const userData = email ? { email } : undefined;
  const result = await createTestUserWithToken(userData);
  
  return {
    token: result.token,
    userId: result.user.id,
  };
};

// Expressアプリケーションインスタンスの取得
let cachedApp: any = null;
createTestUserWithToken.getApp = async function() {
  if (!cachedApp) {
    // app.tsからアプリケーションインスタンスを取得
    const { app } = await import('../../src/app.js');
    cachedApp = app;
  }
  return cachedApp;
};

/**
 * HTTPリクエストボディの検証ヘルパー
 */
export function validateApiResponse(response: any, expectedSuccess: boolean): void {
  expect(response).toHaveProperty('success');
  expect(response.success).toBe(expectedSuccess);
  
  if (expectedSuccess) {
    expect(response).toHaveProperty('data');
  } else {
    expect(response).toHaveProperty('error');
    expect(response.error).toBeTruthy();
  }
}

/**
 * 認証が必要なエンドポイントの共通テスト
 */
export async function testAuthRequiredEndpoint(
  request: any,
  method: 'get' | 'post' | 'put' | 'delete',
  endpoint: string
): Promise<void> {
  // 認証なしでアクセス
  const responseWithoutAuth = await request[method](endpoint);
  expect(responseWithoutAuth.status).toBe(401);
  validateApiResponse(responseWithoutAuth.body, false);
  
  // 無効なトークンでアクセス
  const responseWithInvalidToken = await request[method](endpoint)
    .set('Authorization', 'Bearer invalid_token');
  expect(responseWithInvalidToken.status).toBe(401);
  validateApiResponse(responseWithInvalidToken.body, false);
  
  // 期限切れトークンでアクセス
  const testUser = await createTestUser();
  const expiredToken = createExpiredTestJWT(testUser);
  const responseWithExpiredToken = await request[method](endpoint)
    .set('Authorization', `Bearer ${expiredToken}`);
  expect(responseWithExpiredToken.status).toBe(401);
  validateApiResponse(responseWithExpiredToken.body, false);
}

/**
 * テスト実行のタイミング計測
 */
export class TestTimer {
  private startTime: number;
  private name: string;

  constructor(name: string) {
    this.name = name;
    this.startTime = Date.now();
    logger.debug(`テスト開始: ${name}`);
  }

  end(): number {
    const duration = Date.now() - this.startTime;
    logger.debug(`テスト完了: ${this.name}`, {
      duration: `${duration}ms`,
    });
    return duration;
  }
}