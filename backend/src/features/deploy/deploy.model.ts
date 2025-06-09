/**
 * デプロイメント管理のデータモデル
 * GitHub Pages、Vercel、Netlifyなど複数のプロバイダーに対応
 */

import { logger } from '../../common/utils/logger';
import { 
  ID, 
  Timestamps, 
  DeployProvider, 
  DeploymentStatus 
} from '../../types/index';

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
 * 実際のプロバイダーAPIと連携してデプロイメント操作を行う
 */
export class DeploymentRepository {
  private static deployments = new Map<ID, Deployment>();
  private static deploymentCounter = 1;

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
  static createDeployment(request: CreateDeploymentRequest): Deployment {
    const startTime = Date.now();
    
    try {
      logger.info('デプロイメント作成開始', {
        component: 'DeploymentRepository',
        operation: 'createDeployment',
        projectId: request.projectId,
        provider: request.provider,
        userId: request.userId
      });

      const deploymentId = `deploy-${this.deploymentCounter++}-${Date.now()}`;
      const now = new Date().toISOString();
      
      const deployment: Deployment = {
        id: deploymentId,
        projectId: request.projectId,
        userId: request.userId,
        provider: request.provider,
        repositoryUrl: request.repositoryUrl,
        branch: request.branch,
        ...(request.customDomain && { customDomain: request.customDomain }),
        ...(request.environmentVariables && { environmentVariables: request.environmentVariables }),
        status: DeploymentStatus.PENDING,
        buildLogs: [],
        createdAt: now,
        updatedAt: now,
        lastCheckedAt: now
      };

      this.deployments.set(deploymentId, deployment);

      const duration = Date.now() - startTime;
      logger.info('デプロイメント作成完了', {
        component: 'DeploymentRepository',
        operation: 'createDeployment',
        deploymentId,
        projectId: request.projectId,
        provider: request.provider,
        duration: `${duration}ms`
      });

      return deployment;
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
  static getDeployment(deploymentId: ID): Deployment | null {
    const startTime = Date.now();
    
    try {
      logger.info('デプロイメント取得開始', {
        component: 'DeploymentRepository',
        operation: 'getDeployment',
        deploymentId
      });

      const deployment = this.deployments.get(deploymentId);
      
      const duration = Date.now() - startTime;
      logger.info('デプロイメント取得完了', {
        component: 'DeploymentRepository',
        operation: 'getDeployment',
        deploymentId,
        found: !!deployment,
        duration: `${duration}ms`
      });

      return deployment || null;
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
  static getProjectDeployments(projectId: ID, userId: ID): Deployment[] {
    const startTime = Date.now();
    
    try {
      logger.info('プロジェクトデプロイメント一覧取得開始', {
        component: 'DeploymentRepository',
        operation: 'getProjectDeployments',
        projectId,
        userId
      });

      const deployments = Array.from(this.deployments.values())
        .filter(deployment => 
          deployment.projectId === projectId && 
          deployment.userId === userId
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const duration = Date.now() - startTime;
      logger.info('プロジェクトデプロイメント一覧取得完了', {
        component: 'DeploymentRepository',
        operation: 'getProjectDeployments',
        projectId,
        userId,
        deploymentCount: deployments.length,
        duration: `${duration}ms`
      });

      return deployments;
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
  static updateDeploymentStatus(
    deploymentId: ID, 
    status: DeploymentStatus, 
    options?: {
      deploymentUrl?: string;
      errorMessage?: string;
      addLogs?: string[];
    }
  ): Deployment | null {
    const startTime = Date.now();
    
    try {
      logger.info('デプロイメントステータス更新開始', {
        component: 'DeploymentRepository',
        operation: 'updateDeploymentStatus',
        deploymentId,
        newStatus: status
      });

      const deployment = this.deployments.get(deploymentId);
      if (!deployment) {
        logger.warn('デプロイメント更新: 対象が見つかりません', {
          component: 'DeploymentRepository',
          deploymentId
        });
        return null;
      }

      const now = new Date().toISOString();
      deployment.status = status;
      deployment.updatedAt = now;
      deployment.lastCheckedAt = now;

      if (options?.deploymentUrl) {
        deployment.deploymentUrl = options.deploymentUrl;
      }

      if (options?.errorMessage) {
        deployment.errorMessage = options.errorMessage;
      }

      if (options?.addLogs && options.addLogs.length > 0) {
        deployment.buildLogs.push(...options.addLogs);
      }

      if (status === DeploymentStatus.READY) {
        deployment.deployedAt = now;
      }

      this.deployments.set(deploymentId, deployment);

      const duration = Date.now() - startTime;
      logger.info('デプロイメントステータス更新完了', {
        component: 'DeploymentRepository',
        operation: 'updateDeploymentStatus',
        deploymentId,
        newStatus: status,
        hasUrl: !!deployment.deploymentUrl,
        duration: `${duration}ms`
      });

      return deployment;
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
  static deleteDeployment(deploymentId: ID, userId: ID): boolean {
    const startTime = Date.now();
    
    try {
      logger.info('デプロイメント削除開始', {
        component: 'DeploymentRepository',
        operation: 'deleteDeployment',
        deploymentId,
        userId
      });

      const deployment = this.deployments.get(deploymentId);
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

      const deleted = this.deployments.delete(deploymentId);

      const duration = Date.now() - startTime;
      logger.info('デプロイメント削除完了', {
        component: 'DeploymentRepository',
        operation: 'deleteDeployment',
        deploymentId,
        userId,
        deleted,
        duration: `${duration}ms`
      });

      return deleted;
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
  static getTotalCount(): number {
    return this.deployments.size;
  }

  /**
   * ステータス別のデプロイメント数を取得（統計用）
   */
  static getCountByStatus(): Record<DeploymentStatus, number> {
    const counts = {
      [DeploymentStatus.PENDING]: 0,
      [DeploymentStatus.BUILDING]: 0,
      [DeploymentStatus.READY]: 0,
      [DeploymentStatus.ERROR]: 0
    };

    for (const deployment of this.deployments.values()) {
      counts[deployment.status]++;
    }

    return counts;
  }

  /**
   * プロバイダー別のデプロイメント数を取得（統計用）
   */
  static getCountByProvider(): Record<DeployProvider, number> {
    const counts = {
      [DeployProvider.GITHUB_PAGES]: 0,
      [DeployProvider.VERCEL]: 0,
      [DeployProvider.NETLIFY]: 0
    };

    for (const deployment of this.deployments.values()) {
      counts[deployment.provider]++;
    }

    return counts;
  }

  /**
   * テスト用: 全データクリア
   */
  static clearAll(): void {
    logger.info('全デプロイメントデータをクリア', {
      component: 'DeploymentRepository',
      operation: 'clearAll',
      previousCount: this.deployments.size
    });
    
    this.deployments.clear();
    this.deploymentCounter = 1;
  }
}