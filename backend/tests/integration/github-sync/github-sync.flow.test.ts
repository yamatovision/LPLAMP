import ioClient from 'socket.io-client';
import { app } from '../../../src/app';
import request from 'supertest';
import { MilestoneTracker } from '../../utils/MilestoneTracker';
import { httpServer } from '../../../src/server';
import { createTestUserWithToken } from '../../utils/test-auth-helper';

describe('GitHub同期WebSocket統合テスト', () => {
  let authToken: string;
  let testProject: any;
  let socket: ReturnType<typeof ioClient>;
  // let testUser: any; // 未使用
  const tracker = new MilestoneTracker();
  const wsUrl = 'http://localhost:8080'; // テスト環境のサーバーポート

  beforeAll(async () => {
    tracker.mark('テスト開始');
    
    // 認証トークン取得
    tracker.setOperation('認証設定');
    const userWithToken = await createTestUserWithToken();
    authToken = userWithToken.token;
    // testUser = userWithToken.user; // 未使用
    tracker.mark('認証完了');
  });

  beforeEach(async () => {
    // テストプロジェクト作成
    tracker.setOperation('テストデータ準備');
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const createResponse = await request(app)
      .post('/api/projects/create')
      .set('Cookie', `authToken=${authToken}`)
      .send({
        url: `https://example-${uniqueId}.com`,
        name: `Test GitHub Sync ${uniqueId}`
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.success).toBe(true);
    // レスポンス構造の正規化: data.data.projectId -> projectId
    const responseData = createResponse.body.data.data || createResponse.body.data;
    testProject = {
      projectId: responseData.projectId,
      status: responseData.status
    };
    console.log('プロジェクト作成結果:', createResponse.body);
    console.log('正規化されたプロジェクト:', testProject);
    tracker.mark('プロジェクト作成完了');
  });

  afterEach(async () => {
    // WebSocket切断
    if (socket?.connected) {
      socket.disconnect();
    }
  });

  afterAll((done) => {
    tracker.summary();
    // すべてのソケット接続を確実に切断
    if (socket?.connected) {
      socket.disconnect();
    }
    // サーバー終了の前に少し待機
    setTimeout(() => {
      httpServer.close(done);
    }, 100);
  });

  describe('9.3: GitHub同期WebSocket', () => {
    it('WebSocket接続が確立される', (done) => {
      tracker.setOperation('WebSocket接続テスト');
      
      console.log('WebSocket接続開始:', {
        url: wsUrl + '/github-sync',
        projectId: testProject?.projectId,
        hasToken: !!authToken
      });

      socket = ioClient(wsUrl + '/github-sync', {
        path: '/ws/socket.io',
        transports: ['websocket'],
        auth: {
          token: authToken,
          projectId: testProject?.projectId
        }
      });

      socket.on('connect', () => {
        tracker.mark('WebSocket接続成功');
        expect(socket.connected).toBe(true);
        done();
      });

      socket.on('connect_error', (error: Error) => {
        tracker.mark('WebSocket接続エラー');
        done(error);
      });

      // タイムアウト処理
      setTimeout(() => {
        if (!socket.connected) {
          done(new Error('WebSocket接続がタイムアウトしました'));
        }
      }, 3000); // 3秒タイムアウト
    });

    it('認証エラーで接続が拒否される', (done) => {
      tracker.setOperation('認証エラーテスト');
      
      socket = ioClient(wsUrl + '/github-sync', {
        path: '/ws/socket.io',
        transports: ['websocket'],
        auth: {
          token: 'invalid-token',
          projectId: testProject?.projectId
        }
      });

      socket.on('connect_error', (error: Error) => {
        tracker.mark('認証エラー確認');
        expect(error.message).toContain('無効な認証トークン');
        done();
      });

      socket.on('connect', () => {
        done(new Error('認証なしで接続されてしまった'));
      });

      // タイムアウト処理（認証エラーが発生しない場合）
      setTimeout(() => {
        done(new Error('認証エラーテストがタイムアウトしました'));
      }, 3000);
    });

    it('コミットイベントを受信できる', (done) => {
      tracker.setOperation('コミットイベントテスト');
      
      socket = ioClient(wsUrl + '/github-sync', {
        path: '/ws/socket.io',
        transports: ['websocket'],
        auth: {
          token: authToken,
          projectId: testProject?.projectId
        }
      });

      socket.on('connect', () => {
        tracker.mark('WebSocket接続完了');
        
        // コミットイベントリスナー設定
        socket.on('commit', (data: any) => {
          tracker.mark('コミットイベント受信');
          expect(data).toHaveProperty('commitSha');
          expect(data).toHaveProperty('message');
          expect(data).toHaveProperty('timestamp');
          expect(data.message).toBe('Test commit');
          done();
        });

        // サーバー側でコミットイベントを発生させる
        // 実際の実装では、GitHubサービスからイベントが発生する
        socket.emit('debug:trigger-commit', {
          message: 'Test commit'
        });
      });
    });

    it('デプロイイベントを受信できる', (done) => {
      tracker.setOperation('デプロイイベントテスト');
      
      socket = ioClient(wsUrl + '/github-sync', {
        path: '/ws/socket.io',
        transports: ['websocket'],
        auth: {
          token: authToken,
          projectId: testProject?.projectId
        }
      });

      socket.on('connect', () => {
        tracker.mark('WebSocket接続完了');
        
        // デプロイイベントリスナー設定
        socket.on('deploy', (data: any) => {
          tracker.mark('デプロイイベント受信');
          expect(data).toHaveProperty('status');
          expect(data).toHaveProperty('provider');
          expect(data).toHaveProperty('url');
          expect(data.status).toBe('completed');
          done();
        });

        // デプロイイベントをトリガー
        socket.emit('debug:trigger-deploy', {
          status: 'completed',
          provider: 'github-pages',
          url: 'https://test.github.io'
        });
      });
    });

    it('エラーイベントを受信できる', (done) => {
      tracker.setOperation('エラーイベントテスト');
      
      socket = ioClient(wsUrl + '/github-sync', {
        path: '/ws/socket.io',
        transports: ['websocket'],
        auth: {
          token: authToken,
          projectId: testProject?.projectId
        }
      });

      socket.on('connect', () => {
        tracker.mark('WebSocket接続完了');
        
        // エラーイベントリスナー設定
        socket.on('sync-error', (data: any) => {
          tracker.mark('エラーイベント受信');
          expect(data).toHaveProperty('error');
          expect(data).toHaveProperty('context');
          expect(data.error).toBe('Test error');
          done();
        });

        // エラーイベントをトリガー
        socket.emit('debug:trigger-error', {
          error: 'Test error',
          context: 'Testing'
        });
      });
    });

    it('ハートビートが送信される', (done) => {
      tracker.setOperation('ハートビートテスト');
      
      socket = ioClient(wsUrl + '/github-sync', {
        path: '/ws/socket.io',
        transports: ['websocket'],
        auth: {
          token: authToken,
          projectId: testProject?.projectId
        }
      });

      let heartbeatCount = 0;

      socket.on('connect', () => {
        tracker.mark('WebSocket接続完了');
        
        // ハートビートリスナー設定
        socket.on('heartbeat', (data: any) => {
          heartbeatCount++;
          tracker.mark(`ハートビート受信 ${heartbeatCount}`);
          expect(data).toHaveProperty('timestamp');
          expect(data).toHaveProperty('connectedClients');
          
          if (heartbeatCount >= 2) {
            done();
          }
        });
      });
    }, 10000); // ハートビートテスト用に10秒タイムアウト

    it('複数クライアントへのブロードキャスト', (done) => {
      tracker.setOperation('ブロードキャストテスト');
      
      let receivedCount = 0;
      
      // 2つのクライアントを作成
      const socket1 = ioClient(wsUrl + '/github-sync', {
        path: '/ws/socket.io',
        transports: ['websocket'],
        auth: {
          token: authToken,
          projectId: testProject?.projectId
        }
      });

      const socket2 = ioClient(wsUrl + '/github-sync', {
        path: '/ws/socket.io',
        transports: ['websocket'],
        auth: {
          token: authToken,
          projectId: testProject?.projectId
        }
      });

      // 両方のソケットでコミットイベントをリッスン
      socket1.on('commit', (data) => {
        receivedCount++;
        console.log('Socket1がcommitイベントを受信:', data);
        tracker.mark(`Socket1がコミット受信 (${receivedCount}/2)`);
        checkComplete();
      });

      socket2.on('commit', (data) => {
        receivedCount++;
        console.log('Socket2がcommitイベントを受信:', data);
        tracker.mark(`Socket2がコミット受信 (${receivedCount}/2)`);
        checkComplete();
      });

      // 両方が接続されたらイベントを発生させる
      let connectedCount = 0;
      
      const tryTriggerEvent = () => {
        if (connectedCount === 2) {
          tracker.mark('両方のクライアント接続完了');
          // 接続完了後、少し待ってからイベントをトリガー
          setTimeout(() => {
            console.log('debug:trigger-commitイベントを送信します', {
              socket1Connected: socket1.connected,
              socket2Connected: socket2.connected
            });
            socket1.emit('debug:trigger-commit', {
              message: 'Broadcast test'
            });
          }, 200);
        }
      };
      
      socket1.on('connect', () => {
        connectedCount++;
        console.log(`Socket1 接続完了 (${connectedCount}/2)`);
        tryTriggerEvent();
      });

      socket2.on('connect', () => {
        connectedCount++;
        console.log(`Socket2 接続完了 (${connectedCount}/2)`);
        tryTriggerEvent();
      });

      function checkComplete() {
        if (receivedCount === 2) {
          socket1.disconnect();
          socket2.disconnect();
          done();
        }
      }
    });
  });

  describe('エラーハンドリング', () => {
    it('無効なプロジェクトIDで接続エラー', (done) => {
      tracker.setOperation('無効プロジェクトIDテスト');
      
      socket = ioClient(wsUrl + '/github-sync', {
        path: '/ws/socket.io',
        transports: ['websocket'],
        auth: {
          token: authToken,
          projectId: 'invalid-project-id'
        }
      });

      socket.on('connect_error', (error: Error) => {
        tracker.mark('プロジェクトIDエラー確認');
        expect(error.message).toContain('Invalid namespace');
        done();
      });
    });

    it('切断時の再接続処理', (done) => {
      tracker.setOperation('再接続テスト');
      
      let reconnectCount = 0;
      
      socket = ioClient(wsUrl + '/github-sync', {
        path: '/ws/socket.io',
        transports: ['websocket'],
        auth: {
          token: authToken,
          projectId: testProject?.projectId
        },
        reconnection: true,
        reconnectionDelay: 100,
        reconnectionAttempts: 3
      });

      socket.on('connect', () => {
        tracker.mark('初回接続成功');
        // 強制的に切断
        socket.disconnect();
        setTimeout(() => socket.connect(), 200);
      });

      socket.on('reconnect', (attemptNumber: number) => {
        reconnectCount++;
        tracker.mark(`再接続成功 (試行: ${attemptNumber})`);
        expect(attemptNumber).toBe(1);
        done();
      });
    });
  });
});
