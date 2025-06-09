/**
 * デプロイメント管理のデータモデル
 * GitHub Pages、Vercel、Netlifyなど複数のプロバイダーに対応
 * PostgreSQL + Sequelize による永続化対応
 */

import { logger } from '../../common/utils/logger';
import { 
  ID, 
  Timestamps, 
  DeployProvider, 
  DeploymentStatus 
} from '../../types/index';
import { DeploymentModel } from '../../models/Deployment';
import { sequelize } from '../../config/database';

/**
 * デプロイメント基本情報
 */
export interface DeploymentBase {
  id: ID;
  projectId: ID;
  userId: ID;
  provider: DeployProvider;
  repositoryUrl: string;
  branch: string;
  customDomain?: string;
  environmentVariables?: Record<string, string>;
}

/**
 * デプロイメント詳細情報
 */
export interface Deployment extends DeploymentBase, Timestamps {
  status: DeploymentStatus;
  deploymentUrl?: string;
  buildLogs: string[];
  errorMessage?: string;
  deployedAt?: string;
  lastCheckedAt: string;
}

/**
 * デプロイメント作成リクエスト
 */
export interface CreateDeploymentRequest {
  projectId: ID;
  userId: ID;
  provider: DeployProvider;
  repositoryUrl: string;
  branch: string;
  customDomain?: string;
  environmentVariables?: Record<string, string>;
}

/**
 * デプロイプロバイダーの設定
 */
export interface ProviderConfig {
  name: string;
  apiBaseUrl: string;
  authTokenRequired: boolean;
  supportedFeatures: {
    customDomains: boolean;
    environmentVariables: boolean;
    buildLogs: boolean;
    rollback: boolean;
  };
}

/**
 * デプロイメントリポジトリ層
 * PostgreSQL + Sequelize による永続化
 * 実際のプロバイダーAPIと連携してデプロイメント操作を行う
 */
export class DeploymentRepository {

  /**
   * プロバイダー設定の取得
   */
  static getProviderConfig(provider: DeployProvider): ProviderConfig {
    const configs: Record<DeployProvider, ProviderConfig> = {
      [DeployProvider.GITHUB_PAGES]: {
        name: 'GitHub Pages',
        apiBaseUrl: 'https://api.github.com',
        authTokenRequired: true,
        supportedFeatures: {
          customDomains: true,
          environmentVariables: false,
          buildLogs: true,
          rollback: false
        }
      },
      [DeployProvider.VERCEL]: {
        name: 'Vercel',
        apiBaseUrl: 'https://api.vercel.com',
        authTokenRequired: true,
        supportedFeatures: {
          customDomains: true,
          environmentVariables: true,
          buildLogs: true,
          rollback: true
        }
      },
      [DeployProvider.NETLIFY]: {
        name: 'Netlify',
        apiBaseUrl: 'https://api.netlify.com',
        authTokenRequired: true,
        supportedFeatures: {
          customDomains: true,
          environmentVariables: true,
          buildLogs: true,
          rollback: true
        }
      }
    };

    return configs[provider];
  }

  /**
   * 新しいデプロイメントを作成
   */
  static async createDeployment(request: CreateDeploymentRequest): Promise<Deployment> {
    const startTime = Date.now();
    
    try {
      logger.info('デプロイメント作成開始', {
        component: 'DeploymentRepository',
        operation: 'createDeployment',
        projectId: request.projectId,
        provider: request.provider,
        userId: request.userId
      });

      const deploymentData: any = {
        projectId: request.projectId,
        userId: request.userId,
        provider: request.provider,
        repositoryUrl: request.repositoryUrl,
        branch: request.branch,
        ...(request.customDomain && { customDomain: request.customDomain }),
        ...(request.environmentVariables && { environmentVariables: request.environmentVariables }),
        status: DeploymentStatus.PENDING,
        buildLogs: []
      };

      const deployment = await DeploymentModel.create(deploymentData);
      const result = this.mapToDeployment(deployment);

      const duration = Date.now() - startTime;
      logger.info('デプロイメント作成完了', {
        component: 'DeploymentRepository',
        operation: 'createDeployment',
        deploymentId: result.id,
        projectId: request.projectId,
        provider: request.provider,
        duration: `${duration}ms`
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('デプロイメント作成エラー', {
        component: 'DeploymentRepository',
        operation: 'createDeployment',
        projectId: request.projectId,
        provider: request.provider,
        error: error.message,
        duration: `${duration}ms`
      });
      
      throw new Error(`デプロイメントの作成に失敗しました: ${error.message}`);
    }
  }

  /**
   * デプロイメントを取得
   */
  static async getDeployment(deploymentId: ID): Promise<Deployment | null> {
    const startTime = Date.now();
    
    try {
      logger.info('デプロイメント取得開始', {
        component: 'DeploymentRepository',
        operation: 'getDeployment',
        deploymentId
      });

      const deployment = await DeploymentModel.findByPk(deploymentId);
      const result = deployment ? this.mapToDeployment(deployment) : null;
      
      const duration = Date.now() - startTime;
      logger.info('デプロイメント取得完了', {
        component: 'DeploymentRepository',
        operation: 'getDeployment',
        deploymentId,
        found: !!result,
        duration: `${duration}ms`
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('デプロイメント取得エラー', {
        component: 'DeploymentRepository',
        operation: 'getDeployment',
        deploymentId,
        error: error.message,
        duration: `${duration}ms`
      });
      
      throw new Error(`デプロイメントの取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * プロジェクトのデプロイメント一覧を取得
   */
  static async getProjectDeployments(projectId: ID, userId: ID): Promise<Deployment[]> {
    const startTime = Date.now();
    
    try {
      logger.info('プロジェクトデプロイメント一覧取得開始', {
        component: 'DeploymentRepository',
        operation: 'getProjectDeployments',
        projectId,
        userId
      });

      const deployments = await DeploymentModel.findAll({
        where: {
          projectId,
          userId
        },
        order: [['createdAt', 'DESC']]
      });

      const results = deployments.map(deployment => this.mapToDeployment(deployment));

      const duration = Date.now() - startTime;
      logger.info('プロジェクトデプロイメント一覧取得完了', {
        component: 'DeploymentRepository',
        operation: 'getProjectDeployments',
        projectId,
        userId,
        deploymentCount: results.length,
        duration: `${duration}ms`
      });

      return results;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('プロジェクトデプロイメント一覧取得エラー', {
        component: 'DeploymentRepository',
        operation: 'getProjectDeployments',
        projectId,
        userId,
        error: error.message,
        duration: `${duration}ms`
      });
      
      throw new Error(`プロジェクトのデプロイメント一覧取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * デプロイメントステータスを更新
   */
  static async updateDeploymentStatus(
    deploymentId: ID, 
    status: DeploymentStatus, 
    options?: {
      deploymentUrl?: string;
      errorMessage?: string;
      addLogs?: string[];
    }
  ): Promise<Deployment | null> {
    const startTime = Date.now();
    
    try {
      logger.info('デプロイメントステータス更新開始', {
        component: 'DeploymentRepository',
        operation: 'updateDeploymentStatus',
        deploymentId,
        newStatus: status
      });

      const deployment = await DeploymentModel.findByPk(deploymentId);
      if (!deployment) {
        logger.warn('デプロイメント更新: 対象が見つかりません', {
          component: 'DeploymentRepository',
          deploymentId
        });
        return null;
      }

      const updateData: any = {
        status,
        lastCheckedAt: new Date()
      };

      if (options?.deploymentUrl) {
        updateData.deploymentUrl = options.deploymentUrl;
      }

      if (options?.errorMessage) {
        updateData.errorMessage = options.errorMessage;
      }

      if (options?.addLogs && options.addLogs.length > 0) {
        updateData.buildLogs = [...deployment.buildLogs, ...options.addLogs];
      }

      if (status === DeploymentStatus.READY) {
        updateData.deployedAt = new Date();
      }

      await deployment.update(updateData);
      const result = this.mapToDeployment(deployment);

      const duration = Date.now() - startTime;
      logger.info('デプロイメントステータス更新完了', {
        component: 'DeploymentRepository',
        operation: 'updateDeploymentStatus',
        deploymentId,
        newStatus: status,
        hasUrl: !!result.deploymentUrl,
        duration: `${duration}ms`
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('デプロイメントステータス更新エラー', {
        component: 'DeploymentRepository',
        operation: 'updateDeploymentStatus',
        deploymentId,
        newStatus: status,
        error: error.message,
        duration: `${duration}ms`
      });
      
      throw new Error(`デプロイメントステータスの更新に失敗しました: ${error.message}`);
    }
  }

  /**
   * デプロイメントを削除
   */
  static async deleteDeployment(deploymentId: ID, userId: ID): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      logger.info('デプロイメント削除開始', {
        component: 'DeploymentRepository',
        operation: 'deleteDeployment',
        deploymentId,
        userId
      });

      const deployment = await DeploymentModel.findByPk(deploymentId);
      if (!deployment || deployment.userId !== userId) {
        logger.warn('デプロイメント削除: 対象が見つからないか権限がありません', {
          component: 'DeploymentRepository',
          deploymentId,
          userId,
          found: !!deployment,
          authorized: deployment?.userId === userId
        });
        return false;
      }

      await deployment.destroy();

      const duration = Date.now() - startTime;
      logger.info('デプロイメント削除完了', {
        component: 'DeploymentRepository',
        operation: 'deleteDeployment',
        deploymentId,
        userId,
        deleted: true,
        duration: `${duration}ms`
      });

      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('デプロイメント削除エラー', {
        component: 'DeploymentRepository',
        operation: 'deleteDeployment',
        deploymentId,
        userId,
        error: error.message,
        duration: `${duration}ms`
      });
      
      throw new Error(`デプロイメントの削除に失敗しました: ${error.message}`);
    }
  }

  /**
   * 全デプロイメント数を取得（統計用）
   */
  static async getTotalCount(): Promise<number> {
    return await DeploymentModel.count();
  }

  /**
   * ステータス別のデプロイメント数を取得（統計用）
   */
  static async getCountByStatus(): Promise<Record<DeploymentStatus, number>> {
    const counts = {
      [DeploymentStatus.PENDING]: 0,
      [DeploymentStatus.BUILDING]: 0,
      [DeploymentStatus.READY]: 0,
      [DeploymentStatus.ERROR]: 0
    };

    const results = await DeploymentModel.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('status')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    for (const result of results) {
      const status = (result as any).status as DeploymentStatus;
      counts[status] = parseInt((result as any).count) || 0;
    }

    return counts;
  }

  /**
   * プロバイダー別のデプロイメント数を取得（統計用）
   */
  static async getCountByProvider(): Promise<Record<DeployProvider, number>> {
    const counts = {
      [DeployProvider.GITHUB_PAGES]: 0,
      [DeployProvider.VERCEL]: 0,
      [DeployProvider.NETLIFY]: 0
    };

    const results = await DeploymentModel.findAll({
      attributes: [
        'provider',
        [sequelize.fn('COUNT', sequelize.col('provider')), 'count']
      ],
      group: ['provider'],
      raw: true
    });

    for (const result of results) {
      const provider = (result as any).provider as DeployProvider;
      counts[provider] = parseInt((result as any).count) || 0;
    }

    return counts;
  }

  /**
   * Sequelizeモデルからアプリケーション形式への変換
   */
  private static mapToDeployment(model: any): Deployment {
    return {
      id: model.id,
      projectId: model.projectId,
      userId: model.userId,
      provider: model.provider,
      repositoryUrl: model.repositoryUrl,
      branch: model.branch,
      customDomain: model.customDomain,
      environmentVariables: model.environmentVariables,
      status: model.status,
      deploymentUrl: model.deploymentUrl,
      buildLogs: model.buildLogs || [],
      errorMessage: model.errorMessage,
      deployedAt: model.deployedAt?.toISOString(),
      lastCheckedAt: model.lastCheckedAt?.toISOString() || new Date().toISOString(),
      createdAt: model.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: model.updatedAt?.toISOString() || new Date().toISOString()
    };
  }

  /**
   * テスト用: 全データクリア
   */
  static async clearAll(): Promise<void> {
    const previousCount = await DeploymentModel.count();
    
    logger.info('全デプロイメントデータをクリア', {
      component: 'DeploymentRepository',
      operation: 'clearAll',
      previousCount
    });
    
    await DeploymentModel.destroy({ where: {} });
  }
}