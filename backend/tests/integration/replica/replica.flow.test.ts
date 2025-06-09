/**
 * レプリカ管理機能 - 統合テスト
 * 
 * 実データを使用した完全なレプリカ管理フローのテスト
 * プロジェクトAPIと連携した実際のレプリカAPIテスト
 */

import request from 'supertest';
import { MilestoneTracker } from '../../utils/MilestoneTracker';
import { createTestUserWithToken } from '../../utils/test-auth-helper';
import { API_PATHS } from '../../../src/types';
import { app } from '../../../src/app';

// テスト用の一意データ生成
function generateUniqueTestData() {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  return {
    projectName: `Replica Test Project ${uniqueId}`,
    testUrl: `https://example-${uniqueId}.com`,
    userEmail: `replica-test-${uniqueId}@example.com`,
    replicaHtml: `<html>
      <head><title>Test Replica ${uniqueId}</title></head>
      <body>
        <h1>Test Content ${uniqueId}</h1>
        <p>This is a test replica created at ${new Date().toISOString()}</p>
      </body>
    </html>`,
    replicaCss: `body {
      font-family: Arial, sans-serif;
      margin: 20px;
      background: #f0f0f0;
    }
    h1 {
      color: #333;
      text-decoration: underline;
    }`,
    updatedHtml: `<html>
      <head><title>Updated Replica ${uniqueId}</title></head>
      <body>
        <h1>Updated Content ${uniqueId}</h1>
        <p>This replica was updated at ${new Date().toISOString()}</p>
      </body>
    </html>`,
    assetData: {
      originalUrl: `https://example.com/images/logo-${uniqueId}.png`,
      localPath: `/storage/projects/test-${uniqueId}/assets/logo.png`,
      mimeType: 'image/png',
      size: 12345
    }
  };
}

describe('レプリカ管理API統合テスト', () => {
  let testData: ReturnType<typeof generateUniqueTestData>;
  let authToken: string;
  let projectId: string;

  beforeEach(async () => {
    // 各テスト用のユニークデータ生成
    testData = generateUniqueTestData();
  });

  afterEach(async () => {
    // テスト後のクリーンアップ（必要に応じて）
    // 実際の環境ではデータは削除しない
  });

  describe('完全なレプリカ管理フロー', () => {
    it('プロジェクト作成からレプリカ取得、更新まで一連のフローが正常に動作する', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('テスト開始');

      // ステップ1: テスト用ユーザーで認証
      tracker.setOperation('認証トークン取得');
      const authResult = await createTestUserWithToken.getValidAuthToken(testData.userEmail);
      authToken = authResult.token;
      tracker.mark('認証完了');

      // ステップ2: プロジェクト作成
      tracker.setOperation('プロジェクト作成');
      const createResponse = await request(app)
        .post(API_PATHS.PROJECTS.CREATE)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: testData.testUrl,
          name: testData.projectName
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data.projectId).toBeDefined();
      projectId = createResponse.body.data.projectId;
      tracker.mark('プロジェクト作成完了');

      // ステップ3: レプリカデータを作成（内部的にサービスを直接呼び出し）
      tracker.setOperation('レプリカデータ作成');
      // 実際のシステムではPuppeteerがこれを行うが、テストでは直接作成
      const { replicaService } = await import('../../../src/features/replica/replica.service.js');
      await replicaService.createReplica(projectId, testData.replicaHtml, testData.replicaCss);
      tracker.mark('レプリカデータ作成完了');

      // ステップ4: レプリカ取得
      tracker.setOperation('レプリカ取得');
      const getReplicaResponse = await request(app)
        .get(API_PATHS.REPLICA.GET(projectId))
        .set('Authorization', `Bearer ${authToken}`);

      expect(getReplicaResponse.status).toBe(200);
      expect(getReplicaResponse.body.success).toBe(true);
      expect(getReplicaResponse.body.data).toBeDefined();
      expect(getReplicaResponse.body.data.projectId).toBe(projectId);
      expect(getReplicaResponse.body.data.html).toBe(testData.replicaHtml);
      expect(getReplicaResponse.body.data.css).toBe(testData.replicaCss);
      tracker.mark('レプリカ取得完了');

      // ステップ5: アセット追加
      tracker.setOperation('アセット追加');
      await replicaService.addAssetToReplica(projectId, testData.assetData);
      tracker.mark('アセット追加完了');

      // ステップ6: アセット一覧取得
      tracker.setOperation('アセット一覧取得');
      const getAssetsResponse = await request(app)
        .get(`${API_PATHS.PROJECTS.BASE}/${projectId}/replica/assets`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getAssetsResponse.status).toBe(200);
      expect(getAssetsResponse.body.success).toBe(true);
      expect(getAssetsResponse.body.data).toBeInstanceOf(Array);
      expect(getAssetsResponse.body.data.length).toBe(1);
      expect(getAssetsResponse.body.data[0].originalUrl).toBe(testData.assetData.originalUrl);
      expect(getAssetsResponse.body.meta.count).toBe(1);
      expect(getAssetsResponse.body.meta.totalSize).toBe(testData.assetData.size);
      tracker.mark('アセット一覧取得完了');

      // ステップ7: レプリカ更新
      tracker.setOperation('レプリカ更新');
      const updateResponse = await request(app)
        .put(API_PATHS.REPLICA.UPDATE(projectId))
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          html: testData.updatedHtml
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.html).toBe(testData.updatedHtml);
      expect(updateResponse.body.data.css).toBe(testData.replicaCss); // CSSは変更なし
      tracker.mark('レプリカ更新完了');

      // 結果サマリー
      tracker.summary();
    });
  });

  describe('エラーケースとバリデーション', () => {
    it('認証なしでレプリカ取得を試みるとエラーになる', async () => {
      const response = await request(app)
        .get(API_PATHS.REPLICA.GET('project_123'));

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('認証');
    });

    it('存在しないプロジェクトのレプリカ取得を試みるとエラーになる', async () => {
      const tracker = new MilestoneTracker();
      
      // 認証
      tracker.setOperation('認証');
      const authResult = await createTestUserWithToken.getValidAuthToken(testData.userEmail);
      authToken = authResult.token;
      tracker.mark('認証完了');

      // 存在しないプロジェクトIDでアクセス（有効なUUID形式）
      tracker.setOperation('レプリカ取得（存在しないプロジェクト）');
      const nonExistentProjectId = '99999999-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(API_PATHS.REPLICA.GET(nonExistentProjectId))
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('プロジェクトが見つかりません');
      tracker.mark('エラー確認完了');

      tracker.summary();
    });

    it('他のユーザーのプロジェクトのレプリカにアクセスできない', async () => {
      const tracker = new MilestoneTracker();
      
      // ユーザー1で認証とプロジェクト作成
      tracker.setOperation('ユーザー1認証とプロジェクト作成');
      const user1Auth = await createTestUserWithToken.getValidAuthToken(`user1-${testData.userEmail}`);
      const createResponse = await request(app)
        .post(API_PATHS.PROJECTS.CREATE)
        .set('Authorization', `Bearer ${user1Auth.token}`)
        .send({
          url: testData.testUrl,
          name: testData.projectName
        });
      
      const user1ProjectId = createResponse.body.data.projectId;
      tracker.mark('ユーザー1プロジェクト作成完了');

      // レプリカ作成
      const { replicaService } = await import('../../../src/features/replica/replica.service.js');
      await replicaService.createReplica(user1ProjectId, testData.replicaHtml, testData.replicaCss);

      // ユーザー2で認証
      tracker.setOperation('ユーザー2認証');
      const user2Auth = await createTestUserWithToken.getValidAuthToken(`user2-${testData.userEmail}`);
      tracker.mark('ユーザー2認証完了');

      // ユーザー2がユーザー1のレプリカにアクセス
      tracker.setOperation('アクセス権限チェック');
      const response = await request(app)
        .get(API_PATHS.REPLICA.GET(user1ProjectId))
        .set('Authorization', `Bearer ${user2Auth.token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('アクセス権限');
      tracker.mark('アクセス拒否確認完了');

      tracker.summary();
    });

    it('レプリカがまだ作成中の場合は適切なメッセージを返す', async () => {
      const tracker = new MilestoneTracker();
      
      // 認証とプロジェクト作成
      tracker.setOperation('認証とプロジェクト作成');
      const authResult = await createTestUserWithToken.getValidAuthToken(testData.userEmail);
      authToken = authResult.token;
      
      const createResponse = await request(app)
        .post(API_PATHS.PROJECTS.CREATE)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: testData.testUrl,
          name: testData.projectName
        });
      
      projectId = createResponse.body.data.projectId;
      tracker.mark('プロジェクト作成完了');

      // レプリカ作成前にアクセス（ステータスはCREATING）
      tracker.setOperation('作成中レプリカへのアクセス');
      const response = await request(app)
        .get(API_PATHS.REPLICA.GET(projectId))
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('レプリカはまだ作成中');
      tracker.mark('作成中メッセージ確認完了');

      tracker.summary();
    });
  });

  describe('レプリカ更新の詳細テスト', () => {
    beforeEach(async () => {
      // 共通のセットアップ：認証、プロジェクト作成、レプリカ作成
      const authResult = await createTestUserWithToken.getValidAuthToken(testData.userEmail);
      authToken = authResult.token;

      const createResponse = await request(app)
        .post(API_PATHS.PROJECTS.CREATE)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: testData.testUrl,
          name: testData.projectName
        });
      
      projectId = createResponse.body.data.projectId;

      // レプリカ作成
      const { replicaService } = await import('../../../src/features/replica/replica.service.js');
      await replicaService.createReplica(projectId, testData.replicaHtml, testData.replicaCss);
    });

    it('HTMLのみを更新できる', async () => {
      const response = await request(app)
        .put(API_PATHS.REPLICA.UPDATE(projectId))
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          html: testData.updatedHtml
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.html).toBe(testData.updatedHtml);
      expect(response.body.data.css).toBe(testData.replicaCss); // CSSは変更なし
    });

    it('CSSのみを更新できる', async () => {
      const newCss = 'body { background: #fff; color: #000; }';
      const response = await request(app)
        .put(API_PATHS.REPLICA.UPDATE(projectId))
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          css: newCss
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.html).toBe(testData.replicaHtml); // HTMLは変更なし
      expect(response.body.data.css).toBe(newCss);
    });

    it('HTMLとCSSを同時に更新できる', async () => {
      const newCss = 'body { background: #000; color: #fff; }';
      const response = await request(app)
        .put(API_PATHS.REPLICA.UPDATE(projectId))
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          html: testData.updatedHtml,
          css: newCss
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.html).toBe(testData.updatedHtml);
      expect(response.body.data.css).toBe(newCss);
    });

    it('更新データが空の場合はエラーになる', async () => {
      const response = await request(app)
        .put(API_PATHS.REPLICA.UPDATE(projectId))
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('更新するデータを指定');
    });
  });
});