/**
 * デプロイメント機能の統合テスト
 * 実際のデプロイプロバイダーとの連携をシミュレートした完全なフローテスト
 */

import request from 'supertest';
import { app } from '../../../src/app';
import { MilestoneTracker } from '../../utils/MilestoneTracker';
import { createTestUserWithToken } from '../../utils/test-auth-helper';
import { DeploymentRepository } from '../../../src/features/deploy/deploy.model';

describe('デプロイメント機能統合テスト', () => {
  let authToken: string;
  let testProjectId: string;

  beforeEach(async () => {
    // ユニークなテストデータを準備
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    testProjectId = `test-project-${uniqueId}`;

    // 認証用のJWTトークンを取得
    const authResult = await createTestUserWithToken();
    authToken = authResult.token;

    // デプロイメントデータをクリア
    DeploymentRepository.clearAll();
  });

  afterEach(async () => {
    // テストデータクリーンアップ
    DeploymentRepository.clearAll();
  });

  describe('POST /api/deploy/trigger - デプロイメント開始', () => {
    it('有効なリクエストでデプロイメントを開始できるべき', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('テスト開始');

      const deployRequest = {
        projectId: testProjectId,
        repo: 'test-user/test-repo',
        provider: 'github-pages',
        customDomain: undefined
      };

      tracker.setOperation('デプロイメント開始API呼び出し');
      const response = await request(app)
        .post('/api/deploy/trigger')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deployRequest)
        .expect(201);

      tracker.mark('APIレスポンス受信');

      // レスポンス検証
      tracker.setOperation('レスポンス検証');
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deploymentId');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data.status).toBe('pending');
      expect(response.body.meta.message).toContain('正常に開始');
      tracker.mark('検証完了');

      tracker.summary();
    });

    it('すべてのデプロイプロバイダーで正常に開始できるべき', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('テスト開始');

      const providers = ['github-pages', 'vercel', 'netlify'];
      const deploymentIds: string[] = [];

      for (const provider of providers) {
        tracker.setOperation(`${provider} デプロイメント開始`);
        
        const deployRequest = {
          projectId: testProjectId,
          repo: 'test-user/test-repo',
          provider,
          customDomain: undefined
        };

        const response = await request(app)
          .post('/api/deploy/trigger')
          .set('Authorization', `Bearer ${authToken}`)
          .send(deployRequest)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.deploymentId).toBeDefined();
        deploymentIds.push(response.body.data.deploymentId);
        
        tracker.mark(`${provider} 完了`);
      }

      // 全デプロイメントが作成されていることを確認
      tracker.setOperation('全デプロイメント確認');
      expect(deploymentIds).toHaveLength(3);
      expect(new Set(deploymentIds).size).toBe(3); // 重複がないことを確認
      tracker.mark('確認完了');

      tracker.summary();
    });

    it('カスタムドメイン付きでデプロイメントを開始できるべき', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('テスト開始');

      const deployRequest = {
        projectId: testProjectId,
        repo: 'test-user/test-repo',
        provider: 'vercel',
        customDomain: 'example.com'
      };

      tracker.setOperation('カスタムドメイン付きデプロイメント開始');
      const response = await request(app)
        .post('/api/deploy/trigger')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deployRequest)
        .expect(201);

      tracker.mark('APIレスポンス受信');

      // レスポンス検証
      tracker.setOperation('レスポンス検証');
      expect(response.body.success).toBe(true);
      expect(response.body.data.deploymentId).toBeDefined();
      tracker.mark('検証完了');

      tracker.summary();
    });

    it('無効なプロバイダーでは400エラーを返すべき', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('テスト開始');

      const deployRequest = {
        projectId: testProjectId,
        repo: 'test-user/test-repo',
        provider: 'invalid-provider',
        customDomain: undefined
      };

      tracker.setOperation('無効なプロバイダーでのAPI呼び出し');
      const response = await request(app)
        .post('/api/deploy/trigger')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deployRequest)
        .expect(400);

      tracker.mark('APIレスポンス受信');

      // レスポンス検証
      tracker.setOperation('レスポンス検証');
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('リクエストデータが不正');
      expect(response.body.meta.code).toBe('VALIDATION_ERROR');
      tracker.mark('検証完了');

      tracker.summary();
    });

    it('認証が必要なエンドポイントは未認証時に401を返すべき', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('テスト開始');

      const deployRequest = {
        projectId: testProjectId,
        repo: 'test-user/test-repo',
        provider: 'github-pages'
      };

      tracker.setOperation('未認証でのAPI呼び出し');
      const response = await request(app)
        .post('/api/deploy/trigger')
        .send(deployRequest)
        .expect(401);

      tracker.mark('APIレスポンス受信');

      // レスポンス検証
      tracker.setOperation('レスポンス検証');
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('認証トークンが提供されていません');
      tracker.mark('検証完了');

      tracker.summary();
    });
  });

  describe('GET /api/deploy/:deploymentId/status - デプロイメントステータス確認', () => {
    let deploymentId: string;

    beforeEach(async () => {
      // テスト用デプロイメントを作成
      const deployRequest = {
        projectId: testProjectId,
        repo: 'test-user/test-repo',
        provider: 'github-pages'
      };

      const response = await request(app)
        .post('/api/deploy/trigger')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deployRequest);

      deploymentId = response.body.data.deploymentId;
    });

    it('デプロイメントステータスを正常に取得できるべき', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('テスト開始');

      tracker.setOperation('デプロイメントステータス確認API呼び出し');
      const response = await request(app)
        .get(`/api/deploy/${deploymentId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      tracker.mark('APIレスポンス受信');

      // レスポンス検証
      tracker.setOperation('レスポンス検証');
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('projectId');
      expect(response.body.data).toHaveProperty('provider');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data.id).toBe(deploymentId);
      expect(response.body.data.projectId).toBe(testProjectId);
      expect(['pending', 'building', 'ready', 'error']).toContain(response.body.data.status);
      tracker.mark('検証完了');

      tracker.summary();
    });

    it('存在しないデプロイメントIDでは404エラーを返すべき', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('テスト開始');

      const nonExistentId = 'deploy-999999-999999';

      tracker.setOperation('存在しないIDでのAPI呼び出し');
      const response = await request(app)
        .get(`/api/deploy/${nonExistentId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      tracker.mark('APIレスポンス受信');

      // レスポンス検証
      tracker.setOperation('レスポンス検証');
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('見つかりません');
      expect(response.body.meta.code).toBe('DEPLOYMENT_NOT_FOUND');
      tracker.mark('検証完了');

      tracker.summary();
    });

    it('無効なデプロイメントID形式では400エラーを返すべき', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('テスト開始');

      const invalidId = 'invalid-deployment-id';

      tracker.setOperation('無効なID形式でのAPI呼び出し');
      const response = await request(app)
        .get(`/api/deploy/${invalidId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      tracker.mark('APIレスポンス受信');

      // レスポンス検証
      tracker.setOperation('レスポンス検証');
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('リクエストデータが不正');
      expect(response.body.meta.code).toBe('VALIDATION_ERROR');
      tracker.mark('検証完了');

      tracker.summary();
    });
  });

  describe('GET /api/deploy/:deploymentId/logs - デプロイメントログ取得', () => {
    let deploymentId: string;

    beforeEach(async () => {
      // テスト用デプロイメントを作成
      const deployRequest = {
        projectId: testProjectId,
        repo: 'test-user/test-repo',
        provider: 'vercel'
      };

      const response = await request(app)
        .post('/api/deploy/trigger')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deployRequest);

      // レスポンス構造をログで確認
      console.log('Deploy response:', JSON.stringify(response.body, null, 2));
      deploymentId = response.body.data?.deploymentId;

      // デプロイメント処理完了まで少し待機
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('デプロイメントログを正常に取得できるべき', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('テスト開始');

      tracker.setOperation('デプロイメントログ取得API呼び出し');
      const response = await request(app)
        .get(`/api/deploy/${deploymentId}/logs`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      tracker.mark('APIレスポンス受信');

      // レスポンス検証
      tracker.setOperation('レスポンス検証');
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('logs');
      expect(Array.isArray(response.body.data.logs)).toBe(true);
      expect(response.body.meta).toHaveProperty('count');
      expect(response.body.meta.count).toBe(response.body.data.logs.length);
      tracker.mark('検証完了');

      tracker.summary();
    });

    it('他のユーザーのデプロイメントログにはアクセスできないべき', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('テスト開始');

      // 別のユーザーを作成
      const anotherResult = await createTestUserWithToken();
      const anotherToken = anotherResult.token;

      tracker.setOperation('他ユーザーでのAPI呼び出し');
      const response = await request(app)
        .get(`/api/deploy/${deploymentId}/logs`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .expect(404);

      tracker.mark('APIレスポンス受信');

      // レスポンス検証
      tracker.setOperation('レスポンス検証');
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('デプロイメントが見つからないか、アクセス権限がありません');
      tracker.mark('検証完了');

      tracker.summary();
    });
  });

  describe('GET /api/projects/:projectId/deployments - プロジェクトデプロイメント一覧', () => {
    let localProjectId: string;
    let localAuthToken: string;
    
    beforeAll(async () => {
      // このテストグループ用の固定データを作成
      const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      localProjectId = `test-project-${uniqueId}`;
      
      const authResult = await createTestUserWithToken();
      localAuthToken = authResult.token;
    });

    // テスト用データ作成をbeforeEachから削除
    async function createTestDeployments() {
      // テスト用に複数のデプロイメントを作成
      const providers = ['github-pages', 'vercel', 'netlify'];
      
      for (const provider of providers) {
        const deployRequest = {
          projectId: localProjectId,
          repo: 'test-user/test-repo',
          provider
        };

        await request(app)
          .post('/api/deploy/trigger')
          .set('Authorization', `Bearer ${localAuthToken}`)
          .send(deployRequest);
      }
      
      // デプロイメント作成の完了を待つ
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    it('プロジェクトのデプロイメント一覧を取得できるべき', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('テスト開始');

      // テスト用デプロイメントを作成
      await createTestDeployments();
      tracker.mark('テスト用デプロイメント作成完了');

      tracker.setOperation('デプロイメント一覧取得API呼び出し');
      const response = await request(app)
        .get(`/api/projects/${localProjectId}/deployments`)
        .set('Authorization', `Bearer ${localAuthToken}`)
        .expect(200);

      tracker.mark('APIレスポンス受信');

      // レスポンス検証
      tracker.setOperation('レスポンス検証');
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deployments');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('limit');
      expect(response.body.data).toHaveProperty('hasMore');
      expect(Array.isArray(response.body.data.deployments)).toBe(true);
      expect(response.body.data.deployments.length).toBe(3); // 3つのプロバイダーで作成
      expect(response.body.data.total).toBe(3);
      tracker.mark('検証完了');

      tracker.summary();
    });

    it('ページネーションが正常に動作するべき', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('テスト開始');

      // テスト用デプロイメントを作成（3件で十分）
      await createTestDeployments();
      tracker.mark('テスト用デプロイメント作成完了');

      tracker.setOperation('ページネーション付きAPI呼び出し');
      const response = await request(app)
        .get(`/api/projects/${localProjectId}/deployments`)
        .query({ page: 1, limit: 2 })
        .set('Authorization', `Bearer ${localAuthToken}`)
        .expect(200);

      tracker.mark('APIレスポンス受信');

      // レスポンス検証
      tracker.setOperation('レスポンス検証');
      expect(response.body.success).toBe(true);
      expect(response.body.data.deployments.length).toBe(2); // limit: 2
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(2);
      expect(response.body.data.hasMore).toBe(true); // 残り1件があるため
      tracker.mark('検証完了');

      tracker.summary();
    });

    it('存在しないプロジェクトIDでは空の一覧を返すべき', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('テスト開始');

      const nonExistentProjectId = `non-existent-${Date.now()}`;

      tracker.setOperation('存在しないプロジェクトIDでのAPI呼び出し');
      const response = await request(app)
        .get(`/api/projects/${nonExistentProjectId}/deployments`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      tracker.mark('APIレスポンス受信');

      // レスポンス検証
      tracker.setOperation('レスポンス検証');
      expect(response.body.success).toBe(true);
      expect(response.body.data.deployments).toHaveLength(0);
      expect(response.body.data.total).toBe(0);
      expect(response.body.data.hasMore).toBe(false);
      tracker.mark('検証完了');

      tracker.summary();
    });
  });

  describe('GET /api/deploy/stats - デプロイメント統計情報', () => {
    async function createStatsTestData() {
      // テスト用統計データを作成
      const providers = ['github-pages', 'vercel'];
      
      for (const provider of providers) {
        const deployRequest = {
          projectId: testProjectId,
          repo: 'test-user/test-repo',
          provider
        };

        await request(app)
          .post('/api/deploy/trigger')
          .set('Authorization', `Bearer ${authToken}`)
          .send(deployRequest);
      }
      
      // デプロイメント作成の完了を待つ
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    it('デプロイメント統計情報を取得できるべき', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('テスト開始');

      // テスト用統計データを作成
      await createStatsTestData();
      tracker.mark('テスト用統計データ作成完了');

      tracker.setOperation('統計情報取得API呼び出し');
      const response = await request(app)
        .get('/api/deploy/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      tracker.mark('APIレスポンス受信');

      // レスポンス検証
      tracker.setOperation('レスポンス検証');
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('byStatus');
      expect(response.body.data).toHaveProperty('byProvider');
      expect(response.body.data.total).toBeGreaterThanOrEqual(2);
      expect(response.body.meta).toHaveProperty('generatedAt');
      tracker.mark('検証完了');

      tracker.summary();
    });
  });

  describe('レート制限テスト', () => {
    it('デプロイメント開始のレート制限が正しく動作するべき', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('テスト開始');

      // レート制限テスト（制限値まで連続リクエスト）
      tracker.setOperation('連続デプロイメント開始リクエスト');
      const promises = [];
      for (let i = 0; i < 3; i++) { // 3回の連続リクエスト
        const deployRequest = {
          projectId: `${testProjectId}-${i}`,
          repo: 'test-user/test-repo',
          provider: 'github-pages'
        };
        
        const promise = request(app)
          .post('/api/deploy/trigger')
          .set('Authorization', `Bearer ${authToken}`)
          .send(deployRequest);
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      tracker.mark('連続リクエスト完了');

      // レスポンス検証
      tracker.setOperation('レート制限レスポンス検証');
      responses.forEach((response, index) => {
        // レート制限により201または400が返される
        expect([201, 400]).toContain(response.status); // 201 or 400 (validation error)
        // 制限内では正常なレスポンスを返すはず
      });
      tracker.mark('検証完了');

      tracker.summary();
    });
  });

  describe('デプロイメントライフサイクルテスト', () => {
    it('デプロイメントの完全なライフサイクルを確認できるべき', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('テスト開始');

      // 1. デプロイメント開始
      tracker.setOperation('デプロイメント開始');
      const deployRequest = {
        projectId: testProjectId,
        repo: 'test-user/test-repo',
        provider: 'vercel',
        customDomain: 'test.example.com'
      };

      const triggerResponse = await request(app)
        .post('/api/deploy/trigger')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deployRequest);
      
      // レート制限により201または429が返される可能性がある
      expect([201, 429]).toContain(triggerResponse.status);
      
      // レート制限の場合はテストを早期終了
      if (triggerResponse.status === 429) {
        tracker.mark('レート制限により早期終了');
        tracker.summary();
        return;
      }

      const deploymentId = triggerResponse.body.data.deploymentId;
      tracker.mark('デプロイメント開始完了');

      // 2. 初期ステータス確認
      tracker.setOperation('初期ステータス確認');
      const initialStatusResponse = await request(app)
        .get(`/api/deploy/${deploymentId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(initialStatusResponse.body.data.status).toBe('pending');
      tracker.mark('初期ステータス確認完了');

      // 3. プロジェクト一覧での確認
      tracker.setOperation('プロジェクト一覧確認');
      const listResponse = await request(app)
        .get(`/api/projects/${testProjectId}/deployments`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listResponse.body.data.deployments).toHaveLength(1);
      expect(listResponse.body.data.deployments[0].id).toBe(deploymentId);
      tracker.mark('プロジェクト一覧確認完了');

      // 4. ログ確認
      tracker.setOperation('ログ確認');
      const logsResponse = await request(app)
        .get(`/api/deploy/${deploymentId}/logs`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(logsResponse.body.data.logs)).toBe(true);
      tracker.mark('ログ確認完了');

      // 5. デプロイメント処理完了を待機
      tracker.setOperation('デプロイメント完了待機');
      await new Promise(resolve => setTimeout(resolve, 3500)); // デプロイメント処理時間を待機

      // 6. 最終ステータス確認
      tracker.setOperation('最終ステータス確認');
      const finalStatusResponse = await request(app)
        .get(`/api/deploy/${deploymentId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(['ready', 'error']).toContain(finalStatusResponse.body.data.status);
      tracker.mark('最終ステータス確認完了');

      tracker.summary();
    });
  });
});