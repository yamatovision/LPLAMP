import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../common/utils/logger';
import { JWTPayload, AuthenticatedUser } from '../types';

/**
 * WebSocket接続の認証ミドルウェア
 */
export const authenticateSocket = (socket: Socket, next: (err?: Error) => void): void => {
  try {
    // トークンの取得（クエリパラメータまたはハンドシェイク認証から）
    const token = socket.handshake.query['token'] as string || 
                  socket.handshake.auth['token'] as string;

    if (!token) {
      logger.warn(`WebSocket認証失敗: トークンが提供されていません (${socket.id})`);
      return next(new Error('認証トークンが必要です'));
    }

    // JWTトークンの検証
    const jwtSecret = process.env['JWT_SECRET'];
    if (!jwtSecret) {
      logger.error('JWT_SECRETが設定されていません');
      return next(new Error('サーバー設定エラー'));
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    
    // 認証済みユーザー情報の設定
    const user: AuthenticatedUser = {
      id: decoded.sub,
      githubId: decoded.githubId,
      username: decoded.username
    };

    socket.data.user = user;
    
    logger.info(`WebSocket認証成功: ${user.username} (${socket.id})`);
    next();

  } catch (error) {
    logger.error(`WebSocket認証エラー (${socket.id}):`, { error });
    
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new Error('無効な認証トークン'));
    } else if (error instanceof jwt.TokenExpiredError) {
      return next(new Error('認証トークンの有効期限が切れています'));
    } else {
      return next(new Error('認証エラー'));
    }
  }
};