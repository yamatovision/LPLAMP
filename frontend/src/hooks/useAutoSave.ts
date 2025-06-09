/**
 * 自動保存フック
 * 
 * エディター画面での自動保存機能を提供
 * デバウンス機能付きの自動保存と明示的保存（Ctrl+S）をサポート
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ProjectFile, EditChanges } from '@/types';
import { logger } from '@/utils/logger';

/**
 * 保存状態の型定義
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * useAutoSaveフックの戻り値型
 */
export interface UseAutoSaveReturn {
  lastSaved: Date | null;
  isSaving: boolean;
  saveStatus: SaveStatus;
  triggerAutoSave: (changes: EditChanges) => Promise<void>;
  triggerExplicitSave: () => Promise<void>;
  clearSaveStatus: () => void;
}

/**
 * 自動保存フック
 */
export const useAutoSave = (projectId: string): UseAutoSaveReturn => {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  
  // デバウンス用のタイマー参照
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingChangesRef = useRef<EditChanges | null>(null);
  
  // 設定
  const DEBOUNCE_DELAY = 2000; // 2秒

  /**
   * 実際の保存処理を実行
   */
  const executeSave = useCallback(async (changes: EditChanges, isExplicit = false): Promise<void> => {
    try {
      setIsSaving(true);
      setSaveStatus('saving');

      logger.info('自動保存実行開始', {
        component: 'useAutoSave',
        projectId,
        changedFileCount: changes.changedFiles.length,
        isExplicit
      });

      // AutoSaveService経由で保存
      const { autoSaveService } = await import('@/services/api/history.service');
      
      if (isExplicit) {
        await autoSaveService.explicitSave(projectId, changes);
      } else {
        await autoSaveService.scheduleAutoSave(projectId, changes);
      }

      // 成功時の状態更新
      setLastSaved(new Date());
      setSaveStatus('saved');
      
      logger.info('自動保存完了', {
        component: 'useAutoSave',
        projectId,
        isExplicit
      });

      // 「保存済み」状態を3秒後にクリア
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);

    } catch (error) {
      setSaveStatus('error');
      
      logger.error('自動保存エラー', {
        component: 'useAutoSave',
        projectId,
        error: error instanceof Error ? error.message : String(error),
        isExplicit
      });

      // エラー状態を5秒後にクリア
      setTimeout(() => {
        setSaveStatus('idle');
      }, 5000);

    } finally {
      setIsSaving(false);
    }
  }, [projectId]);

  /**
   * 自動保存トリガー（デバウンス付き）
   */
  const triggerAutoSave = useCallback(async (changes: EditChanges): Promise<void> => {
    // 変更内容を保存
    pendingChangesRef.current = changes;

    // 既存タイマーをクリア
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // 新しいタイマーを設定
    saveTimerRef.current = setTimeout(() => {
      if (pendingChangesRef.current) {
        executeSave(pendingChangesRef.current, false);
        pendingChangesRef.current = null;
      }
    }, DEBOUNCE_DELAY);

    logger.debug('自動保存スケジュール設定', {
      component: 'useAutoSave',
      projectId,
      debounceDelay: DEBOUNCE_DELAY
    });
  }, [executeSave, projectId]);

  /**
   * 明示的保存（Ctrl+S等）
   */
  const triggerExplicitSave = useCallback(async (): Promise<void> => {
    // タイマーをクリア
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    // 保留中の変更があればそれを使用、なければダミーの変更を作成
    const changes: EditChanges = pendingChangesRef.current || {
      description: '明示的保存',
      changedFiles: [], // 実際の実装では現在のファイル状態を取得
      timestamp: new Date().toISOString()
    };

    pendingChangesRef.current = null;
    await executeSave(changes, true);
  }, [executeSave]);

  /**
   * 保存状態のクリア
   */
  const clearSaveStatus = useCallback(() => {
    setSaveStatus('idle');
  }, []);

  /**
   * Ctrl+Sキーボードショートカットの設定
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        triggerExplicitSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [triggerExplicitSave]);

  /**
   * クリーンアップ
   */
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  return {
    lastSaved,
    isSaving,
    saveStatus,
    triggerAutoSave,
    triggerExplicitSave,
    clearSaveStatus
  };
};

/**
 * 編集変更を作成するヘルパー関数
 */
export const createEditChanges = (
  description: string,
  changedFiles: ProjectFile[]
): EditChanges => {
  return {
    description,
    changedFiles,
    timestamp: new Date().toISOString()
  };
};

/**
 * プロジェクトファイルを作成するヘルパー関数
 */
export const createProjectFile = (
  path: string,
  content: string,
  mimeType: string = 'text/html'
): ProjectFile => {
  return {
    path,
    content,
    size: new Blob([content]).size,
    mimeType,
    lastModified: new Date().toISOString()
  };
};