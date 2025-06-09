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

    // デバッグ用（テスト時のみ）
    if (process.env['NODE_ENV'] === 'test') {
      console.log('WebSocket認証デバッグ:', {
        socketId: socket.id,
        token: token ? token.substring(0, 20) + '...' : 'なし'
      });
    }

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

    // デバッグ用（テスト時のみ）
    if (process.env['NODE_ENV'] === 'test') {
      console.log('JWT検証デバッグ:', {
        jwtType: typeof jwt,
        jwtVerifyType: typeof jwt.verify,
        jwtSecretLength: jwtSecret ? jwtSecret.length : 0
      });
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
    // トークンの取得（エラー時でも取得可能にするため）
    const token = socket.handshake.query['token'] as string || 
                  socket.handshake.auth['token'] as string;
    
    logger.error(`WebSocket認証エラー (${socket.id}):`, { 
      error,
      errorName: error && typeof error === 'object' && 'name' in error ? (error as any).name : 'unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
      token: token ? `${token.substring(0, 20)}...` : 'なし'
    });
    
    if (error && typeof error === 'object' && 'name' in error) {
      const errorName = (error as any).name;
      if (errorName === 'JsonWebTokenError') {
        return next(new Error('無効な認証トークン'));
      } else if (errorName === 'TokenExpiredError') {
        return next(new Error('認証トークンの有効期限が切れています'));
      }
    }
    
    return next(new Error('認証エラー'));
  }
};