/**
 * Sequelizeモデルのエクスポート
 * すべてのデータベースモデルを一元管理
 */

import { sequelize } from '../config/database';
import DeploymentModel from './Deployment';
import GitHubAuthModel from './GitHubAuth';

// モデルの関連付け（必要に応じて追加）
// DeploymentModel.belongsTo(UserModel, { foreignKey: 'userId' });
// GitHubAuthModel.belongsTo(UserModel, { foreignKey: 'userId' });

export {
  sequelize,
  DeploymentModel,
  GitHubAuthModel,
};

// データベース同期関数
export const syncDatabase = async (force = false): Promise<void> => {
  try {
    await sequelize.sync({ 
      force,
      alter: !force, // forceでない場合はalterモードを使用
      logging: false // テスト時はログを抑制
    });
    console.log('✅ データベーステーブルの同期が完了しました');
  } catch (error) {
    console.error('❌ データベース同期エラー:', error);
    throw error;
  }
};

// データベース接続テスト
export const testDatabaseConnection = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log('✅ データベース接続テスト成功');
  } catch (error) {
    console.error('❌ データベース接続テスト失敗:', error);
    throw error;
  }
};