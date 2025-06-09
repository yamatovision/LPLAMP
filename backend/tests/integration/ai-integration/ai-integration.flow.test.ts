/**
 * AI連携基盤統合テスト
 * 
 * WebSocketターミナル接続とプロジェクトファイル管理機能のテスト
 * 実際のSocket.IOとファイルシステムを使用した統合テスト
 */

import request from 'supertest';
import io from 'socket.io-client';
type ClientSocket = ReturnType<typeof io>;
import { createServer, Server as HttpServer } from 'http';
import { app } from '../../../src/app';
import { WebSocketServer } from '../../../src/websocket';
import { MilestoneTracker } from '../../utils/MilestoneTracker';
import { createTestUserWithToken } from '../../utils/test-auth-helper';
import { TerminalMessage } from '../../../src/types';
import { logger } from '../../../src/common/utils/logger';

describe('AI連携基盤統合テスト', () => {
  let httpServer: HttpServer;
  let wsServer: WebSocketServer;
  let authToken: string;
  let testProjectId: string;
  let clientSocket: ClientSocket;
  let tracker: MilestoneTracker;

  beforeAll(async () => {
    tracker = new MilestoneTracker();
    tracker.setOperation('テスト環境セットアップ');

    // HTTPサーバーとWebSocketサーバーの初期化
    httpServer = createServer(app);
    wsServer = new WebSocketServer(httpServer);

    // サーバー起動
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        tracker.mark('サーバー起動完了');
        resolve();
      });
    });

    // 認証トークンの取得
    const userWithToken = await createTestUserWithToken();
    authToken = userWithToken.token;
    tracker.mark('認証トークン取得完了');

    // テスト用プロジェクトの作成
    const projectResponse = await request(app)
      .post('/api/projects/create')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        url: 'https://example.com',
        name: `AI統合テスト-${Date.now()}`
      })
      .expect(201);

    testProjectId = projectResponse.body.data.projectId;
    tracker.mark('テストプロジェクト作成完了');
  });

  beforeEach(() => {
    tracker = new MilestoneTracker();
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    tracker.summary();
  });

  afterAll(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    
    wsServer.close();
    
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  describe('WebSocketターミナル接続機能', () => {
    it('認証付きWebSocket接続が正常に確立される', (done) => {
      tracker.setOperation('WebSocket接続テスト');

      const serverPort = (httpServer.address() as any)?.port;
      expect(serverPort).toBeDefined();

      clientSocket = io(`http://localhost:${serverPort}`, {
        path: '/ws/socket.io',
        query: {
          token: authToken
        }
      });

      tracker.mark('クライアント接続試行');

      clientSocket.on('connect', () => {
        tracker.mark('WebSocket接続成功');
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', (error: Error) => {
        tracker.mark('WebSocket接続エラー');
        done(error);
      });

      // タイムアウト設定
      setTimeout(() => {
        if (!clientSocket.connected) {
          done(new Error('WebSocket接続タイムアウト'));
        }
      }, 5000);
    });

    it('ターミナルセッションの開始と終了ができる', (done) => {
      tracker.setOperation('ターミナルセッション管理テスト');

      const serverPort = (httpServer.address() as any)?.port;
      clientSocket = io(`http://localhost:${serverPort}`, {
        path: '/ws/socket.io',
        query: { token: authToken }
      });

      let sessionId: string;

      clientSocket.on('connect', () => {
        tracker.mark('WebSocket接続確立');

        // ターミナル開始
        clientSocket.emit('terminal:start', { projectId: testProjectId });
        tracker.mark('ターミナル開始要求送信');
      });

      clientSocket.on('terminal:started', (data: any) => {
        tracker.mark('ターミナルセッション開始');
        expect(data).toHaveProperty('sessionId');
        expect(data).toHaveProperty('projectId', testProjectId);
        expect(data).toHaveProperty('workingDirectory');

        sessionId = data.sessionId;

        // ターミナル停止
        clientSocket.emit('terminal:stop', { sessionId });
        tracker.mark('ターミナル停止要求送信');
      });

      clientSocket.on('terminal:stopped', (data: any) => {
        tracker.mark('ターミナルセッション停止');
        expect(data).toHaveProperty('sessionId', sessionId);
        done();
      });

      clientSocket.on('terminal:error', (error: Error) => {
        done(new Error(`ターミナルエラー: ${error.message}`));
      });

      // タイムアウト設定
      setTimeout(() => {
        done(new Error('ターミナルセッションテストタイムアウト'));
      }, 10000);
    });

    it('ターミナルコマンドの実行と出力取得ができる', (done) => {
      tracker.setOperation('ターミナルコマンド実行テスト');

      const serverPort = (httpServer.address() as any)?.port;
      clientSocket = io(`http://localhost:${serverPort}`, {
        path: '/ws/socket.io',
        query: { token: authToken }
      });

      let sessionId: string;
      let outputReceived = false;

      clientSocket.on('connect', () => {
        tracker.mark('WebSocket接続確立');
        clientSocket.emit('terminal:start', { projectId: testProjectId });
      });

      clientSocket.on('terminal:started', (data: any) => {
        tracker.mark('ターミナルセッション開始');
        sessionId = data.sessionId;

        // 簡単なコマンドを実行
        const command = process.platform === 'win32' ? 'echo Hello\\n' : 'echo Hello\\n';
        clientSocket.emit('terminal:input', { 
          sessionId, 
          input: command 
        });
        tracker.mark('コマンド送信');
      });

      clientSocket.on('terminal:output', (data: any) => {
        tracker.mark('ターミナル出力受信');
        expect(data).toHaveProperty('sessionId');
        expect(data).toHaveProperty('message');

        const message: TerminalMessage = data.message;
        expect(message).toHaveProperty('type');
        expect(message).toHaveProperty('data');
        expect(message).toHaveProperty('timestamp');

        // セッションIDが設定されている場合のみ詳細検証を行う
        if (sessionId) {
          expect(data.sessionId).toBe(sessionId);
          
          // コマンドの出力を受信した場合（初期メッセージではない）
          if (!outputReceived && message.type !== 'system') {
            outputReceived = true;
            clientSocket.emit('terminal:stop', { sessionId });
          }
        }
      });

      clientSocket.on('terminal:stopped', () => {
        tracker.mark('ターミナル停止完了');
        done();
      });

      clientSocket.on('terminal:error', (error: Error) => {
        done(new Error(`ターミナルエラー: ${error.message}`));
      });

      // タイムアウト設定
      setTimeout(() => {
        done(new Error('ターミナルコマンド実行テストタイムアウト'));
      }, 15000);
    });
  });

  describe('プロジェクトファイル管理機能', () => {
    it('プロジェクトファイル一覧の取得ができる', async () => {
      tracker.setOperation('ファイル一覧取得テスト');

      const response = await request(app)
        .get(`/api/projects/${testProjectId}/files`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      tracker.mark('API応答受信');

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);

      tracker.mark('レスポンス検証完了');
    });

    it('新規ファイルの作成と取得ができる', async () => {
      tracker.setOperation('ファイル作成・取得テスト');

      const fileName = `test-file-${Date.now()}.txt`;
      const fileContent = `# テストファイル\\n作成日時: ${new Date().toISOString()}\\n内容: AI連携基盤統合テスト`;

      // ファイル作成
      const createResponse = await request(app)
        .put(`/api/projects/${testProjectId}/files/${encodeURIComponent(fileName)}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: fileContent,
          encoding: 'utf8'
        })
        .expect(200);

      tracker.mark('ファイル作成完了');

      expect(createResponse.body).toHaveProperty('success', true);
      expect(createResponse.body.data).toHaveProperty('success', true);
      expect(createResponse.body.data.file).toHaveProperty('path', fileName);
      expect(createResponse.body.data.file).toHaveProperty('content', fileContent);

      // ファイル取得
      const getResponse = await request(app)
        .get(`/api/projects/${testProjectId}/files/${encodeURIComponent(fileName)}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      tracker.mark('ファイル取得完了');

      expect(getResponse.body).toHaveProperty('success', true);
      expect(getResponse.body.data).toHaveProperty('exists', true);
      expect(getResponse.body.data.file).toHaveProperty('path', fileName);
      expect(getResponse.body.data.file).toHaveProperty('content', fileContent);
      expect(getResponse.body.data.file).toHaveProperty('mimeType', 'text/plain');

      tracker.mark('レスポンス検証完了');
    });

    it('既存ファイルの更新ができる', async () => {
      tracker.setOperation('ファイル更新テスト');

      const fileName = `update-test-${Date.now()}.md`;
      const initialContent = '# 初期コンテンツ\\nこれは初期バージョンです。';
      const updatedContent = '# 更新されたコンテンツ\\nこれは更新されたバージョンです。\\n\\n追加された内容があります。';

      // 初期ファイル作成
      await request(app)
        .put(`/api/projects/${testProjectId}/files/${encodeURIComponent(fileName)}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: initialContent })
        .expect(200);

      tracker.mark('初期ファイル作成完了');

      // ファイル更新
      const updateResponse = await request(app)
        .put(`/api/projects/${testProjectId}/files/${encodeURIComponent(fileName)}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: updatedContent })
        .expect(200);

      tracker.mark('ファイル更新完了');

      expect(updateResponse.body.data.file).toHaveProperty('content', updatedContent);
      expect(updateResponse.body.data.file.size).toBeGreaterThan(initialContent.length);

      // 更新内容の確認
      const verifyResponse = await request(app)
        .get(`/api/projects/${testProjectId}/files/${encodeURIComponent(fileName)}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      tracker.mark('更新確認完了');

      expect(verifyResponse.body.data.file).toHaveProperty('content', updatedContent);
    });

    it('存在しないファイルの取得で適切に処理される', async () => {
      tracker.setOperation('存在しないファイル取得テスト');

      const nonExistentFile = `non-existent-${Date.now()}.txt`;

      const response = await request(app)
        .get(`/api/projects/${testProjectId}/files/${encodeURIComponent(nonExistentFile)}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      tracker.mark('API応答受信');

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('exists', false);
      expect(response.body.data.file).toHaveProperty('path', nonExistentFile);
      expect(response.body.data.file).toHaveProperty('content', '');

      tracker.mark('レスポンス検証完了');
    });

    it('無効なプロジェクトIDでアクセス拒否される', async () => {
      tracker.setOperation('アクセス権限テスト');

      const invalidProjectId = 'invalid-project-id';

      const response = await request(app)
        .get(`/api/projects/${invalidProjectId}/files`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      tracker.mark('アクセス拒否確認');

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('AI連携基盤統合シナリオ', () => {
    it('ターミナルからファイル操作を行う統合フロー', (done) => {
      tracker.setOperation('統合フローテスト');

      const serverPort = (httpServer.address() as any)?.port;
      clientSocket = io(`http://localhost:${serverPort}`, {
        path: '/ws/socket.io',
        query: { token: authToken }
      });

      let sessionId: string;
      const testFileName = `integration-test-${Date.now()}.txt`;

      clientSocket.on('connect', () => {
        tracker.mark('WebSocket接続確立');
        clientSocket.emit('terminal:start', { projectId: testProjectId });
      });

      clientSocket.on('terminal:started', async (data: any) => {
        tracker.mark('ターミナルセッション開始');
        sessionId = data.sessionId;

        try {
          // REST APIでファイル作成
          const createResponse = await request(app)
            .put(`/api/projects/${testProjectId}/files/${encodeURIComponent(testFileName)}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              content: 'echo "Hello from AI Integration Test"'
            });

          tracker.mark('APIでファイル作成完了');
          
          // ファイル作成が成功したことを確認
          expect(createResponse.status).toBe(200);
          expect(createResponse.body.success).toBe(true);

          // ファイルシステムの書き込み完了を確実にするための短い待機
          await new Promise(resolve => setTimeout(resolve, 100));

          // ファイル存在確認を即座に実行
          const verifyResponse = await request(app)
            .get(`/api/projects/${testProjectId}/files/${encodeURIComponent(testFileName)}`)
            .set('Authorization', `Bearer ${authToken}`);

          tracker.mark('ファイル存在確認完了');

          expect(verifyResponse.status).toBe(200);
          expect(verifyResponse.body.data.exists).toBe(true);
          expect(verifyResponse.body.data.file.content).toBe('echo "Hello from AI Integration Test"');

          // ターミナルでファイル確認コマンド実行
          const listCommand = process.platform === 'win32' ? 'dir\\n' : 'ls -la\\n';
          clientSocket.emit('terminal:input', { 
            sessionId, 
            input: listCommand 
          });
          tracker.mark('ファイル確認コマンド送信');

          // 統合テスト成功 - ターミナル停止
          clientSocket.emit('terminal:stop', { sessionId });

        } catch (error) {
          done(error);
        }
      });

      // ターミナル出力を単純にログ記録のみ行う
      clientSocket.on('terminal:output', (data: any) => {
        tracker.mark('ターミナル出力受信');
        // 出力内容をログに記録（デバッグ用）
        if (data.message) {
          logger.debug('ターミナル出力:', { 
            type: data.message.type, 
            data: data.message.data?.substring(0, 100) 
          });
        }
      });

      clientSocket.on('terminal:stopped', () => {
        tracker.mark('統合フロー完了');
        done();
      });

      clientSocket.on('terminal:error', (error: Error) => {
        done(new Error(`統合フローエラー: ${error.message}`));
      });

      // タイムアウト設定
      setTimeout(() => {
        done(new Error('統合フローテストタイムアウト'));
      }, 20000);
    });
  });
});