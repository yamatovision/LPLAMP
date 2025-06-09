/**
 * プロジェクト管理機能 - 統合テスト
 * 
 * 実データを使用した完全なプロジェクト管理フローのテスト
 * 認証フローと組み合わせた実際のAPIテスト
 */

import request from 'supertest';
import { MilestoneTracker } from '../../utils/MilestoneTracker';
import { createTestUserWithToken } from '../../utils/test-auth-helper';

// テスト用の一意データ生成
function generateUniqueTestData() {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  return {
    projectName: `Test Project ${uniqueId}`,
    testUrl: 'https://example.com',
    userEmail: `test-user-${uniqueId}@example.com`,
    updatedName: `Updated Project ${uniqueId}`
  };
}

describe('プロジェクト管理API統合テスト', () => {
  let testData: ReturnType<typeof generateUniqueTestData>;
  let authToken: string;
  let userId: string;
  let createdProjectId: string;

  beforeEach(async () => {
    // 各テスト用のユニークデータ生成
    testData = generateUniqueTestData();
  });

  afterEach(async () => {
    // テスト後のクリーンアップ（必要に応じて）
    // プロジェクトデータは実際の環境では削除しない
  });

  describe('認証付きプロジェクト作成フロー', () => {
    it('認証からプロジェクト作成まで完全なフローが正常に動作する', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('テスト開始');

      // ステップ1: テスト用ユーザーで認証
      tracker.setOperation('認証トークン取得');
      const authResult = await createTestUserWithToken.getValidAuthToken(testData.userEmail);
      authToken = authResult.token;
      userId = authResult.userId;
      tracker.mark('認証完了');

      // ステップ2: プロジェクト作成
      tracker.setOperation('プロジェクト作成');
      const createResponse = await request(await createTestUserWithToken.getApp())
        .post('/api/projects/create')
        .set('Cookie', `authToken=${authToken}`)
        .send({
          url: testData.testUrl,
          name: testData.projectName
        })
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      // レスポンス構造の正規化: data.data.projectId -> projectId
      const responseData = createResponse.body.data.data || createResponse.body.data;
      expect(responseData.projectId).toBeDefined();
      expect(responseData.status).toBe('processing');
      
      createdProjectId = responseData.projectId;
      tracker.mark('プロジェクト作成完了');

      // ステップ3: プロジェクト一覧で確認
      tracker.setOperation('プロジェクト一覧確認');
      const listResponse = await request(await createTestUserWithToken.getApp())
        .get('/api/projects')
        .set('Cookie', `authToken=${authToken}`)
        .expect(200);

      expect(listResponse.body.success).toBe(true);
      expect(listResponse.body.data.projects).toBeInstanceOf(Array);
      
      const createdProject = listResponse.body.data.projects.find(
        (p: any) => p.id === createdProjectId
      );
      expect(createdProject).toBeDefined();
      expect(createdProject.name).toBe(testData.projectName);
      expect(createdProject.url).toBe(testData.testUrl);
      tracker.mark('一覧確認完了');

      // ステップ4: 作成ステータス確認
      tracker.setOperation('ステータス確認');
      const statusResponse = await request(await createTestUserWithToken.getApp())
        .get(`/api/projects/${createdProjectId}/status`)
        .set('Cookie', `authToken=${authToken}`)
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(['processing', 'completed', 'failed']).toContain(statusResponse.body.data.status);
      tracker.mark('ステータス確認完了');

      tracker.summary();
    }, 30000); // 30秒のタイムアウト
  });

  describe('プロジェクト詳細操作フロー', () => {
    beforeEach(async () => {
      // 各テストで認証とプロジェクト作成
      const authResult = await createTestUserWithToken.getValidAuthToken(testData.userEmail);
      authToken = authResult.token;
      userId = authResult.userId;

      const createResponse = await request(await createTestUserWithToken.getApp())
        .post('/api/projects/create')
        .set('Cookie', `authToken=${authToken}`)
        .send({
          url: testData.testUrl,
          name: testData.projectName
        });

      // レスポンス構造の正規化
      const responseData = createResponse.body.data.data || createResponse.body.data;
      createdProjectId = responseData.projectId;
    });

    it('プロジェクト詳細取得が正常に動作する', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('詳細取得テスト開始');

      tracker.setOperation('プロジェクト詳細取得');
      const detailResponse = await request(await createTestUserWithToken.getApp())
        .get(`/api/projects/${createdProjectId}`)
        .set('Cookie', `authToken=${authToken}`)
        .expect(200);

      expect(detailResponse.body.success).toBe(true);
      expect(detailResponse.body.data.id).toBe(createdProjectId);
      expect(detailResponse.body.data.name).toBe(testData.projectName);
      expect(detailResponse.body.data.url).toBe(testData.testUrl);
      expect(detailResponse.body.data.userId).toBe(userId);
      tracker.mark('詳細取得完了');

      tracker.summary();
    });

    it('プロジェクト情報更新が正常に動作する', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('更新テスト開始');

      tracker.setOperation('プロジェクト情報更新');
      const updateResponse = await request(await createTestUserWithToken.getApp())
        .put(`/api/projects/${createdProjectId}`)
        .set('Cookie', `authToken=${authToken}`)
        .send({
          name: testData.updatedName,
          githubRepo: 'test-user/test-repo'
        })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.name).toBe(testData.updatedName);
      expect(updateResponse.body.data.githubRepo).toBe('test-user/test-repo');
      tracker.mark('更新完了');

      // 更新確認
      tracker.setOperation('更新確認');
      const verifyResponse = await request(await createTestUserWithToken.getApp())
        .get(`/api/projects/${createdProjectId}`)
        .set('Cookie', `authToken=${authToken}`)
        .expect(200);

      expect(verifyResponse.body.data.name).toBe(testData.updatedName);
      expect(verifyResponse.body.data.githubRepo).toBe('test-user/test-repo');
      tracker.mark('更新確認完了');

      tracker.summary();
    });

    it('プロジェクト削除が正常に動作する', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('削除テスト開始');

      tracker.setOperation('プロジェクト削除');
      const deleteResponse = await request(await createTestUserWithToken.getApp())
        .delete(`/api/projects/${createdProjectId}`)
        .set('Cookie', `authToken=${authToken}`)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);
      tracker.mark('削除完了');

      // 削除確認（404エラーになることを確認）
      tracker.setOperation('削除確認');
      await request(await createTestUserWithToken.getApp())
        .get(`/api/projects/${createdProjectId}`)
        .set('Cookie', `authToken=${authToken}`)
        .expect(404);
      tracker.mark('削除確認完了');

      tracker.summary();
    });
  });

  describe('認証・権限制御テスト', () => {
    let otherUserToken: string;
    let otherUserProjectId: string;

    beforeEach(async () => {
      // テストユーザー1の認証
      const authResult1 = await createTestUserWithToken.getValidAuthToken(testData.userEmail);
      authToken = authResult1.token;

      // テストユーザー2の認証
      const otherUserData = generateUniqueTestData();
      const authResult2 = await createTestUserWithToken.getValidAuthToken(otherUserData.userEmail);
      otherUserToken = authResult2.token;

      // テストユーザー2のプロジェクト作成
      const createResponse = await request(await createTestUserWithToken.getApp())
        .post('/api/projects/create')
        .set('Cookie', `authToken=${otherUserToken}`)
        .send({
          url: testData.testUrl,
          name: otherUserData.projectName
        });

      // レスポンス構造の正規化
      const responseData = createResponse.body.data.data || createResponse.body.data;
      otherUserProjectId = responseData.projectId;
    });

    it('他のユーザーのプロジェクトにアクセスできない', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('権限制御テスト開始');

      // 他のユーザーのプロジェクト詳細取得（403エラー）
      tracker.setOperation('不正アクセステスト（詳細取得）');
      await request(await createTestUserWithToken.getApp())
        .get(`/api/projects/${otherUserProjectId}`)
        .set('Cookie', `authToken=${authToken}`)
        .expect(403);
      tracker.mark('詳細取得拒否確認');

      // 他のユーザーのプロジェクト更新（403エラー）
      tracker.setOperation('不正アクセステスト（更新）');
      await request(await createTestUserWithToken.getApp())
        .put(`/api/projects/${otherUserProjectId}`)
        .set('Cookie', `authToken=${authToken}`)
        .send({ name: 'Unauthorized Update' })
        .expect(403);
      tracker.mark('更新拒否確認');

      // 他のユーザーのプロジェクト削除（403エラー）
      tracker.setOperation('不正アクセステスト（削除）');
      await request(await createTestUserWithToken.getApp())
        .delete(`/api/projects/${otherUserProjectId}`)
        .set('Cookie', `authToken=${authToken}`)
        .expect(403);
      tracker.mark('削除拒否確認');

      tracker.summary();
    });

    it('認証なしでアクセスできない', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('認証テスト開始');

      // 認証なしプロジェクト作成（401エラー）
      tracker.setOperation('未認証アクセステスト');
      await request(await createTestUserWithToken.getApp())
        .post('/api/projects/create')
        .send({ url: testData.testUrl })
        .expect(401);
      tracker.mark('作成拒否確認');

      // 認証なしプロジェクト一覧（401エラー）
      await request(await createTestUserWithToken.getApp())
        .get('/api/projects')
        .expect(401);
      tracker.mark('一覧拒否確認');

      tracker.summary();
    });
  });

  describe('バリデーションテスト', () => {
    beforeEach(async () => {
      const authResult = await createTestUserWithToken.getValidAuthToken(testData.userEmail);
      authToken = authResult.token;
    });

    it('無効なURLでプロジェクト作成がエラーになる', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('バリデーションテスト開始');

      // 無効なURL形式
      tracker.setOperation('無効URL形式テスト');
      await request(await createTestUserWithToken.getApp())
        .post('/api/projects/create')
        .set('Cookie', `authToken=${authToken}`)
        .send({ url: 'invalid-url' })
        .expect(400);
      tracker.mark('無効URL拒否確認');

      // URL未指定
      tracker.setOperation('URL未指定テスト');
      await request(await createTestUserWithToken.getApp())
        .post('/api/projects/create')
        .set('Cookie', `authToken=${authToken}`)
        .send({ name: 'Test Project' })
        .expect(400);
      tracker.mark('URL必須確認');

      tracker.summary();
    });

    it('存在しないプロジェクトIDで404エラーになる', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('存在しないID テスト開始');

      const nonExistentId = 'non-existent-project-id';

      tracker.setOperation('存在しないID アクセステスト');
      await request(await createTestUserWithToken.getApp())
        .get(`/api/projects/${nonExistentId}`)
        .set('Cookie', `authToken=${authToken}`)
        .expect(404);
      tracker.mark('404エラー確認');

      tracker.summary();
    });
  });

  describe('ヘルスチェック', () => {
    it('プロジェクト管理サービスのヘルスチェックが正常に動作する', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('ヘルスチェック開始');

      const response = await request(await createTestUserWithToken.getApp())
        .get('/api/projects/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.service).toBe('プロジェクト管理');
      expect(response.body.data.status).toBe('healthy');
      tracker.mark('ヘルスチェック完了');

      tracker.summary();
    });
  });
});