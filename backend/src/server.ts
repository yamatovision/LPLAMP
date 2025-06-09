import { createServer } from 'http';
import { app } from './app';
import { WebSocketServer } from './websocket';
import { logger } from './common/utils/logger';

const PORT = process.env['PORT'] || 3001;

// HTTPサーバーの作成
const httpServer = createServer(app);

// WebSocketサーバーの初期化
const wsServer = new WebSocketServer(httpServer);

// サーバー起動
httpServer.listen(PORT, () => {
  logger.info(`サーバー起動: http://localhost:${PORT}`);
  logger.info(`WebSocket接続: ws://localhost:${PORT}/ws/socket.io`);
  logger.info(`環境: ${process.env['NODE_ENV'] || 'development'}`);
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