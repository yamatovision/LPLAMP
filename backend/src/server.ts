import { config } from 'dotenv';
import { createServer } from 'http';
import { app } from './app';
import { WebSocketServer } from './websocket';
import { logger } from './common/utils/logger';
import path from 'path';

// 環境変数を読み込み（プロジェクトルートの.envファイルを指定）
const envPath = path.resolve(process.cwd(), '..', '.env');
const envResult = config({ path: envPath });

// 環境変数読み込み結果のログ出力
if (envResult.error) {
  console.error('環境変数読み込みエラー:', envResult.error);
} else {
  console.log('環境変数読み込み成功:', envPath);
  console.log('GITHUB_CLIENT_ID:', process.env['GITHUB_CLIENT_ID'] ? '設定済み' : '未設定');
  console.log('GITHUB_CLIENT_SECRET:', process.env['GITHUB_CLIENT_SECRET'] ? '設定済み' : '未設定');
  console.log('JWT_SECRET:', process.env['JWT_SECRET'] ? '設定済み' : '未設定');
}

const PORT = process.env['PORT'] || 8080;
const HOST = process.env['HOST'] || 'localhost';

// HTTPサーバーの作成
const httpServer = createServer(app);

// WebSocketサーバーの初期化
const wsServer = new WebSocketServer(httpServer);

// Codespaces環境の検出
const isCodespaces = process.env['CODESPACES'] === 'true';
const codespaceName = process.env['CODESPACE_NAME'];

// サーバー起動
httpServer.listen(Number(PORT), HOST, () => {
  logger.info(`サーバー起動: http://${HOST}:${PORT}`);
  logger.info(`WebSocket接続: ws://${HOST}:${PORT}/ws/socket.io`);
  logger.info(`環境: ${process.env['NODE_ENV'] || 'development'}`);
  
  if (isCodespaces) {
    logger.info(`🚀 GitHub Codespaces環境で動作中`);
    logger.info(`📝 Codespace名: ${codespaceName}`);
    logger.info(`🌐 外部アクセスURL: https://${codespaceName}-${PORT}.githubpreview.dev`);
  }
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  logger.info('SIGTERM受信: サーバーをシャットダウンします');
  
  httpServer.close(() => {
    logger.info('HTTPサーバー停止');
    wsServer.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT受信: サーバーをシャットダウンします');
  
  httpServer.close(() => {
    logger.info('HTTPサーバー停止');
    wsServer.close();
    process.exit(0);
  });
});

// 未処理エラーのハンドリング
process.on('uncaughtException', (error) => {
  logger.error('未処理例外:', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未処理Promise拒否:', { reason, promise });
});

export { httpServer, wsServer };