/**
 * 自動保存サービス
 * 
 * ハイブリッドアプローチによる自動コミット機能を提供
 * デバウンス、定期保存、明示的保存をサポート
 */

import { ID, EditChanges, ProjectFile } from '../../types/index.js';
import { projectService, ProjectService } from '../projects/projects.service.js';
import { GitHubService } from '../github/github.service.js';
import { logger } from '../../common/utils/logger.js';

/**
 * 編集変更情報
 */
export interface EditChanges {
  description?: string;
  changedFiles: ProjectFile[];
  timestamp: string;
}

/**
 * 自動保存サービス実装
 */
export class AutoSaveService {
  private saveTimers = new Map<string, NodeJS.Timeout>();
  private intervalTimers = new Map<string, NodeJS.Timeout>();
  private readonly DEBOUNCE_DELAY = 2000; // 2秒
  private readonly MAX_INTERVAL = 30000;  // 30秒最大間隔

  constructor(
    private projectService: ProjectService = projectService,
    private githubService: GitHubService = GitHubService
  ) {}

  /**
   * 編集イベント発生時の自動保存制御
   */
  async scheduleAutoSave(projectId: ID, changes: EditChanges, userId: ID): Promise<void> {
    try {
      const project = await this.projectService.getProjectById(projectId, userId);

      if (!project.autoCommit) {
        logger.debug('自動コミット無効のためスキップ', {
          projectId,
          autoCommit: project.autoCommit
        });
        return;
      }

      // 既存タイマーをクリア（デバウンス）
      const existingTimer = this.saveTimers.get(projectId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        logger.debug('既存の自動保存タイマーをクリア', { projectId });
      }

      // 新しいタイマー設定
      const timer = setTimeout(async () => {
        await this.executeAutoSave(projectId, changes, userId);
        this.saveTimers.delete(projectId);
      }, this.DEBOUNCE_DELAY);

      this.saveTimers.set(projectId, timer);

      // 定期保存タイマーの設定（初回のみ）
      if (!this.intervalTimers.has(projectId)) {
        this.setupPeriodicSave(projectId, userId);
      }

      logger.debug('自動保存スケジュール設定完了', {
        projectId,
        debounceDelay: this.DEBOUNCE_DELAY
      });

    } catch (error) {
      logger.error('自動保存スケジュール設定エラー', {
        projectId,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 明示的な保存（Ctrl+S等）
   */
  async explicitSave(projectId: ID, changes: EditChanges, userId: ID): Promise<void> {
    try {
      logger.info('明示的保存開始', { projectId, userId });

      // 既存のタイマーをクリア
      this.clearTimers(projectId);

      // 即座に保存実行
      await this.executeAutoSave(projectId, changes, userId);

      logger.info('明示的保存完了', { projectId, userId });

    } catch (error) {
      logger.error('明示的保存エラー', {
        projectId,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 定期保存の設定
   */
  private setupPeriodicSave(projectId: ID, userId: ID): void {
    const intervalTimer = setInterval(async () => {
      try {
        // 最後の編集から30秒経過していたら強制保存
        const lastChangeFile = await this.getLastChangeFile(projectId);
        if (lastChangeFile) {
          logger.info('定期保存実行', { projectId });
          await this.executeAutoSave(projectId, {
            description: '定期保存',
            changedFiles: [lastChangeFile],
            timestamp: new Date().toISOString()
          }, userId);
        }
      } catch (error) {
        logger.error('定期保存エラー', {
          projectId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, this.MAX_INTERVAL);

    this.intervalTimers.set(projectId, intervalTimer);
  }

  /**
   * 実際の自動保存処理
   */
  private async executeAutoSave(projectId: ID, changes: EditChanges, userId: ID): Promise<void> {
    try {
      logger.info('自動保存実行開始', {
        projectId,
        userId,
        changedFileCount: changes.changedFiles.length
      });

      const project = await this.projectService.getProjectById(projectId, userId);
      
      if (!project.githubRepo) {
        logger.debug('GitHubリポジトリ未設定のため自動保存スキップ', { projectId });
        return;
      }

      // GitHubにコミット
      const commitMessage = changes.description || `Auto-commit: ${new Date().toISOString()}`;
      
      const commitResult = await this.githubService.commitFiles(
        userId,
        project.githubRepo,
        project.githubBranch || 'main',
        changes.changedFiles,
        commitMessage
      );

      logger.info('自動保存実行完了', {
        projectId,
        userId,
        commitSha: commitResult.sha,
        changedFileCount: changes.changedFiles.length
      });

    } catch (error) {
      logger.error('自動保存実行エラー', {
        projectId,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 最後に変更されたファイルの取得（ダミー実装）
   */
  private async getLastChangeFile(projectId: ID): Promise<ProjectFile | null> {
    try {
      // 実際の実装では、プロジェクトディレクトリから最新ファイルを取得
      // ここではダミーファイルを返す
      return {
        path: 'index.html',
        content: '<!-- Auto-save checkpoint -->',
        size: 30,
        mimeType: 'text/html',
        lastModified: new Date().toISOString()
      };
    } catch (error) {
      logger.error('最終変更ファイル取得エラー', {
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * タイマーのクリア
   */
  private clearTimers(projectId: ID): void {
    const saveTimer = this.saveTimers.get(projectId);
    if (saveTimer) {
      clearTimeout(saveTimer);
      this.saveTimers.delete(projectId);
    }

    const intervalTimer = this.intervalTimers.get(projectId);
    if (intervalTimer) {
      clearInterval(intervalTimer);
      this.intervalTimers.delete(projectId);
    }

    logger.debug('タイマークリア完了', { projectId });
  }

  /**
   * プロジェクト削除時のクリーンアップ
   */
  async cleanupProject(projectId: ID): Promise<void> {
    this.clearTimers(projectId);
    logger.info('プロジェクト自動保存設定クリーンアップ完了', { projectId });
  }

  /**
   * サービス停止時のクリーンアップ
   */
  async shutdown(): Promise<void> {
    // 全てのタイマーをクリア
    for (const [projectId] of this.saveTimers) {
      this.clearTimers(projectId);
    }

    logger.info('自動保存サービス停止完了');
  }

  /**
   * 現在のタイマー状態の取得（デバッグ用）
   */
  getTimerStatus(): { activeProjects: string[], saveTimerCount: number, intervalTimerCount: number } {
    return {
      activeProjects: Array.from(this.saveTimers.keys()),
      saveTimerCount: this.saveTimers.size,
      intervalTimerCount: this.intervalTimers.size
    };
  }
}

/**
 * 自動保存サービスのシングルトンインスタンス
 */
export const autoSaveService = new AutoSaveService();