/**
 * 要素編集関連 統合テスト
 * 
 * 要素コンテキスト作成から編集バリエーション取得までの完全なフローをテスト
 * 実データ主義に基づき、モックは一切使用しない
 */

import request from 'supertest';
import { app } from '../../../src/app';
import { MilestoneTracker } from '../../utils/MilestoneTracker';
import { createTestUserWithToken, cleanupAuthTestEnvironment } from '../../utils/test-auth-helper';
import { ElementContextRequest, API_PATHS } from '../../../src/types';

describe('要素編集関連 統合テスト', () => {
  let authToken: string;
  let testProjectId: string;

  beforeEach(async () => {
    // 認証テスト環境をクリーンアップ
    await cleanupAuthTestEnvironment();
    
    // 認証トークンとテストユーザーを取得
    const authResult = await createTestUserWithToken();
    authToken = authResult.token;

    // テスト用プロジェクトを作成
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const projectResponse = await request(app)
      .post('/api/projects/create')
      .set('Cookie', `authToken=${authToken}`)
      .send({
        url: `https://example-${uniqueId}.com`,
        name: `テストプロジェクト-${uniqueId}`
      });

    console.log('Project Creation Response:', {
      status: projectResponse.status,
      body: projectResponse.body
    });
    
    expect(projectResponse.status).toBe(201);
    testProjectId = projectResponse.body.data.projectId;

    // プロジェクトがREADY状態になるまで待機（簡易実装）
    let attempts = 0;
    while (attempts < 10) {
      const statusResponse = await request(app)
        .get(`/api/projects/${testProjectId}/status`)
        .set('Cookie', `authToken=${authToken}`);
      
      if (statusResponse.body.data?.status === 'READY') {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }
  });

  afterEach(async () => {
    // テストプロジェクトを削除
    if (testProjectId) {
      await request(app)
        .delete(`/api/projects/${testProjectId}`)
        .set('Cookie', `authToken=${authToken}`);
    }
  });

  describe('要素コンテキスト作成フロー', () => {
    it('有効な要素情報で要素コンテキストを正常に作成できる', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('テスト開始');

      tracker.setOperation('要素コンテキスト作成');
      const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      const elementRequest: ElementContextRequest = {
        projectId: testProjectId,
        element: {
          selector: `#test-element-${uniqueId}`,
          tagName: 'div',
          text: 'テスト要素のテキスト内容',
          html: `<div id="test-element-${uniqueId}">テスト要素のテキスト内容</div>`,
          styles: {
            color: '#333333',
            backgroundColor: '#ffffff',
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif'
          }
        }
      };

      const response = await request(app)
        .post(API_PATHS.ELEMENT.CONTEXT)
        .set('Cookie', `authToken=${authToken}`)
        .send(elementRequest);

      tracker.mark('API レスポンス受信');

      // デバッグ情報を出力
      console.log('Element Context API Response:', {
        status: response.status,
        headers: response.headers,
        body: response.body
      });

      // レスポンス検証
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('contextId');
      expect(response.body.data).toHaveProperty('message');
      expect(response.body.data.contextId).toMatch(/^[0-9a-f-]{36}$/); // UUID形式
      expect(response.body.data.message).toContain('要素詳細');
      expect(response.body.data.message).toContain(elementRequest.element.selector);

      tracker.mark('レスポンス検証完了');

      // データベース確認（要素コンテキスト履歴から確認）
      tracker.setOperation('データベース確認');
      const historyResponse = await request(app)
        .get(`/api/element/context/history/${testProjectId}`)
        .set('Cookie', `authToken=${authToken}`);

      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body.success).toBe(true);
      expect(historyResponse.body.data).toHaveLength(1);
      expect(historyResponse.body.data[0].element.selector).toBe(elementRequest.element.selector);

      tracker.mark('データベース確認完了');
      tracker.summary();
    });

    it('バリデーションエラーが適切に処理される', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('バリデーションテスト開始');

      // 不正なプロジェクトIDでテスト
      tracker.setOperation('不正プロジェクトIDテスト');
      const invalidRequest = {
        projectId: 'invalid-project-id',
        element: {
          selector: '#test',
          tagName: 'div',
          text: 'test',
          html: '<div>test</div>',
          styles: {
            color: '#000',
            backgroundColor: '#fff',
            fontSize: '16px',
            fontFamily: 'Arial'
          }
        }
      };

      const response = await request(app)
        .post(API_PATHS.ELEMENT.CONTEXT)
        .set('Cookie', `authToken=${authToken}`)
        .send(invalidRequest);

      tracker.mark('レスポンス受信');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('不正');

      tracker.mark('バリデーションテスト完了');
      tracker.summary();
    });
  });

  describe('編集バリエーション取得フロー', () => {
    it('有効なセレクタで編集バリエーションを正常に取得できる', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('バリエーションテスト開始');

      tracker.setOperation('編集バリエーション取得');
      const elementSelector = '#main-title';
      
      const response = await request(app)
        .get(API_PATHS.ELEMENT.VARIATIONS(testProjectId))
        .query({ selector: elementSelector })
        .set('Cookie', `authToken=${authToken}`);

      tracker.mark('API レスポンス受信');

      // レスポンス検証
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);

      // バリエーションデータの構造検証
      const variation = response.body.data[0];
      expect(variation).toHaveProperty('id');
      expect(variation).toHaveProperty('elementSelector');
      expect(variation).toHaveProperty('content');
      expect(variation).toHaveProperty('preview');
      expect(variation).toHaveProperty('selected');
      expect(variation.elementSelector).toBe(elementSelector);

      tracker.mark('バリエーション検証完了');
      tracker.summary();
    });

    it('セレクタパラメータ不足時にエラーが返される', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('セレクタエラーテスト開始');

      tracker.setOperation('セレクタなしリクエスト');
      const response = await request(app)
        .get(API_PATHS.ELEMENT.VARIATIONS(testProjectId))
        .set('Cookie', `authToken=${authToken}`);

      tracker.mark('レスポンス受信');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('セレクタパラメータが必要');

      tracker.mark('セレクタエラーテスト完了');
      tracker.summary();
    });
  });

  describe('完全な要素編集フロー', () => {
    it('要素コンテキスト作成から編集バリエーション取得まで一貫して動作する', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('完全フローテスト開始');

      const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const elementSelector = `#hero-title-${uniqueId}`;

      // Step 1: 要素コンテキスト作成
      tracker.setOperation('要素コンテキスト作成');
      const contextRequest: ElementContextRequest = {
        projectId: testProjectId,
        element: {
          selector: elementSelector,
          tagName: 'h1',
          text: 'メインタイトル',
          html: `<h1 id="hero-title-${uniqueId}">メインタイトル</h1>`,
          styles: {
            color: '#2563eb',
            backgroundColor: 'transparent',
            fontSize: '32px',
            fontFamily: 'Helvetica, Arial, sans-serif'
          }
        }
      };

      const contextResponse = await request(app)
        .post(API_PATHS.ELEMENT.CONTEXT)
        .set('Cookie', `authToken=${authToken}`)
        .send(contextRequest);

      expect(contextResponse.status).toBe(201);
      expect(contextResponse.body.success).toBe(true);
      
      const contextId = contextResponse.body.data.contextId;
      tracker.mark('要素コンテキスト作成完了');

      // Step 2: 編集バリエーション取得
      tracker.setOperation('編集バリエーション取得');
      const variationsResponse = await request(app)
        .get(API_PATHS.ELEMENT.VARIATIONS(testProjectId))
        .query({ selector: elementSelector })
        .set('Cookie', `authToken=${authToken}`);

      expect(variationsResponse.status).toBe(200);
      expect(variationsResponse.body.success).toBe(true);
      expect(variationsResponse.body.data.length).toBeGreaterThan(0);

      tracker.mark('編集バリエーション取得完了');

      // Step 3: コンテキスト履歴確認
      tracker.setOperation('コンテキスト履歴確認');
      const historyResponse = await request(app)
        .get(`/api/element/context/history/${testProjectId}`)
        .set('Cookie', `authToken=${authToken}`);

      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body.success).toBe(true);
      expect(historyResponse.body.data.length).toBeGreaterThan(0);

      // 作成したコンテキストが履歴に含まれていることを確認
      const createdContext = historyResponse.body.data.find(
        (ctx: any) => ctx.id === contextId
      );
      expect(createdContext).toBeDefined();
      expect(createdContext.element.selector).toBe(elementSelector);

      tracker.mark('コンテキスト履歴確認完了');

      tracker.summary();
    });
  });

  describe('権限とセキュリティ', () => {
    it('認証なしでのアクセスが拒否される', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('セキュリティテスト開始');

      tracker.setOperation('認証なしアクセステスト');
      const elementRequest: ElementContextRequest = {
        projectId: testProjectId,
        element: {
          selector: '#test',
          tagName: 'div',
          text: 'test',
          html: '<div>test</div>',
          styles: {
            color: '#000',
            backgroundColor: '#fff',
            fontSize: '16px',
            fontFamily: 'Arial'
          }
        }
      };

      const response = await request(app)
        .post(API_PATHS.ELEMENT.CONTEXT)
        .send(elementRequest);

      tracker.mark('レスポンス受信');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('認証');

      tracker.mark('セキュリティテスト完了');
      tracker.summary();
    });

    it('他のユーザーのプロジェクトにアクセスできない', async () => {
      const tracker = new MilestoneTracker();
      tracker.mark('アクセス権限テスト開始');

      // 別のユーザーの認証トークンを取得
      tracker.setOperation('別ユーザー認証');
      const anotherAuthResult = await createTestUserWithToken();
      const anotherToken = anotherAuthResult.token;

      tracker.mark('別ユーザー認証完了');

      tracker.setOperation('他ユーザープロジェクトアクセス');
      const elementRequest: ElementContextRequest = {
        projectId: testProjectId, // 元のユーザーのプロジェクト
        element: {
          selector: '#test',
          tagName: 'div',
          text: 'test',
          html: '<div>test</div>',
          styles: {
            color: '#000',
            backgroundColor: '#fff',
            fontSize: '16px',
            fontFamily: 'Arial'
          }
        }
      };

      const response = await request(app)
        .post(API_PATHS.ELEMENT.CONTEXT)
        .set('Cookie', `authToken=${anotherToken}`)
        .send(elementRequest);

      tracker.mark('レスポンス受信');

      expect(response.status).toBe(500); // プロジェクトが見つからないエラー
      expect(response.body.success).toBe(false);

      tracker.mark('アクセス権限テスト完了');
      tracker.summary();
    });
  });
});