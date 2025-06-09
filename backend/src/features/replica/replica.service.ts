/**
 * レプリカ管理 - サービス層
 * 
 * レプリカの取得、作成、更新、アセット管理のビジネスロジックを実装
 * プロジェクトサービスと連携してレプリカデータを管理
 */

import { 
  Replica, 
  ReplicaAsset,
  ID,
  ProjectStatus
} from '../../types';
import { replicaRepository } from './replica.model';
import { projectRepository } from '../projects/projects.model';
import { logger } from '../../common/utils/logger';

/**
 * サービス層エラー
 */
export class ReplicaServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ReplicaServiceError';
  }
}

/**
 * レプリカ未発見エラー
 */
export class ReplicaNotFoundError extends ReplicaServiceError {
  constructor(message: string = 'レプリカが見つかりません') {
    super(message, 'REPLICA_NOT_FOUND', 404);
  }
}

/**
 * プロジェクト未発見エラー
 */
export class ProjectNotFoundError extends ReplicaServiceError {
  constructor(message: string = 'プロジェクトが見つかりません') {
    super(message, 'PROJECT_NOT_FOUND', 404);
  }
}

/**
 * アクセス権限エラー
 */
export class AccessDeniedError extends ReplicaServiceError {
  constructor(message: string = 'このリソースへのアクセス権限がありません') {
    super(message, 'ACCESS_DENIED', 403);
  }
}

/**
 * レプリカサービスクラス
 */
export class ReplicaService {
  /**
   * プロジェクトIDからレプリカを取得
   */
  async getReplicaByProjectId(projectId: ID, userId: ID): Promise<Replica> {
    try {
      logger.info('レプリカ取得処理開始', {
        projectId,
        userId
      });

      // プロジェクト存在確認とアクセス権限チェック
      const project = await projectRepository.findById(projectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      // アクセス権限確認
      if (!(await projectRepository.isOwner(projectId, userId))) {
        throw new AccessDeniedError();
      }

      // レプリカ取得
      const replica = await replicaRepository.findByProjectId(projectId);
      if (!replica) {
        // レプリカがまだ作成されていない場合
        if (project.status === ProjectStatus.CREATING) {
          throw new ReplicaServiceError(
            'レプリカはまだ作成中です',
            'REPLICA_CREATING',
            202
          );
        }
        throw new ReplicaNotFoundError();
      }

      logger.info('レプリカ取得成功', {
        projectId,
        replicaId: replica.id,
        assetsCount: replica.assets.length
      });

      return replica;

    } catch (error) {
      if (error instanceof ReplicaServiceError) {
        throw error;
      }

      logger.error('レプリカ取得でエラーが発生', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        userId
      });

      throw new ReplicaServiceError(
        'レプリカの取得に失敗しました',
        'FETCH_FAILED'
      );
    }
  }

  /**
   * プロジェクトのアセット一覧を取得
   */
  async getAssetsByProjectId(projectId: ID, userId: ID): Promise<ReplicaAsset[]> {
    try {
      logger.info('アセット一覧取得処理開始', {
        projectId,
        userId
      });

      // プロジェクト存在確認とアクセス権限チェック
      const project = await projectRepository.findById(projectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      // アクセス権限確認
      if (!(await projectRepository.isOwner(projectId, userId))) {
        throw new AccessDeniedError();
      }

      // レプリカ存在確認
      const replica = await replicaRepository.findByProjectId(projectId);
      if (!replica) {
        if (project.status === ProjectStatus.CREATING) {
          // まだ作成中の場合は空配列を返す
          return [];
        }
        throw new ReplicaNotFoundError();
      }

      // アセット一覧取得
      const assets = await replicaRepository.findAssetsByReplicaId(replica.id);

      logger.info('アセット一覧取得成功', {
        projectId,
        replicaId: replica.id,
        assetsCount: assets.length
      });

      return assets;

    } catch (error) {
      if (error instanceof ReplicaServiceError) {
        throw error;
      }

      logger.error('アセット一覧取得でエラーが発生', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        userId
      });

      throw new ReplicaServiceError(
        'アセット一覧の取得に失敗しました',
        'FETCH_FAILED'
      );
    }
  }

  /**
   * レプリカを作成（プロジェクト作成時に内部的に使用）
   * 通常はプロジェクトサービスから呼び出される
   */
  async createReplica(projectId: ID, html: string, css: string = ''): Promise<Replica> {
    try {
      logger.info('レプリカ作成処理開始', {
        projectId,
        htmlLength: html.length,
        cssLength: css.length
      });

      // プロジェクト存在確認
      const project = await projectRepository.findById(projectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      // 既存レプリカチェック
      const existingReplica = await replicaRepository.findByProjectId(projectId);
      if (existingReplica) {
        throw new ReplicaServiceError(
          'このプロジェクトには既にレプリカが存在します',
          'REPLICA_EXISTS',
          409
        );
      }

      // レプリカ作成
      const replica = await replicaRepository.create(projectId, html, css);

      // プロジェクトステータスを更新
      await projectRepository.updateStatus(projectId, ProjectStatus.READY);

      logger.info('レプリカ作成成功', {
        projectId,
        replicaId: replica.id
      });

      return replica;

    } catch (error) {
      if (error instanceof ReplicaServiceError) {
        throw error;
      }

      logger.error('レプリカ作成でエラーが発生', {
        error: error instanceof Error ? error.message : String(error),
        projectId
      });

      // プロジェクトステータスをエラーに更新
      await projectRepository.updateStatus(projectId, ProjectStatus.ERROR);

      throw new ReplicaServiceError(
        'レプリカの作成に失敗しました',
        'CREATE_FAILED'
      );
    }
  }

  /**
   * レプリカにアセットを追加
   */
  async addAssetToReplica(
    projectId: ID, 
    assetData: Omit<ReplicaAsset, 'id' | 'replicaId'>
  ): Promise<ReplicaAsset> {
    try {
      logger.info('アセット追加処理開始', {
        projectId,
        originalUrl: assetData.originalUrl,
        mimeType: assetData.mimeType,
        size: assetData.size
      });

      // レプリカ取得
      const replica = await replicaRepository.findByProjectId(projectId);
      if (!replica) {
        throw new ReplicaNotFoundError();
      }

      // アセット追加
      const asset = await replicaRepository.addAsset(replica.id, assetData);

      logger.info('アセット追加成功', {
        projectId,
        replicaId: replica.id,
        assetId: asset.id
      });

      return asset;

    } catch (error) {
      if (error instanceof ReplicaServiceError) {
        throw error;
      }

      logger.error('アセット追加でエラーが発生', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        assetData
      });

      throw new ReplicaServiceError(
        'アセットの追加に失敗しました',
        'ADD_ASSET_FAILED'
      );
    }
  }

  /**
   * レプリカを更新（エディター機能で使用）
   */
  async updateReplica(
    projectId: ID, 
    userId: ID,
    updates: Partial<Pick<Replica, 'html' | 'css'>>
  ): Promise<Replica> {
    try {
      logger.info('レプリカ更新処理開始', {
        projectId,
        userId,
        updateFields: Object.keys(updates)
      });

      // プロジェクト存在確認とアクセス権限チェック
      const project = await projectRepository.findById(projectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      // アクセス権限確認
      if (!(await projectRepository.isOwner(projectId, userId))) {
        throw new AccessDeniedError();
      }

      // レプリカ取得
      const replica = await replicaRepository.findByProjectId(projectId);
      if (!replica) {
        throw new ReplicaNotFoundError();
      }

      // レプリカ更新
      const updatedReplica = await replicaRepository.update(replica.id, updates);
      if (!updatedReplica) {
        throw new ReplicaServiceError(
          'レプリカの更新に失敗しました',
          'UPDATE_FAILED'
        );
      }

      logger.info('レプリカ更新成功', {
        projectId,
        replicaId: replica.id,
        updateFields: Object.keys(updates)
      });

      return updatedReplica;

    } catch (error) {
      if (error instanceof ReplicaServiceError) {
        throw error;
      }

      logger.error('レプリカ更新でエラーが発生', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        userId
      });

      throw new ReplicaServiceError(
        'レプリカの更新に失敗しました',
        'UPDATE_FAILED'
      );
    }
  }

  /**
   * レプリカを削除（プロジェクト削除時に内部的に使用）
   */
  async deleteReplicaByProjectId(projectId: ID): Promise<boolean> {
    try {
      logger.info('レプリカ削除処理開始', { projectId });

      const success = await replicaRepository.deleteByProjectId(projectId);

      if (success) {
        logger.info('レプリカ削除成功', { projectId });
      } else {
        logger.warn('削除対象のレプリカが見つかりません', { projectId });
      }

      return success;

    } catch (error) {
      logger.error('レプリカ削除でエラーが発生', {
        error: error instanceof Error ? error.message : String(error),
        projectId
      });

      throw new ReplicaServiceError(
        'レプリカの削除に失敗しました',
        'DELETE_FAILED'
      );
    }
  }
}

/**
 * レプリカサービスのシングルトンインスタンス
 */
export const replicaService = new ReplicaService();