/**
 * デプロイメントのビジネスロジック層
 * 複数のデプロイプロバイダーとの連携を統一的に処理
 */

import { 
  DeploymentRepository, 
  CreateDeploymentRequest
} from './deploy.model';
import { 
  DeployProviderValidators, 
  DeploySecurityUtils 
} from './deploy.validator';
import { logger } from '../../common/utils/logger';
import { 
  ID, 
  DeployRequest, 
  DeployResponse, 
  DeploymentDetail,
  DeployProvider, 
  DeploymentStatus 
} from '../../types/index';

/**
 * デプロイメントサービス
 * 実際のデプロイプロバイダーとの連携をシミュレート
 */
export class DeploymentService {

  /**
   * デプロイメントを開始
   */
  static async triggerDeployment(
    userId: ID, 
    projectId: ID, 
    deployRequest: DeployRequest
  ): Promise<DeployResponse> {
    const startTime = Date.now();
    
    try {
      logger.info('デプロイメント開始', {
        component: 'DeploymentService',
        operation: 'triggerDeployment',
        userId,
        projectId,
        provider: deployRequest.provider,
        repo: deployRequest.repo
      });

      // プロバイダー固有のバリデーション
      await this.validateProviderConstraints(deployRequest);

      // リポジトリURLの構築
      const repositoryUrl = `https://github.com/${deployRequest.repo}`;
      
      // セキュリティチェック
      if (!DeploySecurityUtils.isSafeUrl(repositoryUrl)) {
        throw new Error('安全でないリポジトリURLです');
      }

      // デプロイメント作成
      const createRequest: CreateDeploymentRequest = {
        projectId,
        userId,
        provider: deployRequest.provider,
        repositoryUrl,
        branch: 'main'
      };
      
      if (deployRequest.customDomain) {
        createRequest.customDomain = deployRequest.customDomain;
      }

      const deployment = DeploymentRepository.createDeployment(createRequest);

      // デプロイメント記録は即座に完了、実際の処理は別途開始
      // この設計により、リポジトリには即座にデプロイメントが記録される
      
      // 初期ログを即座に追加
      DeploymentRepository.updateDeploymentStatus(
        deployment.id,
        DeploymentStatus.PENDING,
        {
          addLogs: ['デプロイメント準備中...']
        }
      );

      // 非同期でデプロイ処理を開始（実際のデプロイプロバイダーAPIを呼び出す想定）
      this.executeDeployment(deployment.id, deployRequest)
        .catch(error => {
          logger.error('デプロイメント実行エラー', {
            component: 'DeploymentService',
            deploymentId: deployment.id,
            error: error.message
          });
          
          // エラー状態に更新
          DeploymentRepository.updateDeploymentStatus(
            deployment.id, 
            DeploymentStatus.ERROR,
            {
              errorMessage: error.message,
              addLogs: [`エラー: ${error.message}`]
            }
          );
        });

      const response: DeployResponse = {
        deploymentId: deployment.id,
        status: DeploymentStatus.PENDING
      };

      const duration = Date.now() - startTime;
      logger.info('デプロイメント開始完了', {
        component: 'DeploymentService',
        operation: 'triggerDeployment',
        userId,
        projectId,
        deploymentId: deployment.id,
        provider: deployRequest.provider,
        duration: `${duration}ms`
      });

      return response;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('デプロイメント開始エラー', {
        component: 'DeploymentService',
        operation: 'triggerDeployment',
        userId,
        projectId,
        provider: deployRequest.provider,
        error: error.message,
        duration: `${duration}ms`
      });
      
      throw new Error(`デプロイメントの開始に失敗しました: ${error.message}`);
    }
  }

  /**
   * デプロイメントステータスを取得
   */
  static getDeploymentStatus(deploymentId: ID, userId: ID): DeploymentDetail | null {
    const startTime = Date.now();
    
    try {
      logger.info('デプロイメントステータス取得開始', {
        component: 'DeploymentService',
        operation: 'getDeploymentStatus',
        deploymentId,
        userId
      });

      const deployment = DeploymentRepository.getDeployment(deploymentId);
      
      if (!deployment) {
        logger.warn('デプロイメントが見つかりません', {
          component: 'DeploymentService',
          deploymentId,
          userId
        });
        return null;
      }

      // アクセス権限チェック
      if (deployment.userId !== userId) {
        logger.warn('デプロイメントアクセス権限エラー', {
          component: 'DeploymentService',
          deploymentId,
          userId,
          ownerId: deployment.userId
        });
        return null;
      }

      // ログの機密情報を除去
      const sanitizedLogs = DeploySecurityUtils.sanitizeLogs(deployment.buildLogs);

      const detail: DeploymentDetail = {
        id: deployment.id,
        projectId: deployment.projectId,
        provider: deployment.provider,
        status: deployment.status,
        logs: sanitizedLogs
      };
      
      if (deployment.deploymentUrl) {
        detail.url = deployment.deploymentUrl;
      }
      if (deployment.customDomain) {
        detail.customDomain = deployment.customDomain;
      }
      if (deployment.deployedAt) {
        detail.deployedAt = deployment.deployedAt;
      }

      const duration = Date.now() - startTime;
      logger.info('デプロイメントステータス取得完了', {
        component: 'DeploymentService',
        operation: 'getDeploymentStatus',
        deploymentId,
        userId,
        status: deployment.status,
        duration: `${duration}ms`
      });

      return detail;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('デプロイメントステータス取得エラー', {
        component: 'DeploymentService',
        operation: 'getDeploymentStatus',
        deploymentId,
        userId,
        error: error.message,
        duration: `${duration}ms`
      });
      
      throw new Error(`デプロイメントステータスの取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * プロジェクトのデプロイメント一覧を取得
   */
  static getProjectDeployments(
    projectId: ID, 
    userId: ID,
    page: number = 1,
    limit: number = 10
  ): { deployments: DeploymentDetail[]; total: number; hasMore: boolean } {
    const startTime = Date.now();
    
    try {
      logger.info('プロジェクトデプロイメント一覧取得開始', {
        component: 'DeploymentService',
        operation: 'getProjectDeployments',
        projectId,
        userId,
        page,
        limit
      });

      const allDeployments = DeploymentRepository.getProjectDeployments(projectId, userId);
      
      // ページネーション処理
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedDeployments = allDeployments.slice(startIndex, endIndex);

      // DeploymentDetail形式に変換
      const deploymentDetails: DeploymentDetail[] = paginatedDeployments.map(deployment => ({
        id: deployment.id,
        projectId: deployment.projectId,
        provider: deployment.provider,
        status: deployment.status,
        logs: DeploySecurityUtils.sanitizeLogs(deployment.buildLogs),
        ...(deployment.deploymentUrl && { url: deployment.deploymentUrl }),
        ...(deployment.customDomain && { customDomain: deployment.customDomain }),
        ...(deployment.deployedAt && { deployedAt: deployment.deployedAt })
      }));

      const result = {
        deployments: deploymentDetails,
        total: allDeployments.length,
        hasMore: endIndex < allDeployments.length
      };

      const duration = Date.now() - startTime;
      logger.info('プロジェクトデプロイメント一覧取得完了', {
        component: 'DeploymentService',
        operation: 'getProjectDeployments',
        projectId,
        userId,
        totalCount: result.total,
        returnedCount: deploymentDetails.length,
        duration: `${duration}ms`
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('プロジェクトデプロイメント一覧取得エラー', {
        component: 'DeploymentService',
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
   * デプロイメントのログを取得
   */
  static getDeploymentLogs(deploymentId: ID, userId: ID): string[] {
    const startTime = Date.now();
    
    try {
      logger.info('デプロイメントログ取得開始', {
        component: 'DeploymentService',
        operation: 'getDeploymentLogs',
        deploymentId,
        userId
      });

      const deployment = DeploymentRepository.getDeployment(deploymentId);
      
      if (!deployment || deployment.userId !== userId) {
        logger.warn('デプロイメントログアクセス権限エラー', {
          component: 'DeploymentService',
          deploymentId,
          userId,
          found: !!deployment,
          authorized: deployment?.userId === userId
        });
        throw new Error('デプロイメントが見つからないか、アクセス権限がありません');
      }

      const sanitizedLogs = DeploySecurityUtils.sanitizeLogs(deployment.buildLogs);

      const duration = Date.now() - startTime;
      logger.info('デプロイメントログ取得完了', {
        component: 'DeploymentService',
        operation: 'getDeploymentLogs',
        deploymentId,
        userId,
        logCount: sanitizedLogs.length,
        duration: `${duration}ms`
      });

      return sanitizedLogs;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('デプロイメントログ取得エラー', {
        component: 'DeploymentService',
        operation: 'getDeploymentLogs',
        deploymentId,
        userId,
        error: error.message,
        duration: `${duration}ms`
      });
      
      throw error;
    }
  }

  /**
   * プロバイダー固有の制約をバリデーション
   */
  private static async validateProviderConstraints(deployRequest: DeployRequest): Promise<void> {
    try {
      switch (deployRequest.provider) {
        case DeployProvider.GITHUB_PAGES:
          DeployProviderValidators.validateGitHubPages(deployRequest.repo);
          break;
        case DeployProvider.VERCEL:
          DeployProviderValidators.validateVercel(deployRequest.customDomain);
          break;
        case DeployProvider.NETLIFY:
          DeployProviderValidators.validateNetlify(deployRequest.customDomain);
          break;
        default:
          throw new Error(`サポートされていないプロバイダーです: ${deployRequest.provider}`);
      }
    } catch (error: any) {
      logger.error('プロバイダー制約バリデーションエラー', {
        component: 'DeploymentService',
        provider: deployRequest.provider,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 実際のデプロイメント処理（非同期）
   * 実際の実装では各プロバイダーのAPIを呼び出す
   */
  private static async executeDeployment(deploymentId: ID, deployRequest: DeployRequest): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('デプロイメント実行開始', {
        component: 'DeploymentService',
        operation: 'executeDeployment',
        deploymentId,
        provider: deployRequest.provider
      });

      // デプロイメントが存在するかチェック（削除済みの場合は処理を停止）
      const existingDeployment = DeploymentRepository.getDeployment(deploymentId);
      if (!existingDeployment) {
        logger.info('デプロイメント処理中止 - デプロイメントが見つかりません', {
          component: 'DeploymentService',
          operation: 'executeDeployment',
          deploymentId
        });
        return;
      }

      // ビルド開始状態に更新
      const updated = DeploymentRepository.updateDeploymentStatus(
        deploymentId, 
        DeploymentStatus.BUILDING,
        {
          addLogs: ['デプロイメントを開始しています...']
        }
      );

      // 更新に失敗した場合は処理を停止（削除済みの可能性）
      if (!updated) {
        logger.info('デプロイメント処理中止 - ステータス更新に失敗', {
          component: 'DeploymentService',
          operation: 'executeDeployment',
          deploymentId
        });
        return;
      }

      // プロバイダー別の処理をシミュレート
      await this.simulateProviderDeployment(deploymentId, deployRequest);

      const duration = Date.now() - startTime;
      logger.info('デプロイメント実行完了', {
        component: 'DeploymentService',
        operation: 'executeDeployment',
        deploymentId,
        provider: deployRequest.provider,
        duration: `${duration}ms`
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('デプロイメント実行エラー', {
        component: 'DeploymentService',
        operation: 'executeDeployment',
        deploymentId,
        provider: deployRequest.provider,
        error: error.message,
        duration: `${duration}ms`
      });
      throw error;
    }
  }

  /**
   * プロバイダー別のデプロイメント処理をシミュレート
   */
  private static async simulateProviderDeployment(deploymentId: ID, deployRequest: DeployRequest): Promise<void> {
    
    // プロバイダー別の処理時間をシミュレート
    const processingTime = this.getProviderProcessingTime(deployRequest.provider);
    
    await new Promise(resolve => setTimeout(resolve, processingTime));

    // 処理完了後、デプロイメントがまだ存在するかチェック
    const stillExists = DeploymentRepository.getDeployment(deploymentId);
    if (!stillExists) {
      logger.info('デプロイメント処理中止 - 処理完了時にデプロイメントが見つかりません', {
        component: 'DeploymentService',
        operation: 'simulateProviderDeployment',
        deploymentId
      });
      return;
    }

    // ビルドログをシミュレート
    const buildLogs = this.generateBuildLogs(deployRequest.provider, deployRequest.repo);
    
    // 成功の確率（本番環境でも同じ）
    const successRate = 0.9; // 90%の成功率
    const isSuccess = Math.random() < successRate;

    if (isSuccess) {
      // 成功時の処理
      const deploymentUrl = this.generateDeploymentUrl(deployRequest.provider, deployRequest.repo, deployRequest.customDomain);
      
      // 最終更新前にも存在確認
      if (DeploymentRepository.getDeployment(deploymentId)) {
        DeploymentRepository.updateDeploymentStatus(
          deploymentId, 
          DeploymentStatus.READY,
          {
            deploymentUrl,
            addLogs: [...buildLogs, `✅ デプロイメント完了: ${deploymentUrl}`]
          }
        );
      }
    } else {
      // 失敗時の処理
      const errorMessage = 'ビルドエラーが発生しました';
      
      // 最終更新前にも存在確認
      if (DeploymentRepository.getDeployment(deploymentId)) {
        DeploymentRepository.updateDeploymentStatus(
          deploymentId, 
          DeploymentStatus.ERROR,
          {
            errorMessage,
            addLogs: [...buildLogs, `❌ ${errorMessage}`]
          }
        );
      }
    }
  }

  /**
   * プロバイダー別の処理時間を取得（シミュレーション用）
   */
  private static getProviderProcessingTime(provider: DeployProvider): number {
    const times = {
      [DeployProvider.GITHUB_PAGES]: 3000, // 3秒
      [DeployProvider.VERCEL]: 2000,       // 2秒
      [DeployProvider.NETLIFY]: 2500       // 2.5秒
    };
    
    return times[provider] || 3000;
  }

  /**
   * ビルドログを生成（シミュレーション用）
   */
  private static generateBuildLogs(provider: DeployProvider, repo: string): string[] {
    const baseTime = new Date().toISOString();
    
    return [
      `[${baseTime}] リポジトリをクローンしています: ${repo}`,
      `[${baseTime}] 依存関係をインストールしています...`,
      `[${baseTime}] ビルドを実行しています...`,
      `[${baseTime}] 静的ファイルを生成しています...`,
      `[${baseTime}] ${provider} にデプロイしています...`
    ];
  }

  /**
   * デプロイメントURLを生成（シミュレーション用）
   */
  private static generateDeploymentUrl(provider: DeployProvider, repo: string, customDomain?: string): string {
    if (customDomain) {
      return `https://${customDomain}`;
    }

    const repoName = repo.split('/')[1];
    const randomId = Math.random().toString(36).substring(7);

    switch (provider) {
      case DeployProvider.GITHUB_PAGES:
        return `https://${repo.split('/')[0]}.github.io/${repoName}`;
      case DeployProvider.VERCEL:
        return `https://${repoName}-${randomId}.vercel.app`;
      case DeployProvider.NETLIFY:
        return `https://${repoName}-${randomId}.netlify.app`;
      default:
        return `https://${repoName}-${randomId}.example.com`;
    }
  }

  /**
   * 統計情報を取得
   */
  static getDeploymentStats(): {
    total: number;
    byStatus: Record<DeploymentStatus, number>;
    byProvider: Record<DeployProvider, number>;
  } {
    const statusCounts = DeploymentRepository.getCountByStatus();
    const providerCounts = DeploymentRepository.getCountByProvider();

    return {
      total: DeploymentRepository.getTotalCount(),
      byStatus: statusCounts,
      byProvider: providerCounts
    };
  }
}