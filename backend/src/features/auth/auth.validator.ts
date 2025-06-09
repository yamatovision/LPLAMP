/**
 * 認証関連バリデーター
 * 
 * GitHub OAuth認証とJWT関連の入力検証
 * セキュリティとデータ整合性を確保
 */

import { CreateUserInput, UpdateUserInput } from './auth.model.js';

/**
 * バリデーション結果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * バリデーションエラー
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: string[]
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * GitHub OAuth コードの検証
 */
export function validateOAuthCode(code: string): ValidationResult {
  const errors: string[] = [];

  if (!code) {
    errors.push('OAuth認証コードが必要です');
  } else if (typeof code !== 'string') {
    errors.push('OAuth認証コードは文字列である必要があります');
  } else if (code.length < 10) {
    errors.push('OAuth認証コードが短すぎます');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * GitHub ユーザー情報の検証
 */
export function validateGitHubUser(githubUser: any): ValidationResult {
  const errors: string[] = [];

  if (!githubUser) {
    errors.push('GitHubユーザー情報が必要です');
    return { isValid: false, errors };
  }

  // ID検証
  if (!githubUser.id) {
    errors.push('GitHub IDが必要です');
  } else if (typeof githubUser.id !== 'string' && typeof githubUser.id !== 'number') {
    errors.push('GitHub IDの形式が正しくありません');
  }

  // ユーザー名検証
  if (!githubUser.login) {
    errors.push('GitHubユーザー名が必要です');
  } else if (typeof githubUser.login !== 'string') {
    errors.push('GitHubユーザー名は文字列である必要があります');
  } else if (githubUser.login.length < 1 || githubUser.login.length > 39) {
    errors.push('GitHubユーザー名の長さが不正です（1-39文字）');
  } else if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9]))*$/.test(githubUser.login)) {
    errors.push('GitHubユーザー名の形式が正しくありません');
  }

  // メール検証（オプショナル）
  if (githubUser.email !== null && githubUser.email !== undefined) {
    if (typeof githubUser.email !== 'string') {
      errors.push('メールアドレスは文字列である必要があります');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(githubUser.email)) {
      errors.push('メールアドレスの形式が正しくありません');
    }
  }

  // アバターURL検証（オプショナル）
  if (githubUser.avatar_url !== null && githubUser.avatar_url !== undefined) {
    if (typeof githubUser.avatar_url !== 'string') {
      errors.push('アバターURLは文字列である必要があります');
    } else if (!/^https?:\/\/.+/.test(githubUser.avatar_url)) {
      errors.push('アバターURLの形式が正しくありません');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * アクセストークンの検証
 */
export function validateAccessToken(token: string): ValidationResult {
  const errors: string[] = [];

  if (!token) {
    errors.push('アクセストークンが必要です');
  } else if (typeof token !== 'string') {
    errors.push('アクセストークンは文字列である必要があります');
  } else if (token.length < 20) {
    errors.push('アクセストークンが短すぎます');
  } else if (!/^[a-zA-Z0-9_-]+$/.test(token)) {
    errors.push('アクセストークンの形式が正しくありません');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * ユーザー作成入力の検証
 */
export function validateCreateUserInput(input: CreateUserInput): ValidationResult {
  const errors: string[] = [];

  // GitHub ID検証
  if (!input.githubId) {
    errors.push('GitHub IDが必要です');
  } else if (typeof input.githubId !== 'string') {
    errors.push('GitHub IDは文字列である必要があります');
  }

  // ユーザー名検証
  if (!input.username) {
    errors.push('ユーザー名が必要です');
  } else if (typeof input.username !== 'string') {
    errors.push('ユーザー名は文字列である必要があります');
  } else if (input.username.length < 1 || input.username.length > 39) {
    errors.push('ユーザー名の長さが不正です（1-39文字）');
  }

  // アクセストークン検証
  const tokenValidation = validateAccessToken(input.accessToken);
  if (!tokenValidation.isValid) {
    errors.push(...tokenValidation.errors);
  }

  // メール検証（オプショナル）
  if (input.email !== null && input.email !== undefined) {
    if (typeof input.email !== 'string') {
      errors.push('メールアドレスは文字列である必要があります');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      errors.push('メールアドレスの形式が正しくありません');
    }
  }

  // アバターURL検証（オプショナル）
  if (input.avatarUrl !== null && input.avatarUrl !== undefined) {
    if (typeof input.avatarUrl !== 'string') {
      errors.push('アバターURLは文字列である必要があります');
    } else if (!/^https?:\/\/.+/.test(input.avatarUrl)) {
      errors.push('アバターURLの形式が正しくありません');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * ユーザー更新入力の検証
 */
export function validateUpdateUserInput(input: UpdateUserInput): ValidationResult {
  const errors: string[] = [];

  // ユーザー名検証（オプショナル）
  if (input.username !== undefined) {
    if (typeof input.username !== 'string') {
      errors.push('ユーザー名は文字列である必要があります');
    } else if (input.username.length < 1 || input.username.length > 39) {
      errors.push('ユーザー名の長さが不正です（1-39文字）');
    }
  }

  // アクセストークン検証（オプショナル）
  if (input.accessToken !== undefined) {
    const tokenValidation = validateAccessToken(input.accessToken);
    if (!tokenValidation.isValid) {
      errors.push(...tokenValidation.errors);
    }
  }

  // メール検証（オプショナル）
  if (input.email !== undefined && input.email !== null) {
    if (typeof input.email !== 'string') {
      errors.push('メールアドレスは文字列である必要があります');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      errors.push('メールアドレスの形式が正しくありません');
    }
  }

  // アバターURL検証（オプショナル）
  if (input.avatarUrl !== undefined && input.avatarUrl !== null) {
    if (typeof input.avatarUrl !== 'string') {
      errors.push('アバターURLは文字列である必要があります');
    } else if (!/^https?:\/\/.+/.test(input.avatarUrl)) {
      errors.push('アバターURLの形式が正しくありません');
    }
  }

  // lastLoginAt検証（オプショナル）
  if (input.lastLoginAt !== undefined) {
    if (typeof input.lastLoginAt !== 'string') {
      errors.push('最終ログイン時刻は文字列である必要があります');
    } else if (isNaN(Date.parse(input.lastLoginAt))) {
      errors.push('最終ログイン時刻の形式が正しくありません（ISO 8601形式）');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * JWT ペイロードの検証
 */
export function validateJWTPayload(payload: any): ValidationResult {
  const errors: string[] = [];

  if (!payload) {
    errors.push('JWTペイロードが必要です');
    return { isValid: false, errors };
  }

  // sub (User ID) 検証
  if (!payload.sub) {
    errors.push('ユーザーIDが必要です');
  } else if (typeof payload.sub !== 'string') {
    errors.push('ユーザーIDは文字列である必要があります');
  }

  // githubId 検証
  if (!payload.githubId) {
    errors.push('GitHub IDが必要です');
  } else if (typeof payload.githubId !== 'string') {
    errors.push('GitHub IDは文字列である必要があります');
  }

  // username 検証
  if (!payload.username) {
    errors.push('ユーザー名が必要です');
  } else if (typeof payload.username !== 'string') {
    errors.push('ユーザー名は文字列である必要があります');
  }

  // iat (issued at) 検証
  if (payload.iat !== undefined) {
    if (typeof payload.iat !== 'number') {
      errors.push('発行時刻は数値である必要があります');
    } else if (payload.iat < 0) {
      errors.push('発行時刻は正の数である必要があります');
    }
  }

  // exp (expires at) 検証
  if (payload.exp !== undefined) {
    if (typeof payload.exp !== 'number') {
      errors.push('有効期限は数値である必要があります');
    } else if (payload.exp < 0) {
      errors.push('有効期限は正の数である必要があります');
    } else if (payload.iat !== undefined && payload.exp <= payload.iat) {
      errors.push('有効期限は発行時刻より後である必要があります');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * バリデーション結果をチェックし、エラーがあれば例外を投げる
 */
export function throwIfInvalid(result: ValidationResult): void {
  if (!result.isValid) {
    throw new ValidationError('バリデーションエラー', result.errors);
  }
}

/**
 * 複数のバリデーション結果をマージ
 */
export function mergeValidationResults(...results: ValidationResult[]): ValidationResult {
  const allErrors = results.flatMap(result => result.errors);
  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}