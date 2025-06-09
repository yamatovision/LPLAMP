import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { createAuthRoutes } from './features/auth/auth.routes';
import { createProjectRoutes } from './features/projects/projects.routes';
import { createReplicaRoutes } from './features/replica/replica.routes';
import { createHistoryRoutes } from './features/history/history.routes';
import { createExportRoutes } from './features/export/export.routes';
import { createGitHubRoutes } from './features/github/github.routes';
import { createDeployRoutes, createProjectDeployRoutes } from './features/deploy/deploy.routes';
import elementRoutes from './features/element/element.routes';
import { logger } from './common/utils/logger';

const app = express();

// セキュリティミドルウェア
app.use(helmet());
app.use(cors({
  origin: process.env['FRONTEND_URL'] || 'http://localhost:5173',
  credentials: true
}));

// ロギング
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Cookieパーサー
app.use(cookieParser());

// JSONパーサー
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ルート設定
app.use('/api/auth', createAuthRoutes());
app.use('/api/projects', createProjectRoutes());
app.use('/api/projects', createReplicaRoutes());
app.use('/api/projects', createHistoryRoutes());
app.use('/api/projects', createProjectDeployRoutes());
app.use('/api/export', createExportRoutes());
app.use('/api/github', createGitHubRoutes());
app.use('/api/deploy', createDeployRoutes());
app.use('/api/element', elementRoutes);

// ヘルスチェック
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404ハンドラー
app.use('*', (_req, res) => {
  res.status(404).json({
    success: false,
    meta: {
      code: 'NOT_FOUND',
      message: 'エンドポイントが見つかりません'
    }
  });
});

// エラーハンドラー
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('アプリケーションエラー', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    success: false,
    meta: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '内部サーバーエラーが発生しました'
    }
  });
});

export { app };

// app.tsをモジュールとしてのみ使用（サーバー起動は別ファイルで実行）