import { Router } from 'express';
import { elementController } from './element.controller';
import { elementValidators } from './element.validator';
import { authMiddleware } from '../../common/middlewares/auth.middleware';

const router = Router();

/**
 * 要素コンテキスト作成
 * POST /api/element/context
 * 
 * 機能: 選択された要素の情報をClaudeCodeに伝達し、編集コンテキストを作成
 * 認証: 必須
 * リクエスト: ElementContextRequest
 * レスポンス: ElementContextResponse
 */
router.post(
  '/context',
  authMiddleware,
  elementValidators.createContext(),
  elementController.createContext
);

/**
 * 要素コンテキスト履歴取得
 * GET /api/element/context/history/:projectId
 * 
 * 機能: プロジェクトの要素コンテキスト履歴を取得
 * 認証: 必須
 * パラメータ: projectId (UUID)
 * クエリ: limit (number, optional, default: 10)
 * レスポンス: ElementContext[]
 */
router.get(
  '/context/history/:projectId',
  authMiddleware,
  elementController.getContextHistory
);

export default router;