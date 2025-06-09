/**
 * Sequelize GitHubAuthモデル
 * GitHub認証情報の永続化対応
 */

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// GitHub認証情報属性インターface
export interface GitHubAuthAttributes {
  id: string;
  userId: string;
  accessToken: string;
  tokenType: string;
  scope: string;
  username: string;
  avatarUrl?: string;
  isActive: boolean;
  expiresAt?: Date;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 作成時にオプショナルな属性
export interface GitHubAuthCreationAttributes extends Optional<GitHubAuthAttributes, 
  'id' | 'avatarUrl' | 'expiresAt' | 'lastUsedAt' | 'createdAt' | 'updatedAt'
> {}

// Sequelizeモデルクラス
export class GitHubAuthModel extends Model<GitHubAuthAttributes, GitHubAuthCreationAttributes> 
  implements GitHubAuthAttributes {
  declare id: string;
  declare userId: string;
  declare accessToken: string;
  declare tokenType: string;
  declare scope: string;
  declare username: string;
  declare avatarUrl?: string;
  declare isActive: boolean;
  declare expiresAt?: Date;
  declare lastUsedAt: Date;
  
  // タイムスタンプ（Sequelizeが自動管理）
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

// Sequelizeモデル定義
GitHubAuthModel.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    field: 'user_id',
  },
  accessToken: {
    type: DataTypes.STRING(500),
    allowNull: false,
    field: 'access_token',
  },
  tokenType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'bearer',
    field: 'token_type',
  },
  scope: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  avatarUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'avatar_url',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expires_at',
  },
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'last_used_at',
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
  modelName: 'GitHubAuth',
  tableName: 'github_auths',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['user_id'],
      unique: true,
    },
    {
      fields: ['username'],
    },
    {
      fields: ['is_active'],
    },
    {
      fields: ['last_used_at'],
    },
  ],
});

export default GitHubAuthModel;