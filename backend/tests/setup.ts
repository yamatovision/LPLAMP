/**
 * Jestテスト環境のセットアップ
 */

import { config } from 'dotenv';
import path from 'path';
import { syncDatabase, testDatabaseConnection } from '../src/models/index';

// 環境変数の読み込み
const envPath = path.resolve(process.cwd(), '.env.test');
config({ path: envPath });

// テスト環境の設定
process.env['NODE_ENV'] = 'test';

// ログレベルの設定（テスト時はエラーのみ）
process.env['LOG_LEVEL'] = 'error';

// テスト用一時ディレクトリの設定
process.env['TEMP_DIR'] = '/tmp/lplamp-test';

// グローバル変数でデータベース初期化状態を追跡
let isDatabaseInitialized = false;
let initializationPromise: Promise<void> | null = null;

// 一度だけ実行される初期化関数
const initializeDatabase = async (): Promise<void> => {
  if (isDatabaseInitialized) {
    return;
  }

  if (initializationPromise) {
    await initializationPromise;
    return;
  }

  initializationPromise = (async () => {
    try {
      console.log('🔧 テスト用データベース初期化開始...');
      
      // データベース接続テスト
      await testDatabaseConnection();
      
      // テーブルを強制的に再作成（テスト環境用）
      await syncDatabase(true);
      
      isDatabaseInitialized = true;
      console.log('✅ テスト用データベース初期化完了');
    } catch (error) {
      console.error('❌ テスト用データベース初期化失敗:', error);
      isDatabaseInitialized = false;
      initializationPromise = null;
      throw error;
    }
  })();

  await initializationPromise;
};

// グローバルセットアップ：全テスト実行前に一度だけ実行
beforeAll(async () => {
  await initializeDatabase();
}, 30000); // 30秒のタイムアウト

console.log('テスト環境セットアップ完了:', {
  NODE_ENV: process.env['NODE_ENV'],
  GITHUB_CLIENT_ID: process.env['GITHUB_CLIENT_ID'] ? '設定済み' : '未設定',
  JWT_SECRET: process.env['JWT_SECRET'] ? '設定済み' : '未設定',
  TEMP_DIR: process.env['TEMP_DIR']
});