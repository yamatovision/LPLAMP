import { Sequelize } from 'sequelize';

// 環境変数から設定を取得（デフォルト値を設定）
const DB_NAME = process.env['DB_NAME'] || 'lplamp_development';
const DB_USER = process.env['DB_USER'] || 'lplamp_user';
const DB_PASSWORD = process.env['DB_PASSWORD'] || 'lplamp_password';
const DB_HOST = process.env['DB_HOST'] || 'localhost';
const DB_PORT = process.env['DB_PORT'] ? parseInt(process.env['DB_PORT']) : 5432;

// Sequelizeインスタンスを作成
export const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  logging: process.env['NODE_ENV'] === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true
  }
});

// データベース接続テスト
export const testConnection = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log('データベース接続が確立されました。');
  } catch (error) {
    console.error('データベース接続に失敗しました:', error);
    throw error;
  }
};