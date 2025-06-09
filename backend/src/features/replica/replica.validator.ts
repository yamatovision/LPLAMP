import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../types';
import { logger } from '../../common/utils/logger';

/**
 * プロジェクトIDパラメータのバリデーション
 */
export const validateProjectIdParam = (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  const { id } = req.params;

  if (!id) {
    logger.warn('プロジェクトIDが指定されていません');
    res.status(400).json({
      success: false,
      error: 'プロジェクトIDが必要です'
    });
    return;
  }

  // プロジェクトID形式の検証（UUIDパターンの基本チェック）
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(id)) {
    logger.warn(`無効なプロジェクトID形式: ${id}`);
    res.status(400).json({
      success: false,
      error: '無効なプロジェクトID形式です'
    });
    return;
  }

  logger.info(`プロジェクトIDバリデーション成功: ${id}`);
  next();
};

/**
 * レプリカ作成リクエストのバリデーション
 */
export const validateReplicaCreateRequest = (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  const { html, css } = req.body;

  // HTML必須チェック
  if (!html || typeof html !== 'string') {
    logger.warn('HTMLコンテンツが指定されていません');
    res.status(400).json({
      success: false,
      error: 'HTMLコンテンツが必要です'
    });
    return;
  }

  // CSS必須チェック
  if (css !== undefined && typeof css !== 'string') {
    logger.warn('CSSの形式が無効です');
    res.status(400).json({
      success: false,
      error: 'CSSは文字列形式である必要があります'
    });
    return;
  }

  // HTMLの最小長チェック
  if (html.trim().length < 10) {
    logger.warn('HTMLコンテンツが短すぎます');
    res.status(400).json({
      success: false,
      error: 'HTMLコンテンツが短すぎます'
    });
    return;
  }

  logger.info('レプリカ作成リクエストバリデーション成功');
  next();
};

/**
 * アセット追加リクエストのバリデーション
 */
export const validateAssetAddRequest = (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  const { originalUrl, localPath, mimeType, size } = req.body;

  // 必須フィールドチェック
  if (!originalUrl || typeof originalUrl !== 'string') {
    logger.warn('オリジナルURLが指定されていません');
    res.status(400).json({
      success: false,
      error: 'オリジナルURLが必要です'
    });
    return;
  }

  if (!localPath || typeof localPath !== 'string') {
    logger.warn('ローカルパスが指定されていません');
    res.status(400).json({
      success: false,
      error: 'ローカルパスが必要です'
    });
    return;
  }

  if (!mimeType || typeof mimeType !== 'string') {
    logger.warn('MIMEタイプが指定されていません');
    res.status(400).json({
      success: false,
      error: 'MIMEタイプが必要です'
    });
    return;
  }

  if (typeof size !== 'number' || size < 0) {
    logger.warn('無効なファイルサイズ');
    res.status(400).json({
      success: false,
      error: '有効なファイルサイズが必要です'
    });
    return;
  }

  // URL形式の検証
  try {
    new URL(originalUrl);
  } catch (error) {
    logger.warn(`無効なURL形式: ${originalUrl}`);
    res.status(400).json({
      success: false,
      error: '無効なURL形式です'
    });
    return;
  }

  logger.info('アセット追加リクエストバリデーション成功');
  next();
};