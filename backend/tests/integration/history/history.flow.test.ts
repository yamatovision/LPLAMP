/**
 * 履歴管理機能 - 統合テスト
 * 
 * 履歴管理APIの統合テストを実施
 * 実際のデータベースと環境変数を使用してテスト
 */

import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { 
  History,
  HistoryType,
  HistorySnapshot,
  PaginatedResponse,
  ElementInfo,
  ElementStyles
} from '../../../src/types';
import { 
  createTestUserWithToken, 
  setupAuthTestEnvironment,
  cleanupAuthTestEnvironment,
  validateApiResponse,
  testAuthRequiredEndpoint
} from '../../utils/test-auth-helper';
import { MilestoneTracker } from '../../utils/MilestoneTracker';
import { projectRepository } from '../../../src/features/projects/projects.model';
import { replicaRepository } from '../../../src/features/replica/replica.model';
import { historyModel } from '../../../src/features/history/history.model';

// Express アプリケーションインスタンス
let app: any;

describe('履歴管理API統合テスト', () => {
  let tracker: MilestoneTracker;

  beforeAll(async () => {
    tracker = new MilestoneTracker();
    tracker.mark('テスト開始');
    
    // 認証テスト環境の初期化
    await setupAuthTestEnvironment();
    
    // Expressアプリケーションの取得
    app = await createTestUserWithToken.getApp();
    
    tracker.mark('環境設定完了');
  });

  beforeEach(async () => {
    // 各テスト前にデータをクリア
    if ('clearAll' in projectRepository && typeof projectRepository.clearAll === 'function') {
      await (projectRepository as any).clearAll();
    }
    await replicaRepository.clear();
    historyModel['store'] = {};
  });

  afterEach(async () => {
    // 各テスト後にクリーンアップ
    await cleanupAuthTestEnvironment();
  });

  /**
   * 履歴作成テスト（POST /api/projects/:id/history）
   */
  describe('POST /api/projects/:id/history - 履歴作成', () => {
    it('正常に履歴を作成できる', async () => {
      tracker.setOperation('履歴作成テスト');
      
      // テストユーザーとプロジェクトを作成
      const { user, authHeader } = await createTestUserWithToken();
      const project = await projectRepository.create({
        url: 'https://example.com',
        name: `Test Project ${Date.now()}`,
        userId: user.id
      });
      
      // レプリカを作成
      await replicaRepository.create(
        project.id,
        '<html><body>Original content</body></html>',
        'body { color: black; }'
      );
      
      tracker.mark('テストデータ準備完了');

      // 履歴作成リクエスト
      const historyData = {
        description: 'テスト編集履歴',
        snapshot: {
          html: '<html><body>Updated content</body></html>',
          changedElements: [{
            selector: 'body',
            tagName: 'body',
            text: 'Updated content',
            html: '<body>Updated content</body>',
            styles: {
              color: 'black',
              backgroundColor: 'white',
              fontSize: '16px',
              fontFamily: 'Arial'
            } as ElementStyles
          }] as ElementInfo[]
        } as HistorySnapshot,
        type: HistoryType.EDIT
      };

      const response = await request(app)
        .post(`/api/projects/${project.id}/history`)
        .set(authHeader)
        .send(historyData);

      tracker.mark('履歴作成API呼び出し完了');

      // レスポンス検証
      expect(response.status).toBe(201);
      validateApiResponse(response.body, true);
      
      const createdHistory = response.body.data as History;
      expect(createdHistory).toMatchObject({
        projectId: project.id,
        description: historyData.description,
        type: HistoryType.EDIT,
        snapshot: historyData.snapshot
      });
      expect(createdHistory.id).toBeTruthy();
      expect(createdHistory.createdAt).toBeTruthy();
      expect(createdHistory.updatedAt).toBeTruthy();

      tracker.mark('履歴作成テスト完了');
    });

    it('無効なスナップショットで失敗する', async () => {
      const { user, authHeader } = await createTestUserWithToken();
      const project = await projectRepository.create({
        url: 'https://example.com',
        name: `Test Project ${Date.now()}`,
        userId: user.id
      });

      const invalidHistoryData = {
        description: 'テスト編集履歴',
        snapshot: {
          // htmlが欠けている
          changedElements: []
        },
        type: HistoryType.EDIT
      };

      const response = await request(app)
        .post(`/api/projects/${project.id}/history`)
        .set(authHeader)
        .send(invalidHistoryData);

      expect(response.status).toBe(400);
      validateApiResponse(response.body, false);
      expect(response.body.error).toContain('スナップショットにHTMLが必要です');
    });

    it('他のユーザーのプロジェクトには作成できない', async () => {
      const { user: user1 } = await createTestUserWithToken();
      const { authHeader: authHeader2 } = await createTestUserWithToken();
      
      const project = await projectRepository.create({
        url: 'https://example.com',
        name: `Test Project ${Date.now()}`,
        userId: user1.id
      });

      const historyData = {
        description: 'テスト編集履歴',
        snapshot: {
          html: '<html><body>Test</body></html>',
          changedElements: []
        },
        type: HistoryType.EDIT
      };

      const response = await request(app)
        .post(`/api/projects/${project.id}/history`)
        .set(authHeader2)
        .send(historyData);

      expect(response.status).toBe(403);
      validateApiResponse(response.body, false);
    });

    it('認証が必要', async () => {
      await testAuthRequiredEndpoint(request(app), 'post', '/api/projects/test-id/history');
    });
  });

  /**
   * 履歴一覧取得テスト（GET /api/projects/:id/history）
   */
  describe('GET /api/projects/:id/history - 履歴一覧取得', () => {
    it('履歴一覧を取得できる', async () => {
      tracker.setOperation('履歴一覧取得テスト');
      
      const { user, authHeader } = await createTestUserWithToken();
      const project = await projectRepository.create({
        url: 'https://example.com',
        name: `Test Project ${Date.now()}`,
        userId: user.id
      });

      // 複数の履歴を作成
      const historyCount = 5;
      for (let i = 0; i < historyCount; i++) {
        await historyModel.create(
          project.id,
          `テスト履歴 ${i + 1}`,
          {
            html: `<html><body>Content ${i + 1}</body></html>`,
            changedElements: []
          },
          HistoryType.EDIT
        );
      }

      tracker.mark('テスト履歴作成完了');

      const response = await request(app)
        .get(`/api/projects/${project.id}/history`)
        .set(authHeader);

      tracker.mark('履歴一覧取得API呼び出し完了');

      expect(response.status).toBe(200);
      validateApiResponse(response.body, true);

      const paginatedData = response.body.data as PaginatedResponse<History>;
      expect(paginatedData.items).toHaveLength(historyCount);
      expect(paginatedData.total).toBe(historyCount);
      expect(paginatedData.page).toBe(1);
      expect(paginatedData.limit).toBe(20);
      expect(paginatedData.hasMore).toBe(false);

      // 新しい順にソートされているか確認
      for (let i = 0; i < paginatedData.items.length - 1; i++) {
        const currentItem = paginatedData.items[i];
        const nextItem = paginatedData.items[i + 1];
        if (currentItem && nextItem) {
          const current = new Date(currentItem.createdAt).getTime();
          const next = new Date(nextItem.createdAt).getTime();
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }

      tracker.mark('履歴一覧取得テスト完了');
    });

    it('ページネーションが機能する', async () => {
      const { user, authHeader } = await createTestUserWithToken();
      const project = await projectRepository.create({
        url: 'https://example.com',
        name: `Test Project ${Date.now()}`,
        userId: user.id
      });

      // 15件の履歴を作成
      for (let i = 0; i < 15; i++) {
        await historyModel.create(
          project.id,
          `テスト履歴 ${i + 1}`,
          {
            html: `<html><body>Content ${i + 1}</body></html>`,
            changedElements: []
          },
          HistoryType.EDIT
        );
      }

      // ページ1を取得（limit=10）
      const response1 = await request(app)
        .get(`/api/projects/${project.id}/history?page=1&limit=10`)
        .set(authHeader);

      expect(response1.status).toBe(200);
      const page1Data = response1.body.data as PaginatedResponse<History>;
      expect(page1Data.items).toHaveLength(10);
      expect(page1Data.hasMore).toBe(true);

      // ページ2を取得
      const response2 = await request(app)
        .get(`/api/projects/${project.id}/history?page=2&limit=10`)
        .set(authHeader);

      expect(response2.status).toBe(200);
      const page2Data = response2.body.data as PaginatedResponse<History>;
      expect(page2Data.items).toHaveLength(5);
      expect(page2Data.hasMore).toBe(false);
    });

    it('認証が必要', async () => {
      await testAuthRequiredEndpoint(request(app), 'get', '/api/projects/test-id/history');
    });
  });

  /**
   * 特定履歴取得テスト（GET /api/projects/:id/history/:historyId）
   */
  describe('GET /api/projects/:id/history/:historyId - 特定履歴の詳細取得', () => {
    it('特定の履歴を取得できる', async () => {
      tracker.setOperation('特定履歴取得テスト');
      
      const { user, authHeader } = await createTestUserWithToken();
      const project = await projectRepository.create({
        url: 'https://example.com',
        name: `Test Project ${Date.now()}`,
        userId: user.id
      });

      const history = await historyModel.create(
        project.id,
        'テスト履歴',
        {
          html: '<html><body>Test content</body></html>',
          changedElements: [{
            selector: 'body',
            tagName: 'body',
            text: 'Test content',
            html: '<body>Test content</body>',
            styles: {
              color: 'black',
              backgroundColor: 'white',
              fontSize: '16px',
              fontFamily: 'Arial'
            }
          }]
        },
        HistoryType.EDIT
      );

      tracker.mark('テスト履歴作成完了');

      const response = await request(app)
        .get(`/api/projects/${project.id}/history/${history.id}`)
        .set(authHeader);

      tracker.mark('特定履歴取得API呼び出し完了');

      expect(response.status).toBe(200);
      validateApiResponse(response.body, true);

      const retrievedHistory = response.body.data as History;
      expect(retrievedHistory).toMatchObject({
        id: history.id,
        projectId: project.id,
        description: history.description,
        type: history.type,
        snapshot: history.snapshot
      });

      tracker.mark('特定履歴取得テスト完了');
    });

    it('存在しない履歴はエラーになる', async () => {
      const { user, authHeader } = await createTestUserWithToken();
      const project = await projectRepository.create({
        url: 'https://example.com',
        name: `Test Project ${Date.now()}`,
        userId: user.id
      });

      const response = await request(app)
        .get(`/api/projects/${project.id}/history/non-existent-id`)
        .set(authHeader);

      expect(response.status).toBe(404);
      validateApiResponse(response.body, false);
    });

    it('認証が必要', async () => {
      await testAuthRequiredEndpoint(request(app), 'get', '/api/projects/test-id/history/test-history-id');
    });
  });

  /**
   * 履歴復元テスト（POST /api/projects/:id/history/:historyId/restore）
   */
  describe('POST /api/projects/:id/history/:historyId/restore - 履歴から復元', () => {
    it('履歴から正常に復元できる', async () => {
      tracker.setOperation('履歴復元テスト');
      
      const { user, authHeader } = await createTestUserWithToken();
      const project = await projectRepository.create({
        url: 'https://example.com',
        name: `Test Project ${Date.now()}`,
        userId: user.id
      });

      // 初期レプリカを作成
      const originalHtml = '<html><body>Original content</body></html>';
      await replicaRepository.create(
        project.id,
        originalHtml,
        'body { color: black; }'
      );

      // 履歴を作成
      const historyHtml = '<html><body>Previous version</body></html>';
      const history = await historyModel.create(
        project.id,
        '過去のバージョン',
        {
          html: historyHtml,
          changedElements: []
        },
        HistoryType.EDIT
      );

      tracker.mark('テストデータ準備完了');

      // 復元実行
      const response = await request(app)
        .post(`/api/projects/${project.id}/history/${history.id}/restore`)
        .set(authHeader);

      tracker.mark('履歴復元API呼び出し完了');

      expect(response.status).toBe(200);
      validateApiResponse(response.body, true);

      // レプリカが更新されているか確認
      const updatedReplica = await replicaRepository.findByProjectId(project.id);
      expect(updatedReplica?.html).toBe(historyHtml);

      // 復元履歴が作成されているか確認
      const histories = await historyModel.findByProjectId(project.id);
      const revertHistories = histories.filter(h => h.type === HistoryType.REVERT);
      expect(revertHistories).toHaveLength(2); // 復元前と復元後の2つ

      tracker.mark('履歴復元テスト完了');
    });

    it('存在しない履歴からの復元はエラーになる', async () => {
      const { user, authHeader } = await createTestUserWithToken();
      const project = await projectRepository.create({
        url: 'https://example.com',
        name: `Test Project ${Date.now()}`,
        userId: user.id
      });

      const response = await request(app)
        .post(`/api/projects/${project.id}/history/non-existent-id/restore`)
        .set(authHeader);

      expect(response.status).toBe(404);
      validateApiResponse(response.body, false);
    });

    it('レプリカが存在しない場合はエラーになる', async () => {
      const { user, authHeader } = await createTestUserWithToken();
      const project = await projectRepository.create({
        url: 'https://example.com',
        name: `Test Project ${Date.now()}`,
        userId: user.id
      });

      const history = await historyModel.create(
        project.id,
        'テスト履歴',
        {
          html: '<html><body>Test</body></html>',
          changedElements: []
        },
        HistoryType.EDIT
      );

      const response = await request(app)
        .post(`/api/projects/${project.id}/history/${history.id}/restore`)
        .set(authHeader);

      expect(response.status).toBe(404);
      validateApiResponse(response.body, false);
      expect(response.body.error).toContain('レプリカが見つかりません');
    });

    it('認証が必要', async () => {
      await testAuthRequiredEndpoint(request(app), 'post', '/api/projects/test-id/history/test-history-id/restore');
    });
  });

  /**
   * 複雑なシナリオテスト
   */
  describe('複雑なシナリオテスト', () => {
    it('編集→履歴保存→復元の一連の流れが機能する', async () => {
      tracker.setOperation('複雑なシナリオテスト');
      
      const { user, authHeader } = await createTestUserWithToken();
      const project = await projectRepository.create({
        url: 'https://example.com',
        name: `Test Project ${Date.now()}`,
        userId: user.id
      });

      // 初期レプリカ
      const version1Html = '<html><body>Version 1</body></html>';
      await replicaRepository.create(
        project.id,
        version1Html,
        ''
      );

      // バージョン2を保存
      const version2Html = '<html><body>Version 2</body></html>';
      const history2Response = await request(app)
        .post(`/api/projects/${project.id}/history`)
        .set(authHeader)
        .send({
          description: 'バージョン2',
          snapshot: {
            html: version2Html,
            changedElements: []
          },
          type: HistoryType.EDIT
        });

      expect(history2Response.status).toBe(201);
      const history2 = history2Response.body.data as History;

      // レプリカを更新
      const replica2 = await replicaRepository.findByProjectId(project.id);
      if (replica2) {
        await replicaRepository.update(replica2.id, { html: version2Html });
      }

      // バージョン3を保存
      const version3Html = '<html><body>Version 3</body></html>';
      await request(app)
        .post(`/api/projects/${project.id}/history`)
        .set(authHeader)
        .send({
          description: 'バージョン3',
          snapshot: {
            html: version3Html,
            changedElements: []
          },
          type: HistoryType.EDIT
        });

      // レプリカを更新
      const replica3 = await replicaRepository.findByProjectId(project.id);
      if (replica3) {
        await replicaRepository.update(replica3.id, { html: version3Html });
      }

      // バージョン2に復元
      const restoreResponse = await request(app)
        .post(`/api/projects/${project.id}/history/${history2.id}/restore`)
        .set(authHeader);

      expect(restoreResponse.status).toBe(200);

      // レプリカがバージョン2に戻っているか確認
      const restoredReplica = await replicaRepository.findByProjectId(project.id);
      expect(restoredReplica?.html).toBe(version2Html);

      // 履歴一覧を確認
      const historyListResponse = await request(app)
        .get(`/api/projects/${project.id}/history`)
        .set(authHeader);

      const histories = historyListResponse.body.data as PaginatedResponse<History>;
      expect(histories.total).toBeGreaterThanOrEqual(4); // 初期作成 + 編集2回 + 復元履歴2つ

      tracker.mark('複雑なシナリオテスト完了');
      tracker.summary();
    });
  });
});