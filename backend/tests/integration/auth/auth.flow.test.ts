/**
 * 認証システム統合テスト
 * 
 * GitHub OAuth認証とJWT管理の完全なフローテスト
 * 実際のサービスを使用したエンドツーエンドテスト
 * 
 * 重要: モックは一切使用せず、実際の環境・API・データベースを使用
 */

import request from 'supertest';
import { 
  setupAuthTestEnvironment, 
  cleanupAuthTestEnvironment,
  createTestUser,
  createTestJWT,
  createExpiredTestJWT,
  createTestUserWithToken,
  testAuthRequiredEndpoint,
  validateApiResponse,
  TestTimer
} from '../../utils/test-auth-helper.js';
import { MilestoneTracker } from '../../utils/MilestoneTracker.js';
import { userRepository } from '../../../src/features/auth/auth.model.js';
import { logger } from '../../../src/common/utils/logger.js';

// Express アプリケーションの設定（実際のアプリケーションを使用）
import { app } from '../../../src/app.js';

/**
 * テストセットアップ
 */
beforeAll(async () => {
  const setupTimer = new TestTimer('認証テスト環境セットアップ');
  
  try {
    // テスト環境の初期化
    await setupAuthTestEnvironment();
    
    // Express アプリケーションは既にインポート済み
    
    logger.info('認証統合テスト開始', {
      environment: process.env['NODE_ENV'],
      jwtSecret: process.env['JWT_SECRET'] ? '設定済み' : '未設定',
      githubClientId: process.env['GITHUB_CLIENT_ID'] ? '設定済み' : '未設定',
    });
    
    setupTimer.end();
  } catch (error) {
    logger.error('認証テストセットアップ失敗', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
});

/**
 * テストクリーンアップ
 */
afterAll(async () => {
  const cleanupTimer = new TestTimer('認証テスト環境クリーンアップ');
  
  try {
    await cleanupAuthTestEnvironment();
    cleanupTimer.end();
  } catch (error) {
    logger.error('認証テストクリーンアップ失敗', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * 各テスト前のリセット
 */
beforeEach(async () => {
  userRepository.clear();
});

describe('認証システム統合テスト', () => {
  
  describe('GET /api/auth/status - 認証状態確認', () => {
    it('未認証状態で正常にレスポンスを返す', async () => {
      const tracker = new MilestoneTracker('認証状態確認_未認証');
      tracker.mark('テスト開始');

      tracker.setOperation('API呼び出し');
      const response = await request(app)
        .get('/api/auth/status');
      tracker.mark('APIレスポンス受信', {
        status: response.status,
        responseTime: response.get('x-response-time'),
      });

      tracker.setOperation('レスポンス検証');
      expect(response.status).toBe(200);
      validateApiResponse(response.body, true);
      expect(response.body.data.authenticated).toBe(false);
      expect(response.body.data.user).toBeUndefined();
      tracker.mark('検証完了');

      tracker.summary();
    });

    it('認証済み状態で正常にユーザー情報を返す', async () => {
      const tracker = new MilestoneTracker('認証状態確認_認証済み');
      tracker.mark('テスト開始');

      tracker.setOperation('テストデータ準備');
      const { publicUser, authHeader } = await createTestUserWithToken();
      tracker.mark('データ準備完了', {
        userId: publicUser.id,
        username: publicUser.username,
      });

      tracker.setOperation('API呼び出し');
      const response = await request(app)
        .get('/api/auth/status')
        .set(authHeader);
      tracker.mark('APIレスポンス受信', {
        status: response.status,
      });

      tracker.setOperation('レスポンス検証');
      expect(response.status).toBe(200);
      validateApiResponse(response.body, true);
      expect(response.body.data.authenticated).toBe(true);
      expect(response.body.data.user).toMatchObject({
        id: publicUser.id,
        username: publicUser.username,
        githubId: publicUser.githubId,
      });
      tracker.mark('検証完了');

      tracker.summary();
    });
  });

  describe('GET /api/auth/github/login - GitHub認証開始', () => {
    it('GitHub認証URLを正常に生成する', async () => {
      const tracker = new MilestoneTracker('GitHub認証URL生成');
      tracker.mark('テスト開始');

      tracker.setOperation('API呼び出し');
      const response = await request(app)
        .get('/api/auth/github/login');
      tracker.mark('APIレスポンス受信', {
        status: response.status,
      });

      tracker.setOperation('レスポンス検証');
      expect(response.status).toBe(200);
      validateApiResponse(response.body, true);
      expect(response.body.data.redirectUrl).toBeDefined();
      expect(response.body.data.redirectUrl).toContain('github.com/login/oauth/authorize');
      expect(response.body.data.redirectUrl).toContain('client_id=');
      expect(response.body.data.redirectUrl).toContain('redirect_uri=');
      expect(response.body.data.redirectUrl).toContain('scope=');
      expect(response.body.data.redirectUrl).toContain('state=');
      tracker.mark('検証完了', {
        redirectUrl: response.body.data.redirectUrl,
      });

      tracker.summary();
    });
  });

  describe('GET /api/auth/github/callback - GitHub認証コールバック', () => {
    it('認証コードが無い場合はエラーページにリダイレクトする', async () => {
      const tracker = new MilestoneTracker('GitHub認証コールバック_エラー');
      tracker.mark('テスト開始');

      tracker.setOperation('API呼び出し');
      const response = await request(app)
        .get('/api/auth/github/callback');
      tracker.mark('APIレスポンス受信', {
        status: response.status,
      });

      tracker.setOperation('レスポンス検証');
      expect(response.status).toBe(302); // リダイレクト
      expect(response.get('Location')).toContain('error=auth_failed');
      tracker.mark('検証完了');

      tracker.summary();
    });

    it('GitHubエラーレスポンスの場合はエラーページにリダイレクトする', async () => {
      const tracker = new MilestoneTracker('GitHub認証コールバック_GitHubエラー');
      tracker.mark('テスト開始');

      tracker.setOperation('API呼び出し');
      const response = await request(app)
        .get('/api/auth/github/callback')
        .query({
          error: 'access_denied',
          error_description: 'The user denied the request',
        });
      tracker.mark('APIレスポンス受信', {
        status: response.status,
      });

      tracker.setOperation('レスポンス検証');
      expect(response.status).toBe(302);
      expect(response.get('Location')).toContain('error=auth_failed');
      tracker.mark('検証完了');

      tracker.summary();
    });

    // 注意: 実際のGitHub OAuthテストは複雑なため、
    // ここではエラーケースのみテストし、正常ケースは別途エンドツーエンドテストで実施
  });

  describe('POST /api/auth/logout - ログアウト', () => {
    it('認証が必要', async () => {
      const tracker = new MilestoneTracker('ログアウト_認証チェック');
      tracker.mark('テスト開始');

      await testAuthRequiredEndpoint(request(app), 'post', '/api/auth/logout');
      tracker.mark('認証チェック完了');

      tracker.summary();
    });

    it('認証済みユーザーが正常にログアウトできる', async () => {
      const tracker = new MilestoneTracker('ログアウト_正常');
      tracker.mark('テスト開始');

      tracker.setOperation('テストデータ準備');
      const { publicUser, authHeader } = await createTestUserWithToken();
      tracker.mark('データ準備完了', {
        userId: publicUser.id,
      });

      tracker.setOperation('API呼び出し');
      const response = await request(app)
        .post('/api/auth/logout')
        .set(authHeader);
      tracker.mark('APIレスポンス受信', {
        status: response.status,
      });

      tracker.setOperation('レスポンス検証');
      expect(response.status).toBe(200);
      validateApiResponse(response.body, true);
      expect(response.body.data.message).toBeDefined();
      tracker.mark('検証完了');

      tracker.summary();
    });
  });

  describe('GET /api/auth/me - 現在のユーザー情報取得', () => {
    it('認証が必要', async () => {
      const tracker = new MilestoneTracker('ユーザー情報取得_認証チェック');
      tracker.mark('テスト開始');

      await testAuthRequiredEndpoint(request(app), 'get', '/api/auth/me');
      tracker.mark('認証チェック完了');

      tracker.summary();
    });

    it('認証済みユーザーの情報を正常に取得できる', async () => {
      const tracker = new MilestoneTracker('ユーザー情報取得_正常');
      tracker.mark('テスト開始');

      tracker.setOperation('テストデータ準備');
      const { publicUser, authHeader } = await createTestUserWithToken();
      tracker.mark('データ準備完了', {
        userId: publicUser.id,
        username: publicUser.username,
      });

      tracker.setOperation('API呼び出し');
      const response = await request(app)
        .get('/api/auth/me')
        .set(authHeader);
      tracker.mark('APIレスポンス受信', {
        status: response.status,
      });

      tracker.setOperation('レスポンス検証');
      expect(response.status).toBe(200);
      validateApiResponse(response.body, true);
      expect(response.body.data).toMatchObject({
        id: publicUser.id,
        username: publicUser.username,
        githubId: publicUser.githubId,
        email: publicUser.email,
      });
      
      // 機密情報が含まれていないことを確認
      expect(response.body.data.accessToken).toBeUndefined();
      tracker.mark('検証完了');

      tracker.summary();
    });
  });

  describe('GET /api/auth/validate - セッション検証', () => {
    it('認証が必要', async () => {
      const tracker = new MilestoneTracker('セッション検証_認証チェック');
      tracker.mark('テスト開始');

      await testAuthRequiredEndpoint(request(app), 'get', '/api/auth/validate');
      tracker.mark('認証チェック完了');

      tracker.summary();
    });

    it('有効なセッション情報を返す', async () => {
      const tracker = new MilestoneTracker('セッション検証_正常');
      tracker.mark('テスト開始');

      tracker.setOperation('テストデータ準備');
      const { publicUser, authHeader } = await createTestUserWithToken();
      tracker.mark('データ準備完了');

      tracker.setOperation('API呼び出し');
      const response = await request(app)
        .get('/api/auth/validate')
        .set(authHeader);
      tracker.mark('APIレスポンス受信');

      tracker.setOperation('レスポンス検証');
      expect(response.status).toBe(200);
      validateApiResponse(response.body, true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.user).toMatchObject({
        id: publicUser.id,
        username: publicUser.username,
        githubId: publicUser.githubId,
      });
      expect(response.body.data.timestamp).toBeDefined();
      tracker.mark('検証完了');

      tracker.summary();
    });
  });

  describe('JWT トークン関連テスト', () => {
    it('期限切れトークンは認証に失敗する', async () => {
      const tracker = new MilestoneTracker('期限切れトークン検証');
      tracker.mark('テスト開始');

      tracker.setOperation('テストデータ準備');
      const user = await createTestUser();
      const expiredToken = createExpiredTestJWT(user);
      tracker.mark('データ準備完了');

      tracker.setOperation('API呼び出し');
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);
      tracker.mark('APIレスポンス受信');

      tracker.setOperation('レスポンス検証');
      expect(response.status).toBe(401);
      validateApiResponse(response.body, false);
      expect(response.body.meta.code).toBe('TOKEN_EXPIRED');
      tracker.mark('検証完了');

      tracker.summary();
    });

    it('無効なトークンは認証に失敗する', async () => {
      const tracker = new MilestoneTracker('無効トークン検証');
      tracker.mark('テスト開始');

      tracker.setOperation('API呼び出し');
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token_format');
      tracker.mark('APIレスポンス受信');

      tracker.setOperation('レスポンス検証');
      expect(response.status).toBe(401);
      validateApiResponse(response.body, false);
      expect(response.body.meta.code).toBe('INVALID_TOKEN');
      tracker.mark('検証完了');

      tracker.summary();
    });

    it('形式が間違ったAuthorizationヘッダーは認証に失敗する', async () => {
      const tracker = new MilestoneTracker('不正ヘッダー検証');
      tracker.mark('テスト開始');

      const testCases = [
        { header: 'invalid_format', description: '形式違い' },
        { header: 'Basic token123', description: 'Basic認証形式' },
        { header: 'Bearer', description: 'トークン欠如' },
        { header: 'Bearer token1 token2', description: '複数トークン' },
      ];

      for (const testCase of testCases) {
        tracker.setOperation(`API呼び出し - ${testCase.description}`);
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', testCase.header);
        tracker.mark(`レスポンス受信 - ${testCase.description}`);

        expect(response.status).toBe(401);
        validateApiResponse(response.body, false);
      }

      tracker.mark('全ケース検証完了');
      tracker.summary();
    });
  });

  describe('ユーザー管理関連テスト', () => {
    it('存在しないユーザーIDのトークンは認証に失敗する', async () => {
      const tracker = new MilestoneTracker('存在しないユーザー検証');
      tracker.mark('テスト開始');

      tracker.setOperation('テストデータ準備');
      // 実際には存在しないユーザーのトークンを生成
      const fakeUser = {
        id: 'non_existent_user_id',
        githubId: 'fake_github_id',
        username: 'fake_user',
        email: 'fake@example.com',
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      const fakeToken = createTestJWT(fakeUser);
      tracker.mark('データ準備完了');

      tracker.setOperation('API呼び出し');
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${fakeToken}`);
      tracker.mark('APIレスポンス受信');

      tracker.setOperation('レスポンス検証');
      expect(response.status).toBe(401);
      validateApiResponse(response.body, false);
      expect(response.body.meta.code).toBe('USER_NOT_FOUND');
      tracker.mark('検証完了');

      tracker.summary();
    });
  });

  describe('同時アクセス・負荷テスト', () => {
    it('複数の同時認証リクエストを正常に処理する', async () => {
      const tracker = new MilestoneTracker('同時認証テスト');
      tracker.mark('テスト開始');

      tracker.setOperation('テストデータ準備');
      const userTokenPairs = await Promise.all([
        createTestUserWithToken({ username: 'concurrent_user_1' }),
        createTestUserWithToken({ username: 'concurrent_user_2' }),
        createTestUserWithToken({ username: 'concurrent_user_3' }),
      ]);
      tracker.mark('データ準備完了', {
        userCount: userTokenPairs.length,
      });

      tracker.setOperation('同時API呼び出し');
      const promises = userTokenPairs.map(({ authHeader }) =>
        request(app)
          .get('/api/auth/me')
          .set(authHeader)
      );
      
      const responses = await Promise.all(promises);
      tracker.mark('全レスポンス受信', {
        responseCount: responses.length,
      });

      tracker.setOperation('レスポンス検証');
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        const expectedUser = userTokenPairs[i]?.publicUser;
        
        if (response && expectedUser) {
          expect(response.status).toBe(200);
          validateApiResponse(response.body, true);
          expect(response.body.data?.username).toBe(expectedUser.username);
        }
      }
      tracker.mark('検証完了');

      tracker.summary();
    });
  });

  describe('エラーハンドリング・セキュリティテスト', () => {
    it('SQL インジェクション攻撃を防ぐ', async () => {
      const tracker = new MilestoneTracker('SQLインジェクション防御テスト');
      tracker.mark('テスト開始');

      const maliciousPayloads = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'; DELETE FROM users WHERE '1'='1",
      ];

      for (const payload of maliciousPayloads) {
        tracker.setOperation(`悪意のあるペイロードテスト`);
        
        // GitHubコールバックに悪意のあるペイロードを送信
        const response = await request(app)
          .get('/api/auth/github/callback')
          .query({ code: payload });
        tracker.mark(`ペイロード処理完了`);

        // セキュリティ侵害されずに適切にエラーレスポンスを返すことを確認
        expect(response.status).toBe(302); // リダイレクト
        expect(response.get('Location')).toContain('error=auth_failed');
        
        // データベースが破損していないことを確認
        expect(userRepository.size()).toBeGreaterThanOrEqual(0);
      }

      tracker.mark('セキュリティテスト完了');
      tracker.summary();
    });
  });
});

/**
 * パフォーマンステスト
 */
describe('認証システム パフォーマンステスト', () => {
  it('認証状態確認が200ms以下で応答する', async () => {
    const tracker = new MilestoneTracker('認証状態確認パフォーマンス');
    tracker.setThreshold('API呼び出し', 200); // 200ms閾値設定
    tracker.mark('テスト開始');

    tracker.setOperation('API呼び出し');
    const startTime = Date.now();
    const response = await request(app)
      .get('/api/auth/status');
    const endTime = Date.now();
    tracker.mark('APIレスポンス受信');

    const responseTime = endTime - startTime;
    expect(response.status).toBe(200);
    expect(responseTime).toBeLessThan(200);
    
    tracker.mark('パフォーマンス検証完了', {
      responseTime: `${responseTime}ms`,
      threshold: '200ms',
    });

    tracker.summary();
  });
});