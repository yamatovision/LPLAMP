/**
 * Phase 3 フロントエンド統合テスト
 * 
 * useAutoSaveフック、GitHubStatusBar、リアルタイム同期の
 * フロントエンド機能をテスト
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAutoSave, createEditChanges, createProjectFile } from '../hooks/useAutoSave';
import { useGitHubSync } from '../hooks/useGitHubSync';
import { GitHubStatusBar } from '../components/features/github/GitHubStatusBar';
import { AutoSaveIndicator } from '../components/features/github/AutoSaveIndicator';
import { DeployStatusIndicator } from '../components/features/github/DeployStatusIndicator';
import { DeploymentStatus, Project } from '../types';

// モックデータ
const mockProject: Project = {
  id: 'test-project-123',
  name: 'テストプロジェクト',
  url: 'https://example.com',
  status: 'ready' as any,
  githubRepo: 'test-user/test-repo',
  githubBranch: 'main',
  autoCommit: true,
  deploymentUrl: 'https://test-deploy.netlify.app',
  deployProvider: 'netlify' as any,
  userId: 'test-user-456',
  createdAt: '2025-01-09T12:00:00Z',
  updatedAt: '2025-01-09T12:00:00Z'
};

// API サービスのモック
vi.mock('../services/api/history.service', () => ({
  autoSaveService: {
    scheduleAutoSave: vi.fn().mockResolvedValue(undefined),
    explicitSave: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../services/api/github.service', () => ({
  githubService: {
    getAuthStatus: vi.fn().mockResolvedValue({
      success: true,
      data: {
        authenticated: true,
        username: 'test-user',
        scopes: ['repo', 'user:email']
      }
    })
  }
}));

// WebSocket のモック
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1, // OPEN
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

global.WebSocket = vi.fn(() => mockWebSocket) as any;

describe('Phase 3 フロントエンド統合テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // localStorage をクリア
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. useAutoSaveフック テスト', () => {
    test('1.1 フック初期化', () => {
      const { result } = renderHook(() => useAutoSave('test-project-123'));

      expect(result.current.lastSaved).toBeNull();
      expect(result.current.isSaving).toBe(false);
      expect(result.current.saveStatus).toBe('idle');
      expect(typeof result.current.triggerAutoSave).toBe('function');
      expect(typeof result.current.triggerExplicitSave).toBe('function');
      expect(typeof result.current.clearSaveStatus).toBe('function');
    });

    test('1.2 自動保存トリガー', async () => {
      const { result } = renderHook(() => useAutoSave('test-project-123'));

      const editChanges = createEditChanges(
        'テスト編集',
        [createProjectFile('index.html', '<html><body>Test</body></html>')]
      );

      await act(async () => {
        await result.current.triggerAutoSave(editChanges);
      });

      // 自動保存がトリガーされることを確認
      expect(result.current.saveStatus).toBe('saving');
    });

    test('1.3 明示的保存', async () => {
      const { result } = renderHook(() => useAutoSave('test-project-123'));

      await act(async () => {
        await result.current.triggerExplicitSave();
      });

      // 明示的保存が実行されることを確認
      expect(result.current.saveStatus).toBe('saving');
    });

    test('1.4 保存状態のクリア', async () => {
      const { result } = renderHook(() => useAutoSave('test-project-123'));

      await act(async () => {
        result.current.clearSaveStatus();
      });

      expect(result.current.saveStatus).toBe('idle');
    });

    test('1.5 Ctrl+S キーボードショートカット', async () => {
      const { result } = renderHook(() => useAutoSave('test-project-123'));

      // Ctrl+S イベントをシミュレート
      await act(async () => {
        const keyEvent = new KeyboardEvent('keydown', {
          key: 's',
          ctrlKey: true,
          preventDefault: () => {}
        });
        document.dispatchEvent(keyEvent);
      });

      // 明示的保存がトリガーされることを確認（非同期なので少し待機）
      await waitFor(() => {
        expect(result.current.saveStatus).toBe('saving');
      });
    });
  });

  describe('2. useGitHubSyncフック テスト', () => {
    test('2.1 WebSocket接続初期化', () => {
      const { result } = renderHook(() => useGitHubSync('test-project-123'));

      expect(result.current.isConnected).toBe(false);
      expect(result.current.syncState.deployStatus).toBe(DeploymentStatus.READY);
      expect(typeof result.current.connect).toBe('function');
      expect(typeof result.current.disconnect).toBe('function');
      expect(typeof result.current.sendMessage).toBe('function');
    });

    test('2.2 WebSocket接続', async () => {
      const { result } = renderHook(() => useGitHubSync('test-project-123'));

      await act(async () => {
        result.current.connect();
      });

      expect(global.WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('ws://localhost')
      );
    });

    test('2.3 WebSocket切断', async () => {
      const { result } = renderHook(() => useGitHubSync('test-project-123'));

      await act(async () => {
        result.current.connect();
        result.current.disconnect();
      });

      expect(mockWebSocket.close).toHaveBeenCalledWith(1000, 'Manual disconnect');
    });

    test('2.4 メッセージ送信', async () => {
      const { result } = renderHook(() => useGitHubSync('test-project-123'));

      const testMessage = { type: 'ping', data: 'test' };

      await act(async () => {
        result.current.sendMessage(testMessage);
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify(testMessage)
      );
    });
  });

  describe('3. GitHubStatusBar コンポーネント テスト', () => {
    test('3.1 GitHub連携情報表示', async () => {
      render(
        <GitHubStatusBar 
          project={mockProject}
          saveStatus="saved"
          lastSaved={new Date('2025-01-09T12:30:00Z')}
        />
      );

      await waitFor(() => {
        // リポジトリ情報
        expect(screen.getByText('test-user/test-repo')).toBeInTheDocument();
        expect(screen.getByText('main')).toBeInTheDocument();
        
        // WebSocket接続状態（初期は未接続）
        expect(screen.getByText('オフライン')).toBeInTheDocument();
      });
    });

    test('3.2 GitHub未連携プロジェクトの警告表示', () => {
      const noGitHubProject = { ...mockProject, githubRepo: undefined };

      render(
        <GitHubStatusBar 
          project={noGitHubProject}
          saveStatus="idle"
        />
      );

      expect(screen.getByText(/GitHub連携が設定されていません/)).toBeInTheDocument();
    });
  });

  describe('4. AutoSaveIndicator コンポーネント テスト', () => {
    test('4.1 自動保存無効状態', () => {
      render(<AutoSaveIndicator enabled={false} />);

      expect(screen.getByText('自動保存: 無効')).toBeInTheDocument();
    });

    test('4.2 保存中状態', () => {
      render(<AutoSaveIndicator enabled={true} saveStatus="saving" />);

      expect(screen.getByText('自動保存: 保存中...')).toBeInTheDocument();
    });

    test('4.3 保存済み状態', () => {
      const lastSaved = new Date('2025-01-09T12:30:00Z');
      
      render(
        <AutoSaveIndicator 
          enabled={true} 
          saveStatus="saved" 
          lastSaved={lastSaved}
        />
      );

      expect(screen.getByText('自動保存: 保存済み')).toBeInTheDocument();
      expect(screen.getByText(/12:30:00/)).toBeInTheDocument();
    });

    test('4.4 エラー状態', () => {
      render(<AutoSaveIndicator enabled={true} saveStatus="error" />);

      expect(screen.getByText('自動保存: エラー')).toBeInTheDocument();
    });
  });

  describe('5. DeployStatusIndicator コンポーネント テスト', () => {
    test('5.1 デプロイ待機状態', () => {
      render(<DeployStatusIndicator status={DeploymentStatus.PENDING} />);

      expect(screen.getByText('デプロイ待機')).toBeInTheDocument();
    });

    test('5.2 ビルド中状態', () => {
      render(<DeployStatusIndicator status={DeploymentStatus.BUILDING} />);

      expect(screen.getByText('ビルド中')).toBeInTheDocument();
    });

    test('5.3 デプロイ完了状態とURL表示', () => {
      const testUrl = 'https://test-deploy.netlify.app';
      
      render(
        <DeployStatusIndicator 
          status={DeploymentStatus.READY} 
          url={testUrl}
        />
      );

      expect(screen.getByText('デプロイ済み')).toBeInTheDocument();
      
      const linkElement = screen.getByRole('link');
      expect(linkElement).toHaveAttribute('href', testUrl);
      expect(linkElement).toHaveAttribute('target', '_blank');
    });

    test('5.4 デプロイエラー状態', () => {
      render(<DeployStatusIndicator status={DeploymentStatus.ERROR} />);

      expect(screen.getByText('デプロイエラー')).toBeInTheDocument();
    });
  });

  describe('6. ヘルパー関数テスト', () => {
    test('6.1 createEditChanges', () => {
      const description = 'テスト変更';
      const changedFiles = [
        createProjectFile('index.html', '<html></html>'),
        createProjectFile('style.css', 'body { margin: 0; }')
      ];

      const editChanges = createEditChanges(description, changedFiles);

      expect(editChanges.description).toBe(description);
      expect(editChanges.changedFiles).toEqual(changedFiles);
      expect(editChanges.timestamp).toBeDefined();
      expect(new Date(editChanges.timestamp)).toBeInstanceOf(Date);
    });

    test('6.2 createProjectFile', () => {
      const path = 'test.html';
      const content = '<html><body>Test</body></html>';
      const mimeType = 'text/html';

      const projectFile = createProjectFile(path, content, mimeType);

      expect(projectFile.path).toBe(path);
      expect(projectFile.content).toBe(content);
      expect(projectFile.mimeType).toBe(mimeType);
      expect(projectFile.size).toBe(content.length);
      expect(projectFile.lastModified).toBeDefined();
      expect(new Date(projectFile.lastModified)).toBeInstanceOf(Date);
    });
  });

  describe('7. 統合シナリオテスト', () => {
    test('7.1 編集→自動保存→状態更新フロー', async () => {
      // useAutoSaveフックとGitHubStatusBarの統合テスト
      const { result: autoSaveResult } = renderHook(() => 
        useAutoSave('test-project-123')
      );

      render(
        <GitHubStatusBar 
          project={mockProject}
          saveStatus={autoSaveResult.current.saveStatus}
          lastSaved={autoSaveResult.current.lastSaved}
        />
      );

      // 編集変更を作成
      const editChanges = createEditChanges(
        '統合テスト編集',
        [createProjectFile('index.html', '<html><body>Integration Test</body></html>')]
      );

      // 自動保存をトリガー
      await act(async () => {
        await autoSaveResult.current.triggerAutoSave(editChanges);
      });

      // 保存状態が反映されることを確認
      await waitFor(() => {
        expect(autoSaveResult.current.saveStatus).toBe('saving');
      });

      // GitHub状態表示バーに保存状態が反映されることを確認
      await waitFor(() => {
        expect(screen.getByText('自動保存: 保存中...')).toBeInTheDocument();
      });
    });

    test('7.2 リアルタイム同期イベント処理', async () => {
      const { result: syncResult } = renderHook(() => 
        useGitHubSync('test-project-123')
      );

      render(
        <GitHubStatusBar 
          project={mockProject}
          saveStatus="idle"
        />
      );

      // WebSocket接続をシミュレート
      await act(async () => {
        syncResult.current.connect();
      });

      // 同期状態の更新を確認
      expect(syncResult.current.syncState.deployStatus).toBe(DeploymentStatus.READY);
    });
  });
});