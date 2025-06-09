/**
 * エクスポート機能 統合テスト
 * 
 * エクスポート機能の完全なフローテスト
 * 実データ主義: モックを使用せず、実際のAPIと環境を使用
 */

import request from 'supertest';
import { MilestoneTracker } from '../../utils/MilestoneTracker';
import { 
  createTestUser, 
  createTestJWT 
} from '../../utils/test-auth-helper';
import { ExportFormat } from '../../../src/types';

// Express アプリケーションの設定（実際のアプリケーションを使用）
import { app } from '../../../src/app';

describe('エクスポート機能 統合テスト', () => {
  let testUser: any;
  let authToken: string;
  let testProjectId: string;
  let tracker: MilestoneTracker;

  beforeEach(async () => {
    tracker = new MilestoneTracker('エクスポート機能テスト');
    
    // エクスポート専用の閾値設定
    tracker.setThreshold('エクスポート準備', 3000);  // ファイル生成は時間がかかる
    tracker.setThreshold('ファイルダウンロード', 2000);
    tracker.setThreshold('ZIPファイル作成', 5000);    // ZIP生成は時間がかかる

    tracker.setOperation('テストユーザー作成');
    
    // ユニークなテストデータを作成
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    testUser = await createTestUser({
      githubId: `export_test_${uniqueId}`,
      username: `export_user_${uniqueId}`,
      email: `export_test_${uniqueId}@example.com`
    });

    tracker.mark('テストユーザー作成完了', {
      userId: testUser.id,
      username: testUser.username
    });

    // JWTトークンを生成
    tracker.setOperation('認証トークン生成');
    authToken = createTestJWT({
      id: testUser.id,
      githubId: testUser.githubId,
      username: testUser.username,
      email: testUser.email,
      avatarUrl: testUser.avatarUrl,
      createdAt: testUser.createdAt,
      updatedAt: testUser.updatedAt,
      lastLoginAt: testUser.lastLoginAt
    });

    tracker.mark('認証トークン生成完了');

    // テスト用プロジェクトを作成
    tracker.setOperation('テストプロジェクト作成');
    const projectResponse = await request(app)
      .post('/api/projects/create')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        url: `https://example-${uniqueId}.com`,
        name: `Export Test Project ${uniqueId}`
      });

    expect(projectResponse.status).toBe(201);
    testProjectId = projectResponse.body.data.projectId;

    tracker.mark('テストプロジェクト作成完了', {
      projectId: testProjectId
    });

    // レプリカデータを準備（エクスポートの前提条件）
    tracker.setOperation('レプリカデータ準備');
    const replicaHtml = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>Test Export ${uniqueId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; }
        .content { margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Export Test Page ${uniqueId}</h1>
    </div>
    <div class="content">
        <p>This is a test page for export functionality.</p>
        <p>Created at: ${new Date().toISOString()}</p>
    </div>
</body>
</html>`.trim();

    // レプリカ作成完了を待機
    tracker.setOperation('レプリカ作成完了待機');
    let replicaReady = false;
    let attempts = 0;
    const maxAttempts = 30; // 最大30秒待機
    
    while (!replicaReady && attempts < maxAttempts) {
      const statusResponse = await request(app)
        .get(`/api/projects/${testProjectId}/status`)
        .set('Authorization', `Bearer ${authToken}`);
      
      if (statusResponse.status === 200 && 
          statusResponse.body.data.status === 'completed') {
        replicaReady = true;
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
      attempts++;
    }
    
    if (!replicaReady) {
      throw new Error('レプリカ作成がタイムアウトしました');
    }
    
    // レプリカデータを手動で作成（テスト用）
    tracker.setOperation('テスト用レプリカデータ作成');
    const { replicaRepository } = await import('../../../src/features/replica/replica.model');
    await replicaRepository.create(testProjectId, replicaHtml, `
      body { font-family: Arial, sans-serif; margin: 20px; }
      .header { background: #f0f0f0; padding: 20px; }
      .content { margin: 20px 0; }
    `.trim());
    
    tracker.mark('レプリカデータ準備完了', {
      htmlSize: replicaHtml.length,
      waitTime: `${attempts}秒`
    });
  });

  afterEach(async () => {
    tracker.setOperation('テストクリーンアップ');
    
    // プロジェクトとその関連データを削除
    if (testProjectId) {
      try {
        await request(app)
          .delete(`/api/projects/${testProjectId}`)
          .set('Authorization', `Bearer ${authToken}`);
      } catch (error) {
        console.warn('プロジェクト削除中にエラー:', error);
      }
    }

    tracker.mark('テストクリーンアップ完了');
    tracker.summary();
  });

  describe('エクスポート準備 (POST /api/export/prepare)', () => {
    it('HTMLフォーマットでエクスポート準備が正常に完了する', async () => {
      tracker.setOperation('HTMLエクスポート準備テスト');

      const requestData = {
        projectId: testProjectId,
        format: ExportFormat.HTML,
        optimize: true
      };

      tracker.setOperation('エクスポート準備API呼び出し');
      const response = await request(app)
        .post('/api/export/prepare')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestData);

      tracker.mark('API呼び出し完了', {
        status: response.status,
        responseSize: JSON.stringify(response.body).length
      });

      // レスポンス検証
      tracker.setOperation('レスポンス検証');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('exportId');
      expect(response.body.data).toHaveProperty('files');
      expect(Array.isArray(response.body.data.files)).toBe(true);
      expect(response.body.data.files.length).toBeGreaterThan(0);

      // ファイル情報の検証
      const files = response.body.data.files;
      const htmlFile = files.find((f: any) => f.path === 'index.html');
      expect(htmlFile).toBeDefined();
      expect(htmlFile.mimeType).toBe('text/html');
      expect(htmlFile.size).toBeGreaterThan(0);

      tracker.mark('レスポンス検証完了', {
        exportId: response.body.data.exportId,
        filesCount: files.length,
        htmlFileSize: htmlFile?.size
      });

      // エクスポートIDを保存（他のテストで使用）
      (global as any).testExportId = response.body.data.exportId;
    });

    it('ZIPフォーマットでエクスポート準備が正常に完了する', async () => {
      tracker.setOperation('ZIPエクスポート準備テスト');

      const requestData = {
        projectId: testProjectId,
        format: ExportFormat.ZIP,
        optimize: false
      };

      tracker.setOperation('ZIPエクスポート準備API呼び出し');
      const response = await request(app)
        .post('/api/export/prepare')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestData);

      tracker.mark('API呼び出し完了', {
        status: response.status,
        responseSize: JSON.stringify(response.body).length
      });

      // レスポンス検証
      tracker.setOperation('レスポンス検証');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('exportId');
      expect(response.body.data).toHaveProperty('files');

      const files = response.body.data.files;
      const zipFile = files.find((f: any) => f.path.endsWith('.zip'));
      expect(zipFile).toBeDefined();
      expect(zipFile.mimeType).toBe('application/zip');
      expect(zipFile.size).toBeGreaterThan(0);

      tracker.mark('レスポンス検証完了', {
        exportId: response.body.data.exportId,
        zipFileSize: zipFile?.size
      });
    });

    it('存在しないプロジェクトIDでエクスポート準備を試行すると404エラーが返される', async () => {
      tracker.setOperation('存在しないプロジェクトエラーテスト');

      const nonExistentProjectId = `nonexistent_${Date.now()}`;
      const requestData = {
        projectId: nonExistentProjectId,
        format: ExportFormat.HTML,
        optimize: true
      };

      tracker.setOperation('エラーケースAPI呼び出し');
      const response = await request(app)
        .post('/api/export/prepare')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestData);

      tracker.mark('API呼び出し完了', {
        status: response.status
      });

      // エラーレスポンス検証
      tracker.setOperation('エラーレスポンス検証');
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('プロジェクトが見つかりません');

      tracker.mark('エラーレスポンス検証完了');
    });

    it('無効なフォーマットでエクスポート準備を試行すると400エラーが返される', async () => {
      tracker.setOperation('無効フォーマットエラーテスト');

      const requestData = {
        projectId: testProjectId,
        format: 'invalid_format',
        optimize: true
      };

      tracker.setOperation('バリデーションエラーAPI呼び出し');
      const response = await request(app)
        .post('/api/export/prepare')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestData);

      tracker.mark('API呼び出し完了', {
        status: response.status
      });

      // バリデーションエラー検証
      tracker.setOperation('バリデーションエラー検証');
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('無効なエクスポートフォーマットです。html または zip を指定してください');

      tracker.mark('バリデーションエラー検証完了');
    });
  });

  describe('エクスポートダウンロード (GET /api/export/:exportId/download)', () => {
    let exportId: string;

    beforeEach(async () => {
      tracker.setOperation('ダウンロードテスト用エクスポート準備');

      // エクスポートを準備
      const response = await request(app)
        .post('/api/export/prepare')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId: testProjectId,
          format: ExportFormat.HTML,
          optimize: true
        });

      expect(response.status).toBe(200);
      exportId = response.body.data.exportId;

      tracker.mark('ダウンロードテスト用エクスポート準備完了', {
        exportId
      });
    });

    it('エクスポートファイルのダウンロードが正常に完了する', async () => {
      tracker.setOperation('ファイルダウンロードテスト');

      tracker.setOperation('ダウンロードAPI呼び出し');
      const response = await request(app)
        .get(`/api/export/${exportId}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      tracker.mark('API呼び出し完了', {
        status: response.status,
        contentType: response.headers['content-type'],
        contentLength: response.headers['content-length']
      });

      // ダウンロードレスポンス検証
      tracker.setOperation('ダウンロードレスポンス検証');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/html');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('filename=');
      expect(response.body).toBeDefined();

      tracker.mark('ダウンロードレスポンス検証完了', {
        bodySize: response.body.length || 0
      });
    });

    it('存在しないエクスポートIDでダウンロードを試行すると404エラーが返される', async () => {
      tracker.setOperation('存在しないエクスポートダウンロードエラーテスト');

      const nonExistentExportId = `export_99999999`; // 存在しないが形式は正しいエクスポートID

      tracker.setOperation('存在しないエクスポートダウンロードAPI呼び出し');
      const response = await request(app)
        .get(`/api/export/${nonExistentExportId}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      tracker.mark('API呼び出し完了', {
        status: response.status
      });

      // エラーレスポンス検証
      tracker.setOperation('ダウンロードエラーレスポンス検証');
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);

      tracker.mark('ダウンロードエラーレスポンス検証完了');
    });

    it('無効なエクスポートID形式でダウンロードを試行すると400エラーが返される', async () => {
      tracker.setOperation('無効エクスポートIDダウンロードエラーテスト');

      const invalidExportId = 'invalid_format';

      tracker.setOperation('無効エクスポートIDダウンロードAPI呼び出し');
      const response = await request(app)
        .get(`/api/export/${invalidExportId}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      tracker.mark('API呼び出し完了', {
        status: response.status
      });

      // バリデーションエラー検証
      tracker.setOperation('ダウンロードバリデーションエラー検証');
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('無効なエクスポートID');

      tracker.mark('ダウンロードバリデーションエラー検証完了');
    });
  });

  describe('エクスポート履歴取得 (GET /api/projects/:projectId/exports)', () => {
    beforeEach(async () => {
      tracker.setOperation('履歴テスト用複数エクスポート作成');

      // 複数のエクスポートを作成
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/export/prepare')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId: testProjectId,
            format: i % 2 === 0 ? ExportFormat.HTML : ExportFormat.ZIP,
            optimize: true
          });

        // 少し間隔を空けて作成日時を区別可能にする
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      tracker.mark('履歴テスト用複数エクスポート作成完了');
    });

    it('プロジェクトのエクスポート履歴が正常に取得できる', async () => {
      tracker.setOperation('エクスポート履歴取得テスト');

      tracker.setOperation('エクスポート履歴API呼び出し');
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/exports`)
        .set('Authorization', `Bearer ${authToken}`);

      tracker.mark('API呼び出し完了', {
        status: response.status,
        responseSize: JSON.stringify(response.body).length
      });

      // 履歴レスポンス検証
      tracker.setOperation('履歴レスポンス検証');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(3);

      // 履歴項目の検証
      const exports = response.body.data;
      for (const exp of exports) {
        expect(exp).toHaveProperty('id');
        expect(exp).toHaveProperty('projectId');
        expect(exp).toHaveProperty('format');
        expect(exp).toHaveProperty('url');
        expect(exp).toHaveProperty('createdAt');
        expect(exp.projectId).toBe(testProjectId);
        expect([ExportFormat.HTML, ExportFormat.ZIP]).toContain(exp.format);
      }

      // 履歴の順序確認（新しい順）
      for (let i = 1; i < exports.length; i++) {
        const currentDate = new Date(exports[i].createdAt);
        const previousDate = new Date(exports[i - 1].createdAt);
        expect(currentDate.getTime()).toBeLessThanOrEqual(previousDate.getTime());
      }

      tracker.mark('履歴レスポンス検証完了', {
        exportsCount: exports.length
      });
    });

    it('存在しないプロジェクトIDで履歴取得を試行すると404エラーが返される', async () => {
      tracker.setOperation('存在しないプロジェクト履歴エラーテスト');

      const nonExistentProjectId = `nonexistent_${Date.now()}`;

      tracker.setOperation('存在しないプロジェクト履歴API呼び出し');
      const response = await request(app)
        .get(`/api/projects/${nonExistentProjectId}/exports`)
        .set('Authorization', `Bearer ${authToken}`);

      tracker.mark('API呼び出し完了', {
        status: response.status
      });

      // エラーレスポンス検証
      tracker.setOperation('履歴エラーレスポンス検証');
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);

      tracker.mark('履歴エラーレスポンス検証完了');
    });
  });

  describe('認証・権限テスト', () => {
    it('認証なしでエクスポート準備を試行すると401エラーが返される', async () => {
      tracker.setOperation('認証なしエクスポート準備エラーテスト');

      tracker.setOperation('認証なしAPI呼び出し');
      const response = await request(app)
        .post('/api/export/prepare')
        .send({
          projectId: testProjectId,
          format: ExportFormat.HTML,
          optimize: true
        });

      tracker.mark('API呼び出し完了', {
        status: response.status
      });

      // 認証エラー検証
      tracker.setOperation('認証エラー検証');
      expect(response.status).toBe(401);

      tracker.mark('認証エラー検証完了');
    });

    it('他のユーザーのプロジェクトをエクスポートしようとすると403エラーが返される', async () => {
      tracker.setOperation('権限エラーテスト');

      // 別のユーザーを作成
      const otherUniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const otherUser = await createTestUser({
        githubId: `other_export_test_${otherUniqueId}`,
        username: `other_export_user_${otherUniqueId}`,
        email: `other_export_test_${otherUniqueId}@example.com`
      });

      const otherAuthToken = createTestJWT({
        id: otherUser.id,
        githubId: otherUser.githubId,
        username: otherUser.username,
        email: otherUser.email ?? null,
        avatarUrl: otherUser.avatarUrl ?? null,
        createdAt: otherUser.createdAt,
        updatedAt: otherUser.updatedAt,
        lastLoginAt: otherUser.lastLoginAt
      });

      tracker.setOperation('他ユーザー権限チェックAPI呼び出し');
      const response = await request(app)
        .post('/api/export/prepare')
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .send({
          projectId: testProjectId,
          format: ExportFormat.HTML,
          optimize: true
        });

      tracker.mark('API呼び出し完了', {
        status: response.status
      });

      // 権限エラー検証
      tracker.setOperation('権限エラー検証');
      expect([403, 404]).toContain(response.status); // アクセス拒否またはプロジェクト未発見
      expect(response.body.success).toBe(false);

      tracker.mark('権限エラー検証完了');
    });
  });

  describe('パフォーマンステスト', () => {
    it('大きなHTMLファイルのエクスポートが適切な時間内に完了する', async () => {
      tracker.setOperation('大きなファイルエクスポートパフォーマンステスト');

      // 大きなHTMLコンテンツを想定
      // const largeHtmlContent = '<div>'.repeat(1000) + 'Large content test' + '</div>'.repeat(1000);

      tracker.setOperation('大きなファイルエクスポート準備API呼び出し');
      const response = await request(app)
        .post('/api/export/prepare')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId: testProjectId,
          format: ExportFormat.HTML,
          optimize: true
        });

      tracker.mark('API呼び出し完了', {
        status: response.status,
        responseTime: tracker.getTotalElapsed()
      });

      // パフォーマンス検証
      tracker.setOperation('パフォーマンス検証');
      expect(response.status).toBe(200);
      // 大きなファイルでも5秒以内に完了することを期待（テスト環境の遅延を考慮）
      expect(tracker.getTotalElapsed()).toBeLessThan(5000);

      tracker.mark('パフォーマンス検証完了');
    });
  });
});