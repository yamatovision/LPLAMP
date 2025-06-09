/**
 * プロジェクト管理 - サービス層
 * 
 * プロジェクト関連のビジネスロジックを実装
 * レプリカ作成の開始やステータス管理も含む
 */

import { 
  Project, 
  ProjectCreate, 
  ProjectStatus, 
  ProjectCreateResponse, 
  ProjectStatusResponse,
  ProjectFileResponse,
  ProjectFileUpdateRequest,
  ProjectFileUpdateResponse,
  ProjectDirectory,
  DeployProvider,
  ID 
} from '../../types';
import { projectRepository, ProjectRepository } from './projects.model';
import { 
  validateProjectCreate, 
  validateProjectUpdate, 
  validateProjectId, 
  validateUserId,
  validateUrlFormat,
  ValidationError 
} from './projects.validator';
import { logger } from '../../common/utils/logger';
import { ProjectFileManager } from './file-manager';

/**
 * サービス層エラー
 */
export class ProjectServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ProjectServiceError';
  }
}

/**
 * プロジェクト権限エラー
 */
export class ProjectAccessError extends ProjectServiceError {
  constructor(message: string = 'このプロジェクトへのアクセス権限がありません') {
    super(message, 'ACCESS_DENIED', 403);
  }
}

/**
 * プロジェクト未発見エラー
 */
export class ProjectNotFoundError extends ProjectServiceError {
  constructor(message: string = 'プロジェクトが見つかりません') {
    super(message, 'PROJECT_NOT_FOUND', 404);
  }
}

/**
 * プロジェクトサービスクラス
 */
export class ProjectService {
  private fileManager: ProjectFileManager;

  constructor(private repository: ProjectRepository = projectRepository) {
    this.fileManager = new ProjectFileManager();
  }

  /**
   * 新規プロジェクト作成（レプリカ作成開始）
   */
  async createProject(projectData: ProjectCreate, userId: ID): Promise<ProjectCreateResponse> {
    try {
      // 入力データバリデーション
      const validatedData = validateProjectCreate(projectData);
      const validatedUserId = validateUserId(userId);
      
      // URL形式の詳細チェック
      validateUrlFormat(validatedData.url);

      logger.info('プロジェクト作成処理開始', {
        userId: validatedUserId,
        url: validatedData.url,
        name: validatedData.name
      });

      // プロジェクト作成（GitHub連携プロパティを含む）
      const project = await this.repository.create({
        ...validatedData,
        userId: validatedUserId,
        // GitHub連携情報（Phase 2で追加）
        githubRepo: validatedData.githubRepo,
        githubBranch: validatedData.githubBranch || 'main',
        deployProvider: validatedData.deployProvider as DeployProvider | undefined,
        autoCommit: validatedData.autoCommit || false
      });

      // プロジェクトディレクトリの初期化
      await this.fileManager.initializeProjectDirectory(project.id);

      // レプリカ作成処理を非同期で開始（実装は後の垂直スライスで行う）
      this.startReplicaCreation(project.id, validatedData.url).catch(error => {
        logger.error('レプリカ作成処理でエラーが発生', {
          projectId: project.id,
          error: error.message
        });
        // エラーが発生してもプロジェクト作成は成功として扱う
        this.repository.updateStatus(project.id, ProjectStatus.ERROR);
      });

      logger.info('プロジェクト作成成功', {
        projectId: project.id,
        userId: validatedUserId
      });

      return {
        success: true,
        data: {
          projectId: project.id,
          status: 'processing',
          // GitHub連携情報をレスポンスに含める
          githubRepo: project.githubRepo || undefined,
          deployUrl: project.deploymentUrl || undefined
        }
      };

    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ProjectServiceError(error.message, 'VALIDATION_ERROR', 400);
      }
      
      logger.error('プロジェクト作成でエラーが発生', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        projectData
      });
      
      throw new ProjectServiceError(
        'プロジェクトの作成に失敗しました',
        'CREATE_FAILED'
      );
    }
  }

  /**
   * プロジェクト一覧取得（ユーザー別）
   */
  async getProjectsByUser(userId: ID): Promise<Project[]> {
    try {
      const validatedUserId = validateUserId(userId);
      
      logger.debug('プロジェクト一覧取得開始', { userId: validatedUserId });

      const projects = await this.repository.findByUserId(validatedUserId);

      logger.info('プロジェクト一覧取得成功', {
        userId: validatedUserId,
        projectCount: projects.length
      });

      return projects;

    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ProjectServiceError(error.message, 'VALIDATION_ERROR', 400);
      }

      logger.error('プロジェクト一覧取得でエラーが発生', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });

      throw new ProjectServiceError(
        'プロジェクト一覧の取得に失敗しました',
        'FETCH_FAILED'
      );
    }
  }

  /**
   * プロジェクト詳細取得
   */
  async getProjectById(projectId: ID, userId: ID): Promise<Project> {
    try {
      const validatedProjectId = validateProjectId(projectId);
      const validatedUserId = validateUserId(userId);

      logger.debug('プロジェクト詳細取得開始', {
        projectId: validatedProjectId,
        userId: validatedUserId
      });

      // プロジェクト存在確認
      const project = await this.repository.findById(validatedProjectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      // アクセス権限確認
      if (!(await this.repository.isOwner(validatedProjectId, validatedUserId))) {
        throw new ProjectAccessError();
      }

      logger.info('プロジェクト詳細取得成功', {
        projectId: validatedProjectId,
        userId: validatedUserId
      });

      return project;

    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ProjectServiceError(error.message, 'VALIDATION_ERROR', 400);
      }
      if (error instanceof ProjectServiceError) {
        throw error;
      }

      logger.error('プロジェクト詳細取得でエラーが発生', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        userId
      });

      throw new ProjectServiceError(
        'プロジェクト詳細の取得に失敗しました',
        'FETCH_FAILED'
      );
    }
  }

  /**
   * プロジェクト情報更新
   */
  async updateProject(projectId: ID, updateData: any, userId: ID): Promise<Project> {
    try {
      const validatedProjectId = validateProjectId(projectId);
      const validatedUserId = validateUserId(userId);
      const validatedUpdateData = validateProjectUpdate(updateData);

      logger.debug('プロジェクト更新開始', {
        projectId: validatedProjectId,
        userId: validatedUserId,
        updateFields: Object.keys(validatedUpdateData)
      });

      // プロジェクト存在確認
      const existingProject = await this.repository.findById(validatedProjectId);
      if (!existingProject) {
        throw new ProjectNotFoundError();
      }

      // アクセス権限確認
      if (!(await this.repository.isOwner(validatedProjectId, validatedUserId))) {
        throw new ProjectAccessError();
      }

      // デプロイメントURLの追加バリデーション
      if (validatedUpdateData.deploymentUrl) {
        validateUrlFormat(validatedUpdateData.deploymentUrl);
      }

      // プロジェクト更新実行
      const updatedProject = await this.repository.update(validatedProjectId, validatedUpdateData);
      if (!updatedProject) {
        throw new ProjectServiceError('更新処理に失敗しました', 'UPDATE_FAILED');
      }

      logger.info('プロジェクト更新成功', {
        projectId: validatedProjectId,
        userId: validatedUserId,
        updateFields: Object.keys(validatedUpdateData)
      });

      return updatedProject;

    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ProjectServiceError(error.message, 'VALIDATION_ERROR', 400);
      }
      if (error instanceof ProjectServiceError) {
        throw error;
      }

      logger.error('プロジェクト更新でエラーが発生', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        userId
      });

      throw new ProjectServiceError(
        'プロジェクトの更新に失敗しました',
        'UPDATE_FAILED'
      );
    }
  }

  /**
   * プロジェクト削除
   */
  async deleteProject(projectId: ID, userId: ID): Promise<void> {
    try {
      const validatedProjectId = validateProjectId(projectId);
      const validatedUserId = validateUserId(userId);

      logger.debug('プロジェクト削除開始', {
        projectId: validatedProjectId,
        userId: validatedUserId
      });

      // プロジェクト存在確認
      const existingProject = await this.repository.findById(validatedProjectId);
      if (!existingProject) {
        throw new ProjectNotFoundError();
      }

      // アクセス権限確認
      if (!(await this.repository.isOwner(validatedProjectId, validatedUserId))) {
        throw new ProjectAccessError();
      }

      // プロジェクト削除実行
      const success = await this.repository.delete(validatedProjectId);
      if (!success) {
        throw new ProjectServiceError('削除処理に失敗しました', 'DELETE_FAILED');
      }

      logger.info('プロジェクト削除成功', {
        projectId: validatedProjectId,
        userId: validatedUserId
      });

    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ProjectServiceError(error.message, 'VALIDATION_ERROR', 400);
      }
      if (error instanceof ProjectServiceError) {
        throw error;
      }

      logger.error('プロジェクト削除でエラーが発生', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        userId
      });

      throw new ProjectServiceError(
        'プロジェクトの削除に失敗しました',
        'DELETE_FAILED'
      );
    }
  }

  /**
   * プロジェクト作成ステータス確認
   */
  async getProjectStatus(projectId: ID, userId: ID): Promise<ProjectStatusResponse> {
    try {
      const validatedProjectId = validateProjectId(projectId);
      const validatedUserId = validateUserId(userId);

      logger.debug('プロジェクトステータス確認開始', {
        projectId: validatedProjectId,
        userId: validatedUserId
      });

      // プロジェクト存在確認
      const project = await this.repository.findById(validatedProjectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      // アクセス権限確認
      if (!(await this.repository.isOwner(validatedProjectId, validatedUserId))) {
        throw new ProjectAccessError();
      }

      // ステータス変換
      let statusResponse: ProjectStatusResponse;
      switch (project.status) {
        case ProjectStatus.CREATING:
          statusResponse = {
            status: 'processing',
            progress: 50 // デモ用の進捗率
          };
          break;
        case ProjectStatus.READY:
          statusResponse = {
            status: 'completed'
          };
          break;
        case ProjectStatus.ERROR:
          statusResponse = {
            status: 'failed',
            error: 'レプリカ作成処理でエラーが発生しました'
          };
          break;
        default:
          statusResponse = {
            status: 'processing'
          };
      }

      logger.debug('プロジェクトステータス確認成功', {
        projectId: validatedProjectId,
        status: statusResponse.status
      });

      return statusResponse;

    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ProjectServiceError(error.message, 'VALIDATION_ERROR', 400);
      }
      if (error instanceof ProjectServiceError) {
        throw error;
      }

      logger.error('プロジェクトステータス確認でエラーが発生', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        userId
      });

      throw new ProjectServiceError(
        'プロジェクトステータスの確認に失敗しました',
        'STATUS_FETCH_FAILED'
      );
    }
  }

  /**
   * 編集バリエーション取得（模擬実装）
   * 実際の実装では、ClaudeCode APIとの連携を行う
   */
  async getEditVariations(
    projectId: ID, 
    elementSelector: string, 
    userId: ID
  ): Promise<any[]> {
    try {
      const validatedProjectId = validateProjectId(projectId);
      const validatedUserId = validateUserId(userId);

      logger.info('編集バリエーション取得開始', {
        projectId: validatedProjectId,
        elementSelector,
        userId: validatedUserId
      });

      // プロジェクト存在確認とアクセス権限チェック
      const project = await this.repository.findById(validatedProjectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      if (!(await this.repository.isOwner(validatedProjectId, validatedUserId))) {
        throw new ProjectAccessError();
      }

      // 模擬バリエーションデータ生成
      const variations = this.generateMockVariations(elementSelector);

      logger.info('編集バリエーション取得完了', {
        projectId: validatedProjectId,
        elementSelector,
        variationCount: variations.length
      });

      return variations;

    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ProjectServiceError(error.message, 'VALIDATION_ERROR', 400);
      }
      if (error instanceof ProjectServiceError) {
        throw error;
      }

      logger.error('編集バリエーション取得でエラーが発生', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        elementSelector,
        userId
      });

      throw new ProjectServiceError(
        '編集バリエーションの取得に失敗しました',
        'VARIATIONS_FETCH_FAILED'
      );
    }
  }

  /**
   * 模擬バリエーションデータ生成
   */
  private generateMockVariations(elementSelector: string): any[] {
    const baseId = Date.now();
    return [
      {
        id: `var_${baseId}_1`,
        elementSelector,
        content: '提案1: より魅力的な表現に変更',
        preview: '<div style="color: #2563eb; font-weight: bold;">改善されたコンテンツ案1</div>',
        selected: false
      },
      {
        id: `var_${baseId}_2`,
        elementSelector,
        content: '提案2: 簡潔で分かりやすい表現',
        preview: '<div style="color: #059669; font-size: 18px;">改善されたコンテンツ案2</div>',
        selected: false
      },
      {
        id: `var_${baseId}_3`,
        elementSelector,
        content: '提案3: 感情に訴えかける表現',
        preview: '<div style="color: #dc2626; font-style: italic;">改善されたコンテンツ案3</div>',
        selected: false
      }
    ];
  }

  /**
   * レプリカ作成処理開始（非同期）
   */
  private async startReplicaCreation(projectId: ID, url: string): Promise<void> {
    logger.info('レプリカ作成処理開始', { projectId, url });
    
    // 非同期でレプリカを作成
    setImmediate(async () => {
      try {
        // Puppeteerでウェブサイトをレプリケート（JavaScript無効化）
        const { WebsiteReplicator } = await import('../../common/utils/website-replicator.js');
        const replicator = new WebsiteReplicator(url, undefined, true); // JavaScript無効化
        const result = await replicator.replicate();
        
        if (result.success) {
          // レプリカサービスを使ってデータベースに保存
          const { replicaService } = await import('../replica/replica.service.js');
          await replicaService.createReplica(projectId, result.html, result.css);
          
          // プロジェクトステータスをREADYに更新
          await this.repository.updateStatus(projectId, ProjectStatus.READY);
          logger.info('レプリカ作成完了', { projectId, url });
        } else {
          throw new Error(`レプリカ作成失敗: ${result.error}`);
        }
        
      } catch (error) {
        logger.error('レプリカ作成でエラー', { 
          projectId, 
          url,
          error: error instanceof Error ? error.message : String(error) 
        });
        await this.repository.updateStatus(projectId, ProjectStatus.ERROR);
      }
    });
  }

  /**
   * プロジェクトファイル取得
   */
  async getProjectFile(projectId: ID, filePath: string, userId: ID): Promise<ProjectFileResponse> {
    try {
      const validatedProjectId = validateProjectId(projectId);
      const validatedUserId = validateUserId(userId);

      logger.debug('プロジェクトファイル取得開始', {
        projectId: validatedProjectId,
        filePath,
        userId: validatedUserId
      });

      // プロジェクト存在確認とアクセス権限チェック
      const project = await this.repository.findById(validatedProjectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      if (!(await this.repository.isOwner(validatedProjectId, validatedUserId))) {
        throw new ProjectAccessError();
      }

      // ファイル取得
      const file = await this.fileManager.getFile(validatedProjectId, filePath);
      
      logger.info('プロジェクトファイル取得成功', {
        projectId: validatedProjectId,
        filePath,
        exists: !!file
      });

      return {
        file: file || {
          path: filePath,
          content: '',
          size: 0,
          mimeType: 'text/plain',
          lastModified: new Date().toISOString()
        },
        exists: !!file
      };

    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ProjectServiceError(error.message, 'VALIDATION_ERROR', 400);
      }
      if (error instanceof ProjectServiceError) {
        throw error;
      }

      logger.error('プロジェクトファイル取得でエラーが発生', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        filePath,
        userId
      });

      throw new ProjectServiceError(
        'プロジェクトファイルの取得に失敗しました',
        'FILE_FETCH_FAILED'
      );
    }
  }

  /**
   * プロジェクトファイル更新
   */
  async updateProjectFile(
    projectId: ID, 
    filePath: string, 
    updateRequest: ProjectFileUpdateRequest, 
    userId: ID
  ): Promise<ProjectFileUpdateResponse> {
    try {
      const validatedProjectId = validateProjectId(projectId);
      const validatedUserId = validateUserId(userId);

      logger.debug('プロジェクトファイル更新開始', {
        projectId: validatedProjectId,
        filePath,
        userId: validatedUserId,
        contentLength: updateRequest.content.length
      });

      // プロジェクト存在確認とアクセス権限チェック
      const project = await this.repository.findById(validatedProjectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      if (!(await this.repository.isOwner(validatedProjectId, validatedUserId))) {
        throw new ProjectAccessError();
      }

      // ファイル更新
      const updatedFile = await this.fileManager.updateFile(
        validatedProjectId, 
        filePath, 
        updateRequest
      );

      logger.info('プロジェクトファイル更新成功', {
        projectId: validatedProjectId,
        filePath,
        newSize: updatedFile.size
      });

      return {
        success: true,
        file: updatedFile
      };

    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ProjectServiceError(error.message, 'VALIDATION_ERROR', 400);
      }
      if (error instanceof ProjectServiceError) {
        throw error;
      }

      logger.error('プロジェクトファイル更新でエラーが発生', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        filePath,
        userId
      });

      throw new ProjectServiceError(
        'プロジェクトファイルの更新に失敗しました',
        'FILE_UPDATE_FAILED'
      );
    }
  }

  /**
   * プロジェクトディレクトリ一覧取得
   */
  async getProjectDirectory(projectId: ID, dirPath: string = '', userId: ID): Promise<ProjectDirectory[]> {
    try {
      const validatedProjectId = validateProjectId(projectId);
      const validatedUserId = validateUserId(userId);

      logger.debug('プロジェクトディレクトリ一覧取得開始', {
        projectId: validatedProjectId,
        dirPath,
        userId: validatedUserId
      });

      // プロジェクト存在確認とアクセス権限チェック
      const project = await this.repository.findById(validatedProjectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      if (!(await this.repository.isOwner(validatedProjectId, validatedUserId))) {
        throw new ProjectAccessError();
      }

      // ディレクトリ一覧取得
      const directories = await this.fileManager.listDirectory(validatedProjectId, dirPath);

      logger.info('プロジェクトディレクトリ一覧取得成功', {
        projectId: validatedProjectId,
        dirPath,
        itemCount: directories.length
      });

      return directories;

    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ProjectServiceError(error.message, 'VALIDATION_ERROR', 400);
      }
      if (error instanceof ProjectServiceError) {
        throw error;
      }

      // ディレクトリが見つからない場合
      if (error instanceof Error && error.message.includes('ディレクトリが見つかりません')) {
        throw new ProjectServiceError(
          'ディレクトリが見つかりません',
          'DIRECTORY_NOT_FOUND',
          404
        );
      }

      // パストラバーサル攻撃の場合
      if (error instanceof Error && error.message.includes('Invalid path')) {
        throw new ProjectServiceError(
          '無効なパス',
          'INVALID_PATH',
          400
        );
      }

      logger.error('プロジェクトディレクトリ一覧取得でエラーが発生', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        dirPath,
        userId
      });

      throw new ProjectServiceError(
        'プロジェクトディレクトリ一覧の取得に失敗しました',
        'DIRECTORY_FETCH_FAILED'
      );
    }
  }

  /**
   * プロジェクトファイルツリー取得
   */
  async getProjectTree(projectId: ID, userId: ID): Promise<ProjectDirectory> {
    try {
      const validatedProjectId = validateProjectId(projectId);
      const validatedUserId = validateUserId(userId);

      logger.debug('プロジェクトファイルツリー取得開始', {
        projectId: validatedProjectId,
        userId: validatedUserId
      });

      // プロジェクト存在確認とアクセス権限チェック
      const project = await this.repository.findById(validatedProjectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      if (!(await this.repository.isOwner(validatedProjectId, validatedUserId))) {
        throw new ProjectAccessError();
      }

      // ファイルツリー取得
      const tree = await this.fileManager.getProjectTree(validatedProjectId);

      logger.info('プロジェクトファイルツリー取得成功', {
        projectId: validatedProjectId
      });

      return tree;

    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ProjectServiceError(error.message, 'VALIDATION_ERROR', 400);
      }
      if (error instanceof ProjectServiceError) {
        throw error;
      }

      logger.error('プロジェクトファイルツリー取得でエラーが発生', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        userId
      });

      throw new ProjectServiceError(
        'プロジェクトファイルツリーの取得に失敗しました',
        'TREE_FETCH_FAILED'
      );
    }
  }

  /**
   * 自動保存
   * @param projectId - プロジェクトID
   * @param changes - 編集内容
   * @param userId - ユーザーID
   * @returns 自動保存スケジューリング結果
   */
  async autoSave(projectId: ID, changes: any, userId: ID): Promise<{ scheduled: boolean }> {
    try {
      // プロジェクト存在確認とアクセス権限チェック
      const project = await this.repository.findById(projectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      if (!(await this.repository.isOwner(projectId, userId))) {
        throw new ProjectAccessError();
      }

      // 自動保存サービスを使用してスケジューリング
      const { autoSaveService } = await import('../history/auto-save.service');
      await autoSaveService.scheduleAutoSave(projectId, changes, userId);

      logger.info('自動保存スケジュール成功', {
        projectId,
        userId
      });

      return { scheduled: true };

    } catch (error) {
      if (error instanceof ProjectServiceError) {
        throw error;
      }

      logger.error('自動保存でエラーが発生', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        userId
      });

      throw new ProjectServiceError(
        '自動保存のスケジューリングに失敗しました',
        'AUTO_SAVE_FAILED'
      );
    }
  }

  /**
   * 明示的保存
   * @param projectId - プロジェクトID
   * @param changes - 編集内容
   * @param userId - ユーザーID
   * @returns 明示的保存結果
   */
  async explicitSave(projectId: ID, changes: any, userId: ID): Promise<{ saved: boolean }> {
    try {
      // プロジェクト存在確認とアクセス権限チェック
      const project = await this.repository.findById(projectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      if (!(await this.repository.isOwner(projectId, userId))) {
        throw new ProjectAccessError();
      }

      // 明示的保存の実行
      const { autoSaveService } = await import('../history/auto-save.service');
      await autoSaveService.explicitSave(projectId, changes, userId);

      logger.info('明示的保存成功', {
        projectId,
        userId
      });

      return { saved: true };

    } catch (error) {
      if (error instanceof ProjectServiceError) {
        throw error;
      }

      logger.error('明示的保存でエラーが発生', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        userId
      });

      throw new ProjectServiceError(
        '明示的保存に失敗しました',
        'EXPLICIT_SAVE_FAILED'
      );
    }
  }
}

/**
 * プロジェクトサービスのシングルトンインスタンス
 */
export const projectService = new ProjectService();