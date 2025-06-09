/**
 * Sequelize Deploymentモデル
 * PostgreSQLデータベースへの永続化対応
 */

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { DeployProvider, DeploymentStatus } from '../types/index';

// デプロイメント属性インターface
export interface DeploymentAttributes {
  id: string;
  projectId: string;
  userId: string;
  provider: DeployProvider;
  repositoryUrl: string;
  branch: string;
  customDomain?: string;
  environmentVariables?: Record<string, string>;
  status: DeploymentStatus;
  deploymentUrl?: string;
  buildLogs: string[];
  errorMessage?: string;
  deployedAt?: Date;
  lastCheckedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 作成時にオプショナルな属性
export interface DeploymentCreationAttributes extends Optional<DeploymentAttributes, 
  'id' | 'customDomain' | 'environmentVariables' | 'deploymentUrl' | 'errorMessage' | 'deployedAt' | 'lastCheckedAt' | 'createdAt' | 'updatedAt'
> {}

// Sequelizeモデルクラス
export class DeploymentModel extends Model<DeploymentAttributes, DeploymentCreationAttributes> 
  implements DeploymentAttributes {
  // Sequelizeによるgetters/settersを利用するため、フィールド宣言を削除
  declare id: string;
  declare projectId: string;
  declare userId: string;
  declare provider: DeployProvider;
  declare repositoryUrl: string;
  declare branch: string;
  declare customDomain?: string;
  declare environmentVariables?: Record<string, string>;
  declare status: DeploymentStatus;
  declare deploymentUrl?: string;
  declare buildLogs: string[];
  declare errorMessage?: string;
  declare deployedAt?: Date;
  declare lastCheckedAt: Date;
  
  // タイムスタンプ（Sequelizeが自動管理）
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

// Sequelizeモデル定義
DeploymentModel.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  projectId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'project_id',
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
  },
  provider: {
    type: DataTypes.ENUM('github-pages', 'vercel', 'netlify'),
    allowNull: false,
  },
  repositoryUrl: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'repository_url',
  },
  branch: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'main',
  },
  customDomain: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'custom_domain',
  },
  environmentVariables: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'environment_variables',
  },
  status: {
    type: DataTypes.ENUM('pending', 'building', 'ready', 'error'),
    allowNull: false,
    defaultValue: 'pending',
  },
  deploymentUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'deployment_url',
  },
  buildLogs: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    field: 'build_logs',
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_message',
  },
  deployedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'deployed_at',
  },
  lastCheckedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'last_checked_at',
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at',
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at',
  },
} as any, {
  sequelize,
  modelName: 'Deployment',
  tableName: 'deployments',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['project_id'],
    },
    {
      fields: ['user_id'],
    },
    {
      fields: ['status'],
    },
    {
      fields: ['provider'],
    },
    {
      fields: ['created_at'],
    },
  ],
});

export default DeploymentModel;