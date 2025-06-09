/**
 * プロジェクト管理 - データモデルとリポジトリ
 * 
 * プロジェクトデータの永続化とビジネスロジックを提供
 * InMemoryRepositoryパターンでテスト容易性を重視した設計
 */

import { Project, ProjectBase, ProjectCreate, ProjectStatus, ID } from '../../types';
import { logger } from '../../common/utils/logger';
import { randomUUID } from 'crypto';

// element.service.tsで使用されるためProject型を再エクスポート
export type { Project } from '../../types';

/**
 * プロジェクトリポジトリインターフェース
 * テスト時と本番時でRepositoryの実装を切り替え可能
 */
export interface ProjectRepository {
  /**
   * 新規プロジェクト作成
   */
  create(projectData: ProjectCreate & { userId: ID }): Promise<Project>;
  
  /**
   * プロジェクト一覧取得（ユーザー別）
   */
  findByUserId(userId: ID): Promise<Project[]>;
  
  /**
   * プロジェクト詳細取得
   */
  findById(projectId: ID): Promise<Project | null>;
  
  /**
   * プロジェクト情報更新
   */
  update(projectId: ID, updateData: Partial<ProjectBase>): Promise<Project | null>;
  
  /**
   * プロジェクト削除
   */
  delete(projectId: ID): Promise<boolean>;
  
  /**
   * プロジェクトステータス更新
   */
  updateStatus(projectId: ID, status: ProjectStatus): Promise<Project | null>;
  
  /**
   * ユーザーがプロジェクトの所有者かチェック
   */
  isOwner(projectId: ID, userId: ID): Promise<boolean>;
}

/**
 * インメモリプロジェクトリポジトリ
 * テスト用実装、将来的にデータベース実装に置き換え可能
 */
export class InMemoryProjectRepository implements ProjectRepository {
  private projects: Map<ID, Project> = new Map();

  /**
   * 新規プロジェクト作成
   */
  async create(projectData: ProjectCreate & { userId: ID }): Promise<Project> {
    const projectId = randomUUID();
    const now = new Date().toISOString();
    
    const project: Project = {
      id: projectId,
      name: projectData.name || this.generateProjectName(projectData.url),
      url: projectData.url,
      userId: projectData.userId,
      status: ProjectStatus.CREATING,
      thumbnail: null,
      githubRepo: null,
      deploymentUrl: null,
      createdAt: now,
      updatedAt: now
    };

    this.projects.set(projectId, project);
    
    logger.info('プロジェクト作成完了', {
      projectId,
      userId: projectData.userId,
      url: projectData.url,
      name: project.name
    });

    return project;
  }

  /**
   * プロジェクト一覧取得（ユーザー別）
   */
  async findByUserId(userId: ID): Promise<Project[]> {
    const userProjects = Array.from(this.projects.values())
      .filter(project => project.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    logger.debug('ユーザープロジェクト一覧取得', {
      userId,
      projectCount: userProjects.length
    });

    return userProjects;
  }

  /**
   * プロジェクト詳細取得
   */
  async findById(projectId: ID): Promise<Project | null> {
    const project = this.projects.get(projectId) || null;
    
    if (project) {
      logger.debug('プロジェクト詳細取得成功', { projectId });
    } else {
      logger.warn('プロジェクトが見つかりません', { projectId });
    }

    return project;
  }

  /**
   * プロジェクト情報更新
   */
  async update(projectId: ID, updateData: Partial<ProjectBase>): Promise<Project | null> {
    const existingProject = this.projects.get(projectId);
    if (!existingProject) {
      logger.warn('更新対象プロジェクトが見つかりません', { projectId });
      return null;
    }

    const updatedProject: Project = {
      ...existingProject,
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    this.projects.set(projectId, updatedProject);
    
    logger.info('プロジェクト更新完了', {
      projectId,
      updateFields: Object.keys(updateData)
    });

    return updatedProject;
  }

  /**
   * プロジェクト削除
   */
  async delete(projectId: ID): Promise<boolean> {
    const success = this.projects.delete(projectId);
    
    if (success) {
      logger.info('プロジェクト削除完了', { projectId });
    } else {
      logger.warn('削除対象プロジェクトが見つかりません', { projectId });
    }

    return success;
  }

  /**
   * プロジェクトステータス更新
   */
  async updateStatus(projectId: ID, status: ProjectStatus): Promise<Project | null> {
    const project = this.projects.get(projectId);
    if (!project) {
      logger.warn('ステータス更新対象プロジェクトが見つかりません', { projectId });
      return null;
    }

    const updatedProject: Project = {
      ...project,
      status,
      updatedAt: new Date().toISOString()
    };

    this.projects.set(projectId, updatedProject);
    
    logger.info('プロジェクトステータス更新完了', {
      projectId,
      oldStatus: project.status,
      newStatus: status
    });

    return updatedProject;
  }

  /**
   * ユーザーがプロジェクトの所有者かチェック
   */
  async isOwner(projectId: ID, userId: ID): Promise<boolean> {
    const project = this.projects.get(projectId);
    const isOwner = project?.userId === userId;
    
    logger.debug('プロジェクト所有者チェック', {
      projectId,
      userId,
      isOwner
    });

    return isOwner;
  }

  /**
   * URLからプロジェクト名を生成
   */
  private generateProjectName(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');
      const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      
      return `${hostname} - ${timestamp}`;
    } catch (error) {
      const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      return `Project - ${timestamp}`;
    }
  }

  /**
   * テスト用：全データクリア
   */
  async clearAll(): Promise<void> {
    this.projects.clear();
    logger.debug('プロジェクトデータクリア完了');
  }

  /**
   * テスト用：データ件数取得
   */
  async count(): Promise<number> {
    return this.projects.size;
  }
}

/**
 * プロジェクトリポジトリのシングルトンインスタンス
 * テスト時にモック実装に差し替え可能
 */
export const projectRepository: ProjectRepository = new InMemoryProjectRepository();