/**
 * GitHub関連APIのバリデーション
 * セキュリティ対策とデータ整合性を確保
 */

import { body, param } from 'express-validator';
import { VALIDATION } from '../../types/index';

/**
 * リポジトリ作成時のバリデーション
 */
export const validateCreateRepository = [
  body('name')
    .isString()
    .withMessage('リポジトリ名は文字列である必要があります')
    .isLength({ min: 1, max: 100 })
    .withMessage('リポジトリ名は1文字以上100文字以下である必要があります')
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('リポジトリ名は英数字、ドット、ハイフン、アンダースコアのみ使用可能です')
    .custom((value) => {
      // GitHubの命名規則に準拠
      if (value.startsWith('.') || value.startsWith('-') || value.endsWith('.git')) {
        throw new Error('リポジトリ名の形式が正しくありません');
      }
      return true;
    }),

  body('description')
    .optional()
    .isString()
    .withMessage('説明は文字列である必要があります')
    .isLength({ max: 500 })
    .withMessage('説明は500文字以下である必要があります'),

  body('private')
    .optional()
    .isBoolean()
    .withMessage('プライベート設定はboolean値である必要があります')
];

/**
 * リポジトリフルネームのバリデーション
 */
export const validateRepositoryFullName = [
  param('fullName')
    .isString()
    .withMessage('リポジトリフルネームは文字列である必要があります')
    .matches(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/)
    .withMessage('リポジトリフルネームは "owner/repo" の形式である必要があります')
];

/**
 * ファイルプッシュ時のバリデーション
 */
export const validatePushFiles = [
  body('exportId')
    .isUUID()
    .withMessage('エクスポートIDは有効なUUIDである必要があります'),

  body('repo')
    .isString()
    .withMessage('リポジトリ名は文字列である必要があります')
    .matches(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/)
    .withMessage('リポジトリ名は "owner/repo" の形式である必要があります'),

  body('branch')
    .isString()
    .withMessage('ブランチ名は文字列である必要があります')
    .isLength({ min: 1, max: 100 })
    .withMessage('ブランチ名は1文字以上100文字以下である必要があります')
    .matches(/^[a-zA-Z0-9._/-]+$/)
    .withMessage('ブランチ名は英数字、ドット、ハイフン、アンダースコア、スラッシュのみ使用可能です')
    .custom((value) => {
      // Gitの命名規則に準拠
      if (value.startsWith('.') || value.startsWith('/') || value.endsWith('/') || 
          value.includes('//') || value.includes('..')) {
        throw new Error('ブランチ名の形式が正しくありません');
      }
      return true;
    }),

  body('message')
    .isString()
    .withMessage('コミットメッセージは文字列である必要があります')
    .isLength({ min: 1, max: VALIDATION.GITHUB.COMMIT_MESSAGE.MAX_LENGTH })
    .withMessage(`コミットメッセージは1文字以上${VALIDATION.GITHUB.COMMIT_MESSAGE.MAX_LENGTH}文字以下である必要があります`)
    .custom((value) => {
      // コミットメッセージの基本的な形式チェック
      const trimmedValue = value.trim();
      if (trimmedValue.length === 0) {
        throw new Error('コミットメッセージは空白のみにできません');
      }
      return true;
    })
];

/**
 * ファイルパスのバリデーション
 */
export const validateFilePath = [
  param('filePath')
    .isString()
    .withMessage('ファイルパスは文字列である必要があります')
    .custom((value) => {
      // セキュリティ: パストラバーサル攻撃を防ぐ
      if (value.includes('..') || value.includes('//') || 
          value.startsWith('/') || value.includes('\\')) {
        throw new Error('不正なファイルパスです');
      }
      
      // GitHubの制限に準拠
      if (value.length > 255) {
        throw new Error('ファイルパスは255文字以下である必要があります');
      }
      
      return true;
    })
];

/**
 * コミットSHAのバリデーション
 */
export const validateCommitSha = [
  param('sha')
    .isString()
    .withMessage('コミットSHAは文字列である必要があります')
    .matches(/^[a-f0-9]{40}$/)
    .withMessage('コミットSHAは40文字の16進数である必要があります')
];

/**
 * レート制限のバリデーション
 * GitHub APIのレート制限を考慮した制限
 */
export const validateRateLimit = {
  /**
   * リポジトリ作成の制限（1時間に10回まで）
   */
  createRepository: {
    windowMs: 60 * 60 * 1000, // 1時間
    max: 10,
    message: 'リポジトリ作成の制限を超えました。1時間後に再試行してください。'
  },

  /**
   * ファイルプッシュの制限（1分間に30回まで）
   */
  pushFiles: {
    windowMs: 60 * 1000, // 1分間
    max: 30,
    message: 'ファイルプッシュの制限を超えました。1分後に再試行してください。'
  },

  /**
   * リポジトリ一覧取得の制限（1分間に60回まで）
   */
  listRepositories: {
    windowMs: 60 * 1000, // 1分間
    max: 60,
    message: 'リポジトリ一覧取得の制限を超えました。1分後に再試行してください。'
  }
};

/**
 * GitHubアクセストークンの形式バリデーション
 */
export const validateGitHubToken = (token: string): boolean => {
  // GitHub Personal Access Token (classic) の形式
  // 形式: ghp_[36文字の英数字]
  const classicTokenPattern = /^ghp_[a-zA-Z0-9]{36}$/;
  
  // GitHub App Installation Token の形式
  // 形式: ghs_[36文字の英数字]
  const appTokenPattern = /^ghs_[a-zA-Z0-9]{36}$/;
  
  // Fine-grained personal access token の形式
  // 形式: github_pat_[22文字の英数字とアンダースコア]_[59文字の英数字とアンダースコア]
  const fineGrainedTokenPattern = /^github_pat_[a-zA-Z0-9_]{22}_[a-zA-Z0-9_]{59}$/;
  
  return classicTokenPattern.test(token) || 
         appTokenPattern.test(token) || 
         fineGrainedTokenPattern.test(token);
};

/**
 * リポジトリ権限の確認
 * @param permissions リポジトリの権限情報
 * @param requiredPermission 必要な権限レベル
 */
export const hasRequiredPermission = (
  permissions: { admin?: boolean; push?: boolean; pull?: boolean },
  requiredPermission: 'admin' | 'push' | 'pull'
): boolean => {
  switch (requiredPermission) {
    case 'admin':
      return permissions.admin === true;
    case 'push':
      return permissions.admin === true || permissions.push === true;
    case 'pull':
      return permissions.admin === true || permissions.push === true || permissions.pull === true;
    default:
      return false;
  }
};

/**
 * セキュリティ関連のユーティリティ
 */
export const SecurityUtils = {
  /**
   * 機密情報をマスクする
   */
  maskToken: (token: string): string => {
    if (token.length <= 8) return '***';
    return token.substring(0, 4) + '***' + token.substring(token.length - 4);
  },

  /**
   * ログ用に安全な文字列に変換
   */
  sanitizeForLog: (input: string): string => {
    return input.replace(/[^\w\s.-]/g, '?');
  },

  /**
   * ファイル名の安全性チェック
   */
  isSafeFileName: (fileName: string): boolean => {
    // 基本的な安全性チェック
    const unsafePatterns = [
      /\.\./,           // パストラバーサル
      /^\/|\/$/,        // 絶対パスや末尾スラッシュ
      /\/\//,           // 連続スラッシュ
      /[\x00-\x1f]/,    // 制御文字
      /[<>:"|?*]/,      // Windowsで禁止された文字
    ];

    return !unsafePatterns.some(pattern => pattern.test(fileName));
  }
};