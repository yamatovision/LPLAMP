/**
 * プロジェクト管理 - バリデーション
 * 
 * プロジェクト関連の入力データ検証ルールを定義
 * 型定義ファイルのVALIDATION定数と連携した一貫した検証
 */

import { VALIDATION } from '../../types';
import { logger } from '../../common/utils/logger';

/**
 * バリデーションエラー
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * プロジェクト作成時のバリデーション
 */
export interface ProjectCreateValidation {
  url: string;
  name?: string;
  githubRepo?: string;
  githubBranch?: string;
  deployProvider?: string;
  autoCommit?: boolean;
}

/**
 * プロジェクト更新時のバリデーション
 */
export interface ProjectUpdateValidation {
  name?: string;
  githubRepo?: string;
  deploymentUrl?: string;
}

/**
 * プロジェクト作成データのバリデーション
 */
export function validateProjectCreate(data: any): ProjectCreateValidation {
  const errors: string[] = [];

  // URL必須チェック
  if (!data.url) {
    errors.push('URLは必須です');
  } else if (typeof data.url !== 'string') {
    errors.push('URLは文字列である必要があります');
  } else if (!VALIDATION.PROJECT.URL.PATTERN.test(data.url)) {
    errors.push('有効なURL（http://またはhttps://）を入力してください');
  }

  // プロジェクト名のバリデーション（任意）
  if (data.name !== undefined) {
    if (typeof data.name !== 'string') {
      errors.push('プロジェクト名は文字列である必要があります');
    } else if (data.name.length < VALIDATION.PROJECT.NAME.MIN_LENGTH) {
      errors.push(`プロジェクト名は${VALIDATION.PROJECT.NAME.MIN_LENGTH}文字以上である必要があります`);
    } else if (data.name.length > VALIDATION.PROJECT.NAME.MAX_LENGTH) {
      errors.push(`プロジェクト名は${VALIDATION.PROJECT.NAME.MAX_LENGTH}文字以下である必要があります`);
    }
  }

  if (errors.length > 0) {
    logger.warn('プロジェクト作成バリデーションエラー', {
      errors,
      receivedData: data
    });
    throw new ValidationError(errors.join(', '), 'validation', data);
  }

  const result: ProjectCreateValidation = {
    url: data.url.trim(),
    ...(data.name && { name: data.name.trim() }),
    ...(data.githubRepo && { githubRepo: data.githubRepo }),
    ...(data.githubBranch && { githubBranch: data.githubBranch }),
    ...(data.deployProvider && { deployProvider: data.deployProvider }),
    ...(data.autoCommit !== undefined && { autoCommit: data.autoCommit })
  };

  logger.debug('プロジェクト作成バリデーション成功', result);
  return result;
}

/**
 * プロジェクト更新データのバリデーション
 */
export function validateProjectUpdate(data: any): ProjectUpdateValidation {
  const errors: string[] = [];
  const result: ProjectUpdateValidation = {};

  // プロジェクト名のバリデーション（任意）
  if (data.name !== undefined) {
    if (typeof data.name !== 'string') {
      errors.push('プロジェクト名は文字列である必要があります');
    } else if (data.name.length < VALIDATION.PROJECT.NAME.MIN_LENGTH) {
      errors.push(`プロジェクト名は${VALIDATION.PROJECT.NAME.MIN_LENGTH}文字以上である必要があります`);
    } else if (data.name.length > VALIDATION.PROJECT.NAME.MAX_LENGTH) {
      errors.push(`プロジェクト名は${VALIDATION.PROJECT.NAME.MAX_LENGTH}文字以下である必要があります`);
    } else {
      result.name = data.name.trim();
    }
  }

  // GitHubリポジトリのバリデーション（任意）
  if (data.githubRepo !== undefined) {
    if (data.githubRepo === null) {
      (result as any).githubRepo = null;
    } else if (typeof data.githubRepo !== 'string') {
      errors.push('GitHubリポジトリは文字列である必要があります');
    } else if (data.githubRepo.trim().length === 0) {
      (result as any).githubRepo = null;
    } else {
      // GitHubリポジトリ名の形式チェック（owner/repo）
      const repoPattern = /^[a-zA-Z0-9\-_.]+\/[a-zA-Z0-9\-_.]+$/;
      if (!repoPattern.test(data.githubRepo.trim())) {
        errors.push('GitHubリポジトリは「owner/repository」の形式で入力してください');
      } else {
        result.githubRepo = data.githubRepo.trim();
      }
    }
  }

  // デプロイメントURLのバリデーション（任意）
  if (data.deploymentUrl !== undefined) {
    if (data.deploymentUrl === null) {
      (result as any).deploymentUrl = null;
    } else if (typeof data.deploymentUrl !== 'string') {
      errors.push('デプロイメントURLは文字列である必要があります');
    } else if (data.deploymentUrl.trim().length === 0) {
      (result as any).deploymentUrl = null;
    } else {
      // URLの形式チェック
      if (!VALIDATION.PROJECT.URL.PATTERN.test(data.deploymentUrl.trim())) {
        errors.push('有効なデプロイメントURL（http://またはhttps://）を入力してください');
      } else {
        result.deploymentUrl = data.deploymentUrl.trim();
      }
    }
  }

  if (errors.length > 0) {
    logger.warn('プロジェクト更新バリデーションエラー', {
      errors,
      receivedData: data
    });
    throw new ValidationError(errors.join(', '), 'validation', data);
  }

  // 更新対象のフィールドが存在するかチェック
  if (Object.keys(result).length === 0) {
    logger.warn('プロジェクト更新: 更新対象フィールドがありません', { receivedData: data });
    throw new ValidationError('更新する項目が指定されていません', 'validation', data);
  }

  logger.debug('プロジェクト更新バリデーション成功', result);
  return result;
}

/**
 * プロジェクトIDのバリデーション
 */
export function validateProjectId(projectId: any): string {
  if (!projectId) {
    throw new ValidationError('プロジェクトIDは必須です', 'projectId', projectId);
  }

  if (typeof projectId !== 'string') {
    throw new ValidationError('プロジェクトIDは文字列である必要があります', 'projectId', projectId);
  }

  if (projectId.trim().length === 0) {
    throw new ValidationError('プロジェクトIDが空です', 'projectId', projectId);
  }

  return projectId.trim();
}

/**
 * ユーザーIDのバリデーション
 */
export function validateUserId(userId: any): string {
  if (!userId) {
    throw new ValidationError('ユーザーIDは必須です', 'userId', userId);
  }

  if (typeof userId !== 'string') {
    throw new ValidationError('ユーザーIDは文字列である必要があります', 'userId', userId);
  }

  if (userId.trim().length === 0) {
    throw new ValidationError('ユーザーIDが空です', 'userId', userId);
  }

  return userId.trim();
}

/**
 * URLアクセス可能性の事前チェック
 * 実際のHTTPリクエストは行わず、基本的な形式のみチェック
 */
export function validateUrlFormat(url: string): void {
  try {
    const urlObj = new URL(url);
    
    // プロトコルチェック
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new ValidationError('HTTPまたはHTTPSのURLを指定してください', 'url', url);
    }

    // ホスト名チェック
    if (!urlObj.hostname) {
      throw new ValidationError('有効なホスト名を含むURLを指定してください', 'url', url);
    }

    // ローカルホストの除外（本番環境では）
    if (process.env['NODE_ENV'] === 'production') {
      const localHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
      if (localHosts.includes(urlObj.hostname)) {
        throw new ValidationError('ローカルホストのURLは使用できません', 'url', url);
      }
    }

    logger.debug('URL形式バリデーション成功', { url, hostname: urlObj.hostname });
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    logger.warn('URL形式バリデーションエラー', { url, error: error instanceof Error ? error.message : String(error) });
    throw new ValidationError('有効なURL形式ではありません', 'url', url);
  }
}