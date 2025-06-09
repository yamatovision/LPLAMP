/**
 * デプロイメント関連APIのバリデーション
 * セキュリティ対策とデータ整合性を確保
 */

import { body, param, query } from 'express-validator';
import { DeployProvider } from '../../types/index';

/**
 * デプロイ開始時のバリデーション
 */
export const validateTriggerDeploy = [
  body('projectId')
    .notEmpty()
    .withMessage('プロジェクトIDが必要です')
    .isString()
    .withMessage('プロジェクトIDは文字列である必要があります'),
    
  body('repo')
    .isString()
    .withMessage('リポジトリ名は文字列である必要があります')
    .matches(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/)
    .withMessage('リポジトリ名は "owner/repo" の形式である必要があります'),

  body('provider')
    .isIn(Object.values(DeployProvider))
    .withMessage(`プロバイダーは ${Object.values(DeployProvider).join(', ')} のいずれかである必要があります`),

  body('branch')
    .optional()
    .isString()
    .withMessage('ブランチ名は文字列である必要があります')
    .isLength({ min: 1, max: 100 })
    .withMessage('ブランチ名は1文字以上100文字以下である必要があります')
    .matches(/^[a-zA-Z0-9._/-]+$/)
    .withMessage('ブランチ名は英数字、ドット、ハイフン、アンダースコア、スラッシュのみ使用可能です')
    .custom((value) => {
      if (value && (value.startsWith('.') || value.startsWith('/') || value.endsWith('/') || 
          value.includes('//') || value.includes('..'))) {
        throw new Error('ブランチ名の形式が正しくありません');
      }
      return true;
    }),

  body('customDomain')
    .optional()
    .isString()
    .withMessage('カスタムドメインは文字列である必要があります')
    .matches(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
    .withMessage('有効なドメイン名を入力してください')
    .isLength({ max: 253 })
    .withMessage('ドメイン名は253文字以下である必要があります')
    .custom((value) => {
      // 危険なドメインパターンをチェック
      const dangerousPatterns = [
        /localhost/i,
        /127\.0\.0\.1/,
        /0\.0\.0\.0/,
        /\.local$/i,
        /\.internal$/i
      ];
      
      if (value && dangerousPatterns.some(pattern => pattern.test(value))) {
        throw new Error('指定されたドメインは使用できません');
      }
      return true;
    }),

  body('environmentVariables')
    .optional()
    .isObject()
    .withMessage('環境変数はオブジェクトである必要があります')
    .custom((value) => {
      if (value) {
        // 環境変数の数制限
        const keys = Object.keys(value);
        if (keys.length > 50) {
          throw new Error('環境変数は50個まで設定可能です');
        }

        // 各環境変数のバリデーション
        for (const [key, val] of Object.entries(value)) {
          // キーの形式チェック
          if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) {
            throw new Error(`環境変数名 "${key}" の形式が正しくありません`);
          }

          // キーの長さチェック
          if (key.length > 100) {
            throw new Error(`環境変数名 "${key}" は100文字以下である必要があります`);
          }

          // 値の型と長さチェック
          if (typeof val !== 'string') {
            throw new Error(`環境変数 "${key}" の値は文字列である必要があります`);
          }

          if ((val as string).length > 1000) {
            throw new Error(`環境変数 "${key}" の値は1000文字以下である必要があります`);
          }

          // 機密情報の検出
          const sensitivePatterns = [
            /password/i,
            /secret/i,
            /token/i,
            /key/i,
            /api[_-]?key/i
          ];

          if (sensitivePatterns.some(pattern => pattern.test(key))) {
            // 機密情報っぽい名前の場合は警告（エラーにはしない）
            console.warn(`環境変数 "${key}" は機密情報を含む可能性があります。適切に管理してください。`);
          }
        }
      }
      return true;
    })
];

/**
 * デプロイメントIDのバリデーション
 */
export const validateDeploymentId = [
  param('deploymentId')
    .isString()
    .withMessage('デプロイメントIDは文字列である必要があります')
    .isUUID()
    .withMessage('無効なデプロイメントID形式です')
];

/**
 * プロジェクトIDのバリデーション（UUIDまたは文字列形式）
 */
export const validateProjectId = [
  param('projectId')
    .isString()
    .withMessage('プロジェクトIDは文字列である必要があります')
    .custom((value) => {
      // UUIDまたは独自ID形式を許可
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const customIdPattern = /^[a-zA-Z0-9_-]+$/;
      
      if (!uuidPattern.test(value) && !customIdPattern.test(value)) {
        throw new Error('無効なプロジェクトID形式です');
      }
      return true;
    })
];

/**
 * ページネーションのバリデーション
 */
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('ページ番号は1以上1000以下の整数である必要があります'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('制限数は1以上100以下の整数である必要があります'),

  query('status')
    .optional()
    .isIn(Object.values(DeployProvider))
    .withMessage(`ステータスは有効な値である必要があります`)
];

/**
 * レート制限の設定
 */
export const validateRateLimit = {
  /**
   * デプロイ開始の制限（1時間に10回まで）
   */
  triggerDeploy: {
    windowMs: 60 * 60 * 1000, // 1時間
    max: 10,
    message: 'デプロイ開始の制限を超えました。1時間後に再試行してください。',
    standardHeaders: true,
    legacyHeaders: false,
  },

  /**
   * ステータス確認の制限（1分間に30回まで）
   */
  checkStatus: {
    windowMs: 60 * 1000, // 1分間
    max: 30,
    message: 'ステータス確認の制限を超えました。1分後に再試行してください。',
    standardHeaders: true,
    legacyHeaders: false,
  },

  /**
   * ログ取得の制限（1分間に20回まで）
   */
  getLogs: {
    windowMs: 60 * 1000, // 1分間
    max: 20,
    message: 'ログ取得の制限を超えました。1分後に再試行してください。',
    standardHeaders: true,
    legacyHeaders: false,
  },

  /**
   * デプロイメント一覧の制限（1分間に60回まで）
   */
  listDeployments: {
    windowMs: 60 * 1000, // 1分間
    max: 60,
    message: 'デプロイメント一覧取得の制限を超えました。1分後に再試行してください。',
    standardHeaders: true,
    legacyHeaders: false,
  }
};

/**
 * デプロイプロバイダー固有のバリデーション
 */
export const DeployProviderValidators = {
  /**
   * GitHub Pagesの制約チェック
   */
  validateGitHubPages: (repo: string, branch?: string) => {
    // GitHub Pagesは特定のブランチ名のみサポート
    const allowedBranches = ['main', 'master', 'gh-pages'];
    if (branch && !allowedBranches.includes(branch)) {
      throw new Error(`GitHub Pagesでは ${allowedBranches.join(', ')} ブランチのみサポートされています`);
    }

    // リポジトリ名の制約
    if (repo.includes('.github.io') && !repo.endsWith('.github.io')) {
      throw new Error('GitHub.ioリポジトリ名の形式が正しくありません');
    }

    return true;
  },

  /**
   * Vercelの制約チェック
   */
  validateVercel: (customDomain?: string) => {
    // Vercelでは特定のドメインパターンに制約がある
    if (customDomain) {
      const vercelDomainPattern = /\.vercel\.app$/;
      if (vercelDomainPattern.test(customDomain)) {
        throw new Error('Vercelの既定ドメインはカスタムドメインとして指定できません');
      }
    }

    return true;
  },

  /**
   * Netlifyの制約チェック
   */
  validateNetlify: (customDomain?: string) => {
    // Netlifyでは特定のドメインパターンに制約がある
    if (customDomain) {
      const netlifyDomainPattern = /\.netlify\.app$/;
      if (netlifyDomainPattern.test(customDomain)) {
        throw new Error('Netlifyの既定ドメインはカスタムドメインとして指定できません');
      }
    }

    return true;
  }
};

/**
 * セキュリティ関連のユーティリティ
 */
export const DeploySecurityUtils = {
  /**
   * URLの安全性チェック
   */
  isSafeUrl: (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      
      // プロトコルチェック
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return false;
      }

      // ローカルアドレスやプライベートIPの除外
      const dangerousHosts = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '169.254.169.254' // AWS metadata endpoint
      ];

      if (dangerousHosts.includes(parsedUrl.hostname)) {
        return false;
      }

      // プライベートIPレンジのチェック
      const privateIPPattern = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/;
      if (privateIPPattern.test(parsedUrl.hostname)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  },

  /**
   * 環境変数の機密情報マスク
   */
  maskEnvironmentVariables: (envVars: Record<string, string>): Record<string, string> => {
    const masked: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(envVars)) {
      const sensitivePatterns = [
        /password/i,
        /secret/i,
        /token/i,
        /key/i,
        /api[_-]?key/i
      ];

      if (sensitivePatterns.some(pattern => pattern.test(key))) {
        masked[key] = value.length > 4 ? 
          value.substring(0, 2) + '***' + value.substring(value.length - 2) : 
          '***';
      } else {
        masked[key] = value;
      }
    }

    return masked;
  },

  /**
   * ログ内容の機密情報除去
   */
  sanitizeLogs: (logs: string[]): string[] => {
    return logs.map(log => {
      // 各種トークンやキーのパターンを除去
      return log
        .replace(/token=[a-zA-Z0-9_-]+/gi, 'token=***')
        .replace(/key=[a-zA-Z0-9_-]+/gi, 'key=***')
        .replace(/password=[a-zA-Z0-9_-]+/gi, 'password=***')
        .replace(/secret=[a-zA-Z0-9_-]+/gi, 'secret=***');
    });
  }
};