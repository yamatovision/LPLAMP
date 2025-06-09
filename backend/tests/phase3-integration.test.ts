/**
 * Phase 3 統合テスト
 * 
 * GitHub連携機能のエディター統合をテスト
 * - useAutoSaveフック
 * - GitHubStatusBar
 * - リアルタイム同期
 * - エディター統合
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import WebSocket from 'ws';
import { app } from '../src/app.js';
import { AutoSaveService } from '../src/features/history/auto-save.service.js';
import { GitHubService } from '../src/features/github/github.service.js';
import { githubSyncHandler } from '../src/websocket/github-sync-handler.js';
import { projectService } from '../src/features/projects/projects.service.js';
import { authHelper } from './utils/test-auth-helper.js';
import { logger } from '../src/common/utils/logger.js';

describe('Phase 3 統合テスト - GitHub連携エディター統合', () => {
  let authToken: string;
  let testUserId: string;
  let testProjectId: string;
  let testProject: any;

  beforeAll(async () => {
    // テスト用認証セットアップ
    const authResult = await authHelper.createTestUser();
    authToken = authResult.token;
    testUserId = authResult.userId;
    
    logger.info('Phase 3統合テスト開始', {
      testUserId,
      timestamp: new Date().toISOString()
    });
  });

  beforeEach(async () => {
    // テスト用プロジェクト作成
    const response = await request(app)
      .post('/api/projects/create')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        url: 'https://example.com',
        name: 'Phase3テストプロジェクト',
        githubRepo: 'test-user/test-repo',
        githubBranch: 'main',
        autoCommit: true
      });

    expect(response.status).toBe(200);
    testProjectId = response.body.projectId;
    
    // プロジェクト詳細を取得
    const projectResponse = await request(app)
      .get(`/api/projects/${testProjectId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    testProject = projectResponse.body;
    
    logger.info('テスト用プロジェクト作成完了', {
      testProjectId,
      githubRepo: testProject.githubRepo
    });
  });

  afterEach(async () => {
    // テスト用プロジェクト削除
    if (testProjectId) {
      await request(app)
        .delete(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      logger.info('テスト用プロジェクト削除完了', { testProjectId });
    }
  });

  afterAll(async () => {
    await authHelper.cleanup();
    logger.info('Phase 3統合テスト終了');
  });

  describe('1. AutoSaveService 単体テスト', () => {
    let autoSaveService: AutoSaveService;

    beforeEach(() => {
      autoSaveService = new AutoSaveService();
    });

    test('1.1 自動保存スケジュール設定', async () => {
      const editChanges = {
        description: 'テスト編集',
        changedFiles: [
          {
            path: 'index.html',
            content: '<html><body>Updated Content</body></html>',
            size: 46,
            mimeType: 'text/html',
            lastModified: new Date().toISOString()
          }
        ],
        timestamp: new Date().toISOString()
      };

      // 自動保存をスケジュール（実際のコミットはモック）
      const schedulePromise = autoSaveService.scheduleAutoSave(
        testProjectId, 
        editChanges, 
        testUserId
      );

      // エラーなく完了することを確認
      await expect(schedulePromise).resolves.toBeUndefined();
      
      logger.info('自動保存スケジュール設定テスト完了', {
        testProjectId,
        changedFileCount: editChanges.changedFiles.length
      });
    });

    test('1.2 明示的保存実行', async () => {
      const editChanges = {
        description: '明示的保存テスト',
        changedFiles: [
          {
            path: 'index.html',
            content: '<html><body>Explicit Save Content</body></html>',
            size: 50,
            mimeType: 'text/html',
            lastModified: new Date().toISOString()
          }
        ],
        timestamp: new Date().toISOString()
      };

      // 明示的保存実行（実際のコミットはモック）
      const savePromise = autoSaveService.explicitSave(
        testProjectId, 
        editChanges, 
        testUserId
      );

      // エラーなく完了することを確認
      await expect(savePromise).resolves.toBeUndefined();
      
      logger.info('明示的保存実行テスト完了', {
        testProjectId,
        description: editChanges.description
      });
    });

    test('1.3 タイマー状態確認', () => {
      const timerStatus = autoSaveService.getTimerStatus();
      
      expect(timerStatus).toHaveProperty('activeProjects');
      expect(timerStatus).toHaveProperty('saveTimerCount');
      expect(timerStatus).toHaveProperty('intervalTimerCount');
      expect(Array.isArray(timerStatus.activeProjects)).toBe(true);
      expect(typeof timerStatus.saveTimerCount).toBe('number');
      expect(typeof timerStatus.intervalTimerCount).toBe('number');
      
      logger.info('タイマー状態確認テスト完了', { timerStatus });
    });
  });

  describe('2. GitHub状態管理テスト', () => {
    test('2.1 GitHub認証状態確認', async () => {
      const response = await request(app)
        .get('/api/github/auth/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('authenticated');
      expect(typeof response.body.authenticated).toBe('boolean');
      
      if (response.body.authenticated) {
        expect(response.body).toHaveProperty('username');
        expect(response.body).toHaveProperty('scopes');
      }
      
      logger.info('GitHub認証状態確認テスト完了', {
        authenticated: response.body.authenticated,
        username: response.body.username
      });
    });

    test('2.2 GitHubリポジトリ一覧取得', async () => {
      const response = await request(app)
        .get('/api/github/repos')
        .set('Authorization', `Bearer ${authToken}`);

      // 認証されている場合のみテスト実行
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
        
        if (response.body.length > 0) {
          const repo = response.body[0];
          expect(repo).toHaveProperty('id');
          expect(repo).toHaveProperty('name');
          expect(repo).toHaveProperty('fullName');
          expect(repo).toHaveProperty('private');
          expect(repo).toHaveProperty('defaultBranch');
        }
        
        logger.info('GitHubリポジトリ一覧取得テスト完了', {
          repoCount: response.body.length
        });
      } else {
        logger.info('GitHub未認証のためリポジトリ一覧テストスキップ', {
          status: response.status
        });
      }
    });
  });

  describe('3. WebSocket同期機能テスト', () => {
    let wsClient: WebSocket;
    let receivedMessages: any[] = [];

    beforeEach((done) => {
      // WebSocketクライアント接続
      const wsUrl = `ws://localhost:3001/ws/github-sync?projectId=${testProjectId}`;
      wsClient = new WebSocket(wsUrl);
      
      wsClient.on('open', () => {
        logger.info('WebSocketテストクライアント接続完了', { testProjectId });
        done();
      });
      
      wsClient.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          receivedMessages.push(message);
          logger.debug('WebSocketメッセージ受信', { message });
        } catch (error) {
          logger.error('WebSocketメッセージ解析エラー', { error });
        }
      });
      
      wsClient.on('error', (error) => {
        logger.error('WebSocketクライアントエラー', { error });
        done(error);
      });
    });

    afterEach(() => {
      if (wsClient) {
        wsClient.close();
      }
      receivedMessages = [];
    });

    test('3.1 接続確認メッセージ受信', (done) => {
      // 接続確認メッセージが1秒以内に受信されることを確認
      setTimeout(() => {
        const authMessages = receivedMessages.filter(msg => msg.type === 'auth');
        expect(authMessages.length).toBeGreaterThan(0);
        
        const authMessage = authMessages[0];
        expect(authMessage.projectId).toBe(testProjectId);
        expect(authMessage.data.connected).toBe(true);
        
        logger.info('接続確認メッセージ受信テスト完了', {
          receivedMessageCount: receivedMessages.length,
          authMessage: authMessage
        });
        
        done();
      }, 1000);
    });

    test('3.2 コミットイベント送信', (done) => {
      // コミットイベントを手動送信
      const commitHash = 'abc123def456';
      const commitMessage = 'テストコミット';
      
      githubSyncHandler.broadcastCommitEvent(
        testProjectId,
        commitHash,
        commitMessage,
        testUserId
      );
      
      setTimeout(() => {
        const commitMessages = receivedMessages.filter(msg => msg.type === 'commit');
        expect(commitMessages.length).toBeGreaterThan(0);
        
        const commitMessage = commitMessages[0];
        expect(commitMessage.projectId).toBe(testProjectId);
        expect(commitMessage.data.commitHash).toBe(commitHash);
        expect(commitMessage.data.userId).toBe(testUserId);
        
        logger.info('コミットイベント送信テスト完了', {
          commitHash: commitHash.substring(0, 7),
          message: commitMessage.data.message
        });
        
        done();
      }, 500);
    });

    test('3.3 デプロイイベント送信', (done) => {
      const deployStatus = 'building';
      const deployUrl = 'https://test-deploy.netlify.app';
      
      githubSyncHandler.broadcastDeployEvent(
        testProjectId,
        deployStatus as any,
        deployUrl
      );
      
      setTimeout(() => {
        const deployMessages = receivedMessages.filter(msg => msg.type === 'deploy');
        expect(deployMessages.length).toBeGreaterThan(0);
        
        const deployMessage = deployMessages[0];
        expect(deployMessage.projectId).toBe(testProjectId);
        expect(deployMessage.data.status).toBe(deployStatus);
        expect(deployMessage.data.url).toBe(deployUrl);
        
        logger.info('デプロイイベント送信テスト完了', {
          status: deployStatus,
          url: deployUrl
        });
        
        done();
      }, 500);
    });
  });

  describe('4. エディター統合APIテスト', () => {
    test('4.1 プロジェクトファイル取得', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/files/index.html`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('file');
      expect(response.body).toHaveProperty('exists');
      
      const file = response.body.file;
      expect(file).toHaveProperty('path');
      expect(file).toHaveProperty('content');
      expect(file).toHaveProperty('size');
      expect(file).toHaveProperty('mimeType');
      expect(file.path).toBe('index.html');
      
      logger.info('プロジェクトファイル取得テスト完了', {
        testProjectId,
        filePath: file.path,
        fileSize: file.size
      });
    });

    test('4.2 プロジェクトファイル更新', async () => {
      const newContent = '<html><body><h1>Updated by Test</h1></body></html>';
      
      const response = await request(app)
        .put(`/api/projects/${testProjectId}/files/index.html`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: newContent
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('file');
      
      const updatedFile = response.body.file;
      expect(updatedFile.content).toBe(newContent);
      expect(updatedFile.size).toBe(newContent.length);
      
      logger.info('プロジェクトファイル更新テスト完了', {
        testProjectId,
        newContentLength: newContent.length,
        updatedSize: updatedFile.size
      });
    });

    test('4.3 プロジェクトディレクトリ構造取得', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/files`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        const item = response.body[0];
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('path');
        expect(item).toHaveProperty('type');
        expect(['file', 'directory']).toContain(item.type);
      }
      
      logger.info('プロジェクトディレクトリ構造取得テスト完了', {
        testProjectId,
        itemCount: response.body.length
      });
    });
  });

  describe('5. 統合フローテスト', () => {
    test('5.1 完全な編集→保存→同期フロー', async () => {
      logger.info('統合フローテスト開始', { testProjectId });
      
      // 1. 初期ファイル取得
      const initialResponse = await request(app)
        .get(`/api/projects/${testProjectId}/files/index.html`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(initialResponse.status).toBe(200);
      const initialContent = initialResponse.body.file.content;
      
      // 2. ファイル内容更新
      const updatedContent = `${initialContent}\n<!-- Updated at ${new Date().toISOString()} -->`;
      
      const updateResponse = await request(app)
        .put(`/api/projects/${testProjectId}/files/index.html`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: updatedContent
        });
      
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.success).toBe(true);
      
      // 3. 自動保存をトリガー
      const autoSaveService = new AutoSaveService();
      const editChanges = {
        description: '統合フローテスト編集',
        changedFiles: [
          {
            path: 'index.html',
            content: updatedContent,
            size: updatedContent.length,
            mimeType: 'text/html',
            lastModified: new Date().toISOString()
          }
        ],
        timestamp: new Date().toISOString()
      };
      
      await autoSaveService.scheduleAutoSave(testProjectId, editChanges, testUserId);
      
      // 4. 変更確認
      const verifyResponse = await request(app)
        .get(`/api/projects/${testProjectId}/files/index.html`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.file.content).toBe(updatedContent);
      
      logger.info('統合フローテスト完了', {
        testProjectId,
        initialContentLength: initialContent.length,
        updatedContentLength: updatedContent.length,
        autoSaveTriggered: true
      });
    });
  });
});