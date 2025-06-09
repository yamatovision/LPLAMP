/**
 * Jestテスト環境のセットアップ
 */

import { config } from 'dotenv';
import path from 'path';

// 環境変数の読み込み
const envPath = path.resolve(process.cwd(), '.env.test');
config({ path: envPath });

// テスト環境の設定
process.env['NODE_ENV'] = 'test';

// ログレベルの設定（テスト時はエラーのみ）
process.env['LOG_LEVEL'] = 'error';

console.log('テスト環境セットアップ完了:', {
  NODE_ENV: process.env['NODE_ENV'],
  GITHUB_CLIENT_ID: process.env['GITHUB_CLIENT_ID'] ? '設定済み' : '未設定',
  JWT_SECRET: process.env['JWT_SECRET'] ? '設定済み' : '未設定',
});