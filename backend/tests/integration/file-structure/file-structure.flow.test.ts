import request from 'supertest';
import { app } from '../../../src/app';
import { MilestoneTracker } from '../../utils/MilestoneTracker';
import fs from 'fs-extra';
import path from 'path';
import { createTestUserWithToken } from '../../utils/test-auth-helper';

describe('ファイル構造取得API統合テスト', () => {
  let authToken: string;
  let testProject: any;
  // let testUserId: string; // 未使用
  const tracker = new MilestoneTracker();
  const baseProjectPath = process.env['PROJECTS_DIR'] || '/tmp/lplamp-projects';

  beforeAll(async () => {
    tracker.mark('テスト開始');
    
    // 認証トークン取得
    tracker.setOperation('認証設定');
    const authResult = await createTestUserWithToken({
      username: 'file-structure-test-user',
      email: 'file-structure-test@example.com'
    });
    
    authToken = `authToken=${authResult.token}`;
    // testUserId = authResult.user.id; // 未使用
    tracker.mark('認証完了');
  });

  beforeEach(async () => {
    // テストプロジェクト作成
    tracker.setOperation('テストデータ準備');
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const createResponse = await request(app)
      .post('/api/projects/create')
      .set('Cookie', authToken)
      .send({
        url: `https://example-${uniqueId}.com`,
        name: `Test File Structure ${uniqueId}`
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.success).toBe(true);
    testProject = createResponse.body.data;
    tracker.mark('プロジェクト作成完了');

    // テスト用のファイル構造を作成
    const projectPath = path.join(baseProjectPath, testProject.data.projectId);
    await fs.ensureDir(projectPath);

    // テストファイル作成
    await fs.writeFile(
      path.join(projectPath, 'index.html'),
      '<html><body>Test</body></html>'
    );
    
    await fs.writeFile(
      path.join(projectPath, 'style.css'),
      'body { margin: 0; }'
    );
    
    await fs.writeFile(
      path.join(projectPath, 'script.js'),
      'console.log("test");'
    );

    // サブディレクトリ作成
    await fs.ensureDir(path.join(projectPath, 'assets'));
    await fs.ensureDir(path.join(projectPath, 'assets', 'images'));
    await fs.ensureDir(path.join(projectPath, 'components'));

    // サブディレクトリ内のファイル
    await fs.writeFile(
      path.join(projectPath, 'assets', 'logo.svg'),
      '<svg></svg>'
    );
    
    await fs.writeFile(
      path.join(projectPath, 'assets', 'images', 'banner.jpg'),
      'fake-image-data'
    );
    
    await fs.writeFile(
      path.join(projectPath, 'components', 'header.html'),
      '<header>Test Header</header>'
    );

    tracker.mark('テストファイル構造作成完了');
  });

  afterEach(async () => {
    // クリーンアップ
    if (testProject) {
      const projectPath = path.join(baseProjectPath, testProject.data.projectId);
      await fs.remove(projectPath);
    }
  });

  afterAll(() => {
    tracker.summary();
  });

  describe('9.4: ファイル構造取得API', () => {
    it('プロジェクトのルートディレクトリ構造を取得できる', async () => {
      tracker.setOperation('ルートディレクトリ取得テスト');
      
      const response = await request(app)
        .get(`/api/projects/${testProject.data.projectId}/files`)
        .set('Cookie', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const files = response.body.data;
      expect(Array.isArray(files)).toBe(true);
      
      // ルートレベルのファイル確認
      const fileNames = files.map((f: any) => f.name);
      expect(fileNames).toContain('index.html');
      expect(fileNames).toContain('style.css');
      expect(fileNames).toContain('script.js');
      expect(fileNames).toContain('assets');
      expect(fileNames).toContain('components');
      
      // ファイルタイプの確認
      const indexFile = files.find((f: any) => f.name === 'index.html');
      expect(indexFile.type).toBe('file');
      expect(indexFile.path).toBe('index.html');
      
      const assetsDir = files.find((f: any) => f.name === 'assets');
      expect(assetsDir.type).toBe('directory');
      expect(assetsDir.path).toBe('assets');
      
      tracker.mark('ルートディレクトリ構造確認完了');
    });

    it('特定のサブディレクトリ構造を取得できる', async () => {
      tracker.setOperation('サブディレクトリ取得テスト');
      
      // assetsディレクトリの内容を取得
      const response = await request(app)
        .get(`/api/projects/${testProject.data.projectId}/files?path=assets`)
        .set('Cookie', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const files = response.body.data;
      const fileNames = files.map((f: any) => f.name);
      
      expect(fileNames).toContain('logo.svg');
      expect(fileNames).toContain('images');
      
      // パスが正しく設定されているか確認
      const logoFile = files.find((f: any) => f.name === 'logo.svg');
      expect(logoFile.path).toBe('assets/logo.svg');
      
      tracker.mark('assetsディレクトリ確認完了');

      // ネストしたディレクトリの確認
      const nestedResponse = await request(app)
        .get(`/api/projects/${testProject.data.projectId}/files?path=assets/images`)
        .set('Cookie', authToken);

      expect(nestedResponse.status).toBe(200);
      const nestedFiles = nestedResponse.body.data;
      const nestedFileNames = nestedFiles.map((f: any) => f.name);
      
      expect(nestedFileNames).toContain('banner.jpg');
      
      const bannerFile = nestedFiles.find((f: any) => f.name === 'banner.jpg');
      expect(bannerFile.path).toBe('assets/images/banner.jpg');
      
      tracker.mark('ネストディレクトリ確認完了');
    });

    it('空のディレクトリを正しく処理する', async () => {
      tracker.setOperation('空ディレクトリテスト');
      
      // 空のディレクトリを作成
      const projectPath = path.join(baseProjectPath, testProject.data.projectId);
      await fs.ensureDir(path.join(projectPath, 'empty-dir'));
      
      const response = await request(app)
        .get(`/api/projects/${testProject.data.projectId}/files?path=empty-dir`)
        .set('Cookie', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      
      tracker.mark('空ディレクトリ処理確認');
    });

    it('ファイルサイズとタイムスタンプ情報を含む', async () => {
      tracker.setOperation('ファイル詳細情報テスト');
      
      const response = await request(app)
        .get(`/api/projects/${testProject.data.projectId}/files`)
        .set('Cookie', authToken);

      const files = response.body.data;
      const indexFile = files.find((f: any) => f.name === 'index.html');
      
      expect(indexFile).toHaveProperty('size');
      expect(indexFile).toHaveProperty('modified');
      expect(typeof indexFile.size).toBe('number');
      expect(indexFile.size).toBeGreaterThan(0);
      expect(new Date(indexFile.modified)).toBeInstanceOf(Date);
      
      tracker.mark('ファイル詳細情報確認完了');
    });

    it('隠しファイルを除外する', async () => {
      tracker.setOperation('隠しファイル除外テスト');
      
      // 隠しファイルを作成
      const projectPath = path.join(baseProjectPath, testProject.data.projectId);
      await fs.writeFile(
        path.join(projectPath, '.hidden-file'),
        'hidden content'
      );
      await fs.ensureDir(path.join(projectPath, '.hidden-dir'));
      
      const response = await request(app)
        .get(`/api/projects/${testProject.data.projectId}/files`)
        .set('Cookie', authToken);

      const files = response.body.data;
      const fileNames = files.map((f: any) => f.name);
      
      expect(fileNames).not.toContain('.hidden-file');
      expect(fileNames).not.toContain('.hidden-dir');
      
      tracker.mark('隠しファイル除外確認');
    });
  });

  describe('エラーハンドリング', () => {
    it('存在しないプロジェクトIDでエラーを返す', async () => {
      tracker.setOperation('存在しないプロジェクトテスト');
      
      const response = await request(app)
        .get('/api/projects/non-existent-id/files')
        .set('Cookie', authToken);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('プロジェクトが見つかりません');
      
      tracker.mark('プロジェクト不在エラー確認');
    });

    it('存在しないパスでエラーを返す', async () => {
      tracker.setOperation('存在しないパステスト');
      
      const response = await request(app)
        .get(`/api/projects/${testProject.data.projectId}/files?path=non-existent-path`)
        .set('Cookie', authToken);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('ディレクトリが見つかりません');
      
      tracker.mark('パス不在エラー確認');
    });

    it('パストラバーサル攻撃を防ぐ', async () => {
      tracker.setOperation('セキュリティテスト');
      
      // 親ディレクトリへのアクセス試行
      const response1 = await request(app)
        .get(`/api/projects/${testProject.data.projectId}/files?path=../..`)
        .set('Cookie', authToken);

      expect(response1.status).toBe(400);
      expect(response1.body.success).toBe(false);
      expect(response1.body.error).toContain('無効なパス');
      
      // 絶対パスへのアクセス試行
      const response2 = await request(app)
        .get(`/api/projects/${testProject.data.projectId}/files?path=/etc/passwd`)
        .set('Cookie', authToken);

      expect(response2.status).toBe(400);
      expect(response2.body.success).toBe(false);
      
      tracker.mark('パストラバーサル防御確認');
    });

    it('認証なしでアクセスできない', async () => {
      tracker.setOperation('認証エラーテスト');
      
      const response = await request(app)
        .get(`/api/projects/${testProject.data.projectId}/files`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      
      tracker.mark('認証エラー確認');
    });

    it('他のユーザーのプロジェクトにアクセスできない', async () => {
      tracker.setOperation('権限エラーテスト');
      
      // 別のユーザーとして認証
      const otherAuthResult = await createTestUserWithToken({
        username: 'other-test-user',
        email: 'other-test@example.com'
      });
      
      const otherAuthToken = `authToken=${otherAuthResult.token}`;
      
      // 他のユーザーのトークンでアクセス試行
      const response = await request(app)
        .get(`/api/projects/${testProject.data.projectId}/files`)
        .set('Cookie', otherAuthToken);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('このプロジェクトへのアクセス権限がありません');
      
      tracker.mark('権限エラー確認');
    });
  });

  describe('パフォーマンステスト', () => {
    it('大量のファイルを効率的に処理する', async () => {
      tracker.setOperation('パフォーマンステスト');
      
      // 100個のファイルを作成
      const projectPath = path.join(baseProjectPath, testProject.data.projectId);
      const promises = [];
      
      for (let i = 0; i < 100; i++) {
        promises.push(
          fs.writeFile(
            path.join(projectPath, `file-${i}.txt`),
            `Content of file ${i}`
          )
        );
      }
      
      await Promise.all(promises);
      tracker.mark('100ファイル作成完了');
      
      const startTime = Date.now();
      const response = await request(app)
        .get(`/api/projects/${testProject.data.projectId}/files`)
        .set('Cookie', authToken);

      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(100);
      expect(responseTime).toBeLessThan(1000); // 1秒以内
      
      tracker.mark(`ファイルリスト取得完了: ${responseTime}ms`);
    });
  });
});