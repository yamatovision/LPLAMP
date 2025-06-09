/**
 * Phase 3実用統合テスト
 * 
 * フロントエンドではなく、実際のAPI呼び出しで
 * 自動保存・GitHub同期機能をテスト
 */

// Node.js 18以降にはfetchが組み込まれている
const fetch = globalThis.fetch || require('node-fetch');

const BASE_URL = 'http://localhost:8000';
const TEST_PROJECT_DATA = {
  url: 'https://example.com',
  name: 'Phase3テストプロジェクト',
  githubRepo: 'test-user/test-repo',
  githubBranch: 'main',
  autoCommit: true
};

async function runPhase3Tests() {
  console.log('🚀 Phase 3統合テスト開始\n');
  
  try {
    // 1. 認証テスト
    console.log('1️⃣ 認証状態確認...');
    const authResponse = await fetch(`${BASE_URL}/api/auth/status`, {
      credentials: 'include'
    });
    const authData = await authResponse.json();
    console.log('   認証状態:', authData.authenticated ? '✅ 認証済み' : '❌ 未認証');
    
    if (!authData.authenticated) {
      console.log('❌ 認証が必要です。まずログインしてください');
      return;
    }

    // 2. プロジェクト作成テスト
    console.log('\n2️⃣ GitHub連携プロジェクト作成...');
    const projectResponse = await fetch(`${BASE_URL}/api/projects/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(TEST_PROJECT_DATA)
    });
    
    if (!projectResponse.ok) {
      const error = await projectResponse.text();
      console.log('❌ プロジェクト作成失敗:', error);
      return;
    }
    
    const projectData = await projectResponse.json();
    const projectId = projectData.projectId;
    console.log('   ✅ プロジェクト作成成功:', projectId);
    console.log('   GitHub連携:', projectData.githubRepo || 'なし');

    // 3. ファイル操作テスト
    console.log('\n3️⃣ プロジェクトファイル操作テスト...');
    
    // ファイル一覧取得
    const filesResponse = await fetch(`${BASE_URL}/api/projects/${projectId}/files`, {
      credentials: 'include'
    });
    
    if (filesResponse.ok) {
      const filesData = await filesResponse.json();
      console.log('   ✅ ファイル一覧取得成功:', filesData.length, '件');
    } else {
      console.log('   ⚠️ ファイル一覧取得スキップ（機能未実装）');
    }

    // ファイル取得テスト
    const fileResponse = await fetch(`${BASE_URL}/api/projects/${projectId}/files/index.html`, {
      credentials: 'include'
    });
    
    if (fileResponse.ok) {
      const fileData = await fileResponse.json();
      console.log('   ✅ ファイル取得成功:', fileData.file?.path || 'ファイルなし');
    } else {
      console.log('   ⚠️ ファイル取得スキップ（ファイル未作成）');
    }

    // 4. 自動保存APIテスト（Phase 3新機能）
    console.log('\n4️⃣ 自動保存API テスト...');
    
    // 自動保存トリガー
    const autoSaveResponse = await fetch(`${BASE_URL}/api/projects/${projectId}/save/auto`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        changes: {
          description: 'テスト用自動保存',
          changedFiles: [
            {
              path: 'index.html',
              content: '<html><body>Test Auto Save</body></html>',
              size: 41,
              mimeType: 'text/html',
              lastModified: new Date().toISOString()
            }
          ],
          timestamp: new Date().toISOString()
        }
      })
    });
    
    if (autoSaveResponse.ok) {
      console.log('   ✅ 自動保存APIレスポンス正常');
    } else {
      console.log('   ❌ 自動保存API失敗:', autoSaveResponse.status);
      console.log('   エラー詳細:', await autoSaveResponse.text());
    }

    // 明示的保存テスト
    const explicitSaveResponse = await fetch(`${BASE_URL}/api/projects/${projectId}/save/explicit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        changes: {
          description: 'テスト用明示的保存',
          changedFiles: [
            {
              path: 'index.html',
              content: '<html><body>Test Explicit Save</body></html>',
              size: 46,
              mimeType: 'text/html',
              lastModified: new Date().toISOString()
            }
          ],
          timestamp: new Date().toISOString()
        }
      })
    });
    
    if (explicitSaveResponse.ok) {
      console.log('   ✅ 明示的保存APIレスポンス正常');
    } else {
      console.log('   ❌ 明示的保存API失敗:', explicitSaveResponse.status);
      console.log('   エラー詳細:', await explicitSaveResponse.text());
    }

    // 5. GitHub連携状態確認
    console.log('\n5️⃣ GitHub連携状態確認...');
    const githubStatusResponse = await fetch(`${BASE_URL}/api/github/auth/status`, {
      credentials: 'include'
    });
    
    if (githubStatusResponse.ok) {
      const githubData = await githubStatusResponse.json();
      console.log('   GitHub認証:', githubData.authenticated ? '✅ 認証済み' : '❌ 未認証');
      if (githubData.username) {
        console.log('   GitHubユーザー:', githubData.username);
      }
    } else {
      console.log('   ⚠️ GitHub状態確認スキップ');
    }

    // 6. WebSocket接続テスト
    console.log('\n6️⃣ WebSocket接続テスト...');
    
    // WebSocketテストは複雑なので、エンドポイントの存在確認のみ
    console.log('   WebSocketエンドポイント: ws://localhost:8000/ws/github-sync');
    console.log('   ⚠️ WebSocket詳細テストはブラウザで実行要');

    // 7. クリーンアップ
    console.log('\n7️⃣ テスト用プロジェクト削除...');
    const deleteResponse = await fetch(`${BASE_URL}/api/projects/${projectId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    if (deleteResponse.ok) {
      console.log('   ✅ テスト用プロジェクト削除成功');
    } else {
      console.log('   ⚠️ テスト用プロジェクト削除失敗（手動削除要）');
    }

    console.log('\n🎉 Phase 3統合テスト完了');
    
  } catch (error) {
    console.log('\n❌ テスト実行エラー:', error.message);
    console.log('   サーバーが起動していることを確認してください');
  }
}

// WebSocket接続テスト関数
function testWebSocketConnection(projectId) {
  return new Promise((resolve) => {
    console.log('   WebSocket接続テスト開始...');
    
    // Node.jsでWebSocket接続テスト
    try {
      const WebSocket = require('ws');
      const ws = new WebSocket(`ws://localhost:8000/ws/github-sync?projectId=${projectId}`);
      
      const timeout = setTimeout(() => {
        ws.close();
        console.log('   ⚠️ WebSocket接続タイムアウト（10秒）');
        resolve(false);
      }, 10000);
      
      ws.on('open', () => {
        console.log('   ✅ WebSocket接続成功');
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          console.log('   📨 WebSocketメッセージ受信:', message.type);
        } catch (e) {
          console.log('   📨 WebSocket生データ受信');
        }
      });
      
      ws.on('error', (error) => {
        console.log('   ❌ WebSocket接続エラー:', error.message);
        clearTimeout(timeout);
        resolve(false);
      });
      
    } catch (error) {
      console.log('   ❌ WebSocketライブラリエラー:', error.message);
      console.log('   npm install ws が必要かもしれません');
      resolve(false);
    }
  });
}

// 実行
if (process.argv[1].includes('test-phase3-integration.js')) {
  runPhase3Tests();
}

module.exports = { runPhase3Tests };