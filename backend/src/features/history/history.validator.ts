import { Request, Response, NextFunction } from 'express';
import { HistoryType, ElementInfo } from '../../types';
import { logger } from '../../common/utils/logger';

/**
 * 履歴作成リクエストのバリデーション
 */
export const validateCreateHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { description, snapshot, type } = req.body;
    const { id: projectId } = req.params;

    // 必須フィールドのチェック
    if (!projectId) {
      res.status(400).json({
        success: false,
        error: 'プロジェクトIDが必要です'
      });
      return;
    }

    if (!description || typeof description !== 'string') {
      res.status(400).json({
        success: false,
        error: '説明文が必要です'
      });
      return;
    }

    if (!snapshot || typeof snapshot !== 'object') {
      res.status(400).json({
        success: false,
        error: 'スナップショットが必要です'
      });
      return;
    }

    // スナップショットの構造検証
    if (!snapshot.html || typeof snapshot.html !== 'string') {
      res.status(400).json({
        success: false,
        error: 'スナップショットにHTMLが必要です'
      });
      return;
    }

    if (!Array.isArray(snapshot.changedElements)) {
      res.status(400).json({
        success: false,
        error: 'スナップショットに変更要素の配列が必要です'
      });
      return;
    }

    // 変更要素の検証
    for (const element of snapshot.changedElements) {
      if (!validateElementInfo(element)) {
        res.status(400).json({
          success: false,
          error: '無効な要素情報が含まれています'
        });
        return;
      }
    }

    // 履歴タイプの検証（オプション）
    if (type && !Object.values(HistoryType).includes(type)) {
      res.status(400).json({
        success: false,
        error: '無効な履歴タイプです'
      });
      return;
    }

    logger.info('履歴作成リクエストの検証に成功しました', {
      projectId,
      type: type || HistoryType.EDIT
    });

    next();
  } catch (error) {
    logger.error('履歴作成リクエストの検証中にエラーが発生しました', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'バリデーション中にエラーが発生しました'
    });
  }
};

/**
 * 履歴復元リクエストのバリデーション
 */
export const validateRestoreHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: projectId, historyId } = req.params;

    if (!projectId) {
      res.status(400).json({
        success: false,
        error: 'プロジェクトIDが必要です'
      });
      return;
    }

    if (!historyId) {
      res.status(400).json({
        success: false,
        error: '履歴IDが必要です'
      });
      return;
    }

    logger.info('履歴復元リクエストの検証に成功しました', {
      projectId,
      historyId
    });

    next();
  } catch (error) {
    logger.error('履歴復元リクエストの検証中にエラーが発生しました', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'バリデーション中にエラーが発生しました'
    });
  }
};

/**
 * ページネーションパラメータのバリデーション
 */
export const validatePagination = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page, limit } = req.query;

    // ページ番号の検証
    if (page !== undefined) {
      const pageNum = Number(page);
      if (isNaN(pageNum) || pageNum < 1) {
        res.status(400).json({
          success: false,
          error: '無効なページ番号です'
        });
        return;
      }
      req.query['page'] = pageNum.toString();
    }

    // 取得件数の検証
    if (limit !== undefined) {
      const limitNum = Number(limit);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        res.status(400).json({
          success: false,
          error: '取得件数は1から100の間で指定してください'
        });
        return;
      }
      req.query['limit'] = limitNum.toString();
    }

    next();
  } catch (error) {
    logger.error('ページネーションパラメータの検証中にエラーが発生しました', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'バリデーション中にエラーが発生しました'
    });
  }
};

/**
 * ElementInfo型の検証ヘルパー関数
 */
function validateElementInfo(element: any): element is ElementInfo {
  if (!element || typeof element !== 'object') {
    return false;
  }

  // 必須フィールドの存在チェック
  const requiredFields = ['selector', 'tagName', 'text', 'html', 'styles'];
  for (const field of requiredFields) {
    if (!(field in element)) {
      return false;
    }
  }

  // 型チェック
  if (
    typeof element.selector !== 'string' ||
    typeof element.tagName !== 'string' ||
    typeof element.text !== 'string' ||
    typeof element.html !== 'string' ||
    typeof element.styles !== 'object'
  ) {
    return false;
  }

  // スタイルオブジェクトの検証
  const requiredStyles = ['color', 'backgroundColor', 'fontSize', 'fontFamily'];
  for (const style of requiredStyles) {
    if (typeof element.styles[style] !== 'string') {
      return false;
    }
  }

  return true;
}