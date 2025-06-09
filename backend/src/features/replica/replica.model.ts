import { ID, Replica, ReplicaAsset } from '../../types';
import { logger } from '../../common/utils/logger';

/**
 * レプリカデータのインメモリストレージ
 * 本番環境ではデータベースに置き換える
 */
class ReplicaRepository {
  private replicas: Map<ID, Replica> = new Map();
  private assets: Map<ID, ReplicaAsset[]> = new Map();
  private replicaIdCounter = 0;
  private assetIdCounter = 0;

  /**
   * プロジェクトIDからレプリカを取得
   */
  async findByProjectId(projectId: ID): Promise<Replica | null> {
    logger.info(`レプリカ取得開始: projectId=${projectId}`);
    
    for (const replica of this.replicas.values()) {
      if (replica.projectId === projectId) {
        logger.info(`レプリカ取得成功: replicaId=${replica.id}`);
        return replica;
      }
    }
    
    logger.warn(`レプリカが見つかりません: projectId=${projectId}`);
    return null;
  }

  /**
   * レプリカIDでレプリカを取得
   */
  async findById(replicaId: ID): Promise<Replica | null> {
    const replica = this.replicas.get(replicaId);
    if (replica) {
      logger.info(`レプリカ取得成功: replicaId=${replicaId}`);
    } else {
      logger.warn(`レプリカが見つかりません: replicaId=${replicaId}`);
    }
    return replica || null;
  }

  /**
   * レプリカを作成
   */
  async create(projectId: ID, html: string, css: string): Promise<Replica> {
    logger.info(`レプリカ作成開始: projectId=${projectId}`);
    
    const now = new Date().toISOString();
    const replica: Replica = {
      id: `replica_${++this.replicaIdCounter}`,
      projectId,
      html,
      css,
      assets: [],
      createdAt: now,
      updatedAt: now
    };

    this.replicas.set(replica.id, replica);
    logger.info(`レプリカ作成成功: replicaId=${replica.id}`);
    
    return replica;
  }

  /**
   * レプリカを更新
   */
  async update(replicaId: ID, updates: Partial<Pick<Replica, 'html' | 'css'>>): Promise<Replica | null> {
    logger.info(`レプリカ更新開始: replicaId=${replicaId}`);
    
    const replica = this.replicas.get(replicaId);
    if (!replica) {
      logger.error(`更新対象のレプリカが見つかりません: replicaId=${replicaId}`);
      return null;
    }

    const updatedReplica: Replica = {
      ...replica,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.replicas.set(replicaId, updatedReplica);
    logger.info(`レプリカ更新成功: replicaId=${replicaId}`);
    
    return updatedReplica;
  }

  /**
   * プロジェクトIDを指定してHTMLを更新
   */
  async updateHtml(projectId: ID, html: string): Promise<Replica | null> {
    logger.info(`レプリカHTML更新開始: projectId=${projectId}`);
    
    const replica = await this.findByProjectId(projectId);
    if (!replica) {
      logger.error(`更新対象のレプリカが見つかりません: projectId=${projectId}`);
      return null;
    }

    return this.update(replica.id, { html });
  }

  /**
   * レプリカアセットを追加
   */
  async addAsset(replicaId: ID, asset: Omit<ReplicaAsset, 'id' | 'replicaId'>): Promise<ReplicaAsset> {
    logger.info(`アセット追加開始: replicaId=${replicaId}, originalUrl=${asset.originalUrl}`);
    
    const newAsset: ReplicaAsset = {
      id: `asset_${++this.assetIdCounter}`,
      replicaId,
      ...asset
    };

    const currentAssets = this.assets.get(replicaId) || [];
    currentAssets.push(newAsset);
    this.assets.set(replicaId, currentAssets);

    // レプリカのassets配列も更新
    const replica = this.replicas.get(replicaId);
    if (replica) {
      replica.assets.push(newAsset);
      replica.updatedAt = new Date().toISOString();
      this.replicas.set(replicaId, replica);
    }

    logger.info(`アセット追加成功: assetId=${newAsset.id}`);
    return newAsset;
  }

  /**
   * レプリカのアセット一覧を取得
   */
  async findAssetsByReplicaId(replicaId: ID): Promise<ReplicaAsset[]> {
    logger.info(`アセット一覧取得: replicaId=${replicaId}`);
    const assets = this.assets.get(replicaId) || [];
    logger.info(`アセット取得完了: ${assets.length}件`);
    return assets;
  }

  /**
   * プロジェクトIDからアセット一覧を取得
   */
  async findAssetsByProjectId(projectId: ID): Promise<ReplicaAsset[]> {
    logger.info(`プロジェクトのアセット一覧取得: projectId=${projectId}`);
    
    const replica = await this.findByProjectId(projectId);
    if (!replica) {
      logger.warn(`プロジェクトのレプリカが見つかりません: projectId=${projectId}`);
      return [];
    }

    return this.findAssetsByReplicaId(replica.id);
  }

  /**
   * レプリカを削除（プロジェクト削除時に使用）
   */
  async deleteByProjectId(projectId: ID): Promise<boolean> {
    logger.info(`レプリカ削除開始: projectId=${projectId}`);
    
    const replica = await this.findByProjectId(projectId);
    if (!replica) {
      logger.warn(`削除対象のレプリカが見つかりません: projectId=${projectId}`);
      return false;
    }

    // アセットも削除
    this.assets.delete(replica.id);
    this.replicas.delete(replica.id);
    
    logger.info(`レプリカ削除成功: replicaId=${replica.id}`);
    return true;
  }

  /**
   * テスト用: 全データをクリア
   */
  async clear(): Promise<void> {
    this.replicas.clear();
    this.assets.clear();
    this.replicaIdCounter = 0;
    this.assetIdCounter = 0;
    logger.info('レプリカリポジトリをクリアしました');
  }
}

// シングルトンインスタンス
export const replicaRepository = new ReplicaRepository();