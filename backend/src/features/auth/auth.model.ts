/**
 * 認証関連データモデル
 * 
 * User エンティティとデータベース操作を定義
 * GitHub OAuth認証とJWT管理に対応
 */

import { ID, User, JWTPayload } from '../../types/index.js';

/**
 * データベース用User型（内部情報含む）
 */
export interface UserEntity extends User {
  accessToken: string;  // GitHub access token (暗号化保存)
  refreshToken?: string; // 将来の拡張用
}

/**
 * ユーザー作成時の入力型
 */
export interface CreateUserInput {
  githubId: string;
  username: string;
  email?: string | null;
  avatarUrl?: string | null;
  accessToken: string;
}

/**
 * ユーザー更新時の入力型
 */
export interface UpdateUserInput {
  username?: string;
  email?: string | null;
  avatarUrl?: string | null;
  accessToken?: string;
  lastLoginAt?: string;
}

/**
 * GitHub OAuthユーザー情報
 */
export interface GitHubUserInfo {
  id: string;           // GitHub user ID
  login: string;        // GitHub username
  email: string | null; // GitHub email
  avatar_url: string | null; // GitHub avatar URL
  name: string | null;  // GitHub display name
}

/**
 * OAuth認証結果
 */
export interface OAuthResult {
  user: User;
  accessToken: string;
  isNewUser: boolean;
}

/**
 * JWT生成オプション
 */
export interface JWTOptions {
  expiresIn?: string;
  audience?: string;
  issuer?: string;
}

/**
 * 認証セッション情報
 */
export interface AuthSession {
  user: User;
  token: string;
  expiresAt: Date;
}

/**
 * ユーザーリポジトリインターフェース
 * 
 * データアクセス層の抽象化
 * 将来的なデータベース切り替えに対応
 */
export interface UserRepository {
  /**
   * GitHub IDでユーザーを検索
   */
  findByGitHubId(githubId: string): Promise<UserEntity | null>;

  /**
   * ユーザーIDでユーザーを検索
   */
  findById(id: ID): Promise<UserEntity | null>;

  /**
   * 新規ユーザーを作成
   */
  create(input: CreateUserInput): Promise<UserEntity>;

  /**
   * ユーザー情報を更新
   */
  update(id: ID, input: UpdateUserInput): Promise<UserEntity>;

  /**
   * 最終ログイン時刻を更新
   */
  updateLastLogin(id: ID): Promise<void>;

  /**
   * ユーザーを削除（将来の機能）
   */
  delete(id: ID): Promise<void>;
}

/**
 * インメモリ User リポジトリ実装
 * 
 * 開発・テスト用の簡易実装
 * 本番では適切なデータベースに置き換える
 */
export class InMemoryUserRepository implements UserRepository {
  private users: Map<ID, UserEntity> = new Map();
  private githubIdIndex: Map<string, ID> = new Map();

  async findByGitHubId(githubId: string): Promise<UserEntity | null> {
    const userId = this.githubIdIndex.get(githubId);
    if (!userId) return null;
    return this.users.get(userId) || null;
  }

  async findById(id: ID): Promise<UserEntity | null> {
    return this.users.get(id) || null;
  }

  async create(input: CreateUserInput): Promise<UserEntity> {
    const id = this.generateId();
    const now = new Date().toISOString();
    
    const user: UserEntity = {
      id,
      githubId: input.githubId,
      username: input.username,
      email: input.email || null,
      avatarUrl: input.avatarUrl || null,
      accessToken: input.accessToken,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    };

    this.users.set(id, user);
    this.githubIdIndex.set(input.githubId, id);
    
    return user;
  }

  async update(id: ID, input: UpdateUserInput): Promise<UserEntity> {
    const existing = this.users.get(id);
    if (!existing) {
      throw new Error(`User not found: ${id}`);
    }

    const updated: UserEntity = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    this.users.set(id, updated);
    return updated;
  }

  async updateLastLogin(id: ID): Promise<void> {
    const existing = this.users.get(id);
    if (!existing) {
      throw new Error(`User not found: ${id}`);
    }

    existing.lastLoginAt = new Date().toISOString();
    existing.updatedAt = new Date().toISOString();
    this.users.set(id, existing);
  }

  async delete(id: ID): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      this.githubIdIndex.delete(user.githubId);
      this.users.delete(id);
    }
  }

  /**
   * 簡易ID生成（本番では UUID ライブラリを使用）
   */
  private generateId(): string {
    // UUID v4 形式に近い文字列を生成
    const part1 = Math.random().toString(16).substring(2, 10);
    const part2 = Math.random().toString(16).substring(2, 6);
    const part3 = Math.random().toString(16).substring(2, 6);
    const part4 = Math.random().toString(16).substring(2, 6);
    const part5 = Math.random().toString(16).substring(2, 14);
    
    return `${part1}-${part2}-${part3}-${part4}-${part5}`;
  }

  /**
   * テスト用：全データクリア
   */
  clear(): void {
    this.users.clear();
    this.githubIdIndex.clear();
  }

  /**
   * テスト用：全ユーザー数取得
   */
  size(): number {
    return this.users.size;
  }
}

/**
 * シングルトンリポジトリインスタンス
 */
export const userRepository = new InMemoryUserRepository();

/**
 * 公開用ユーザー情報への変換
 * 内部情報（accessToken等）を除外
 */
export function toPublicUser(userEntity: UserEntity): User {
  const { accessToken, refreshToken, ...publicUser } = userEntity;
  return publicUser;
}

/**
 * JWT ペイロードの生成
 */
export function createJWTPayload(user: User): Omit<JWTPayload, 'iat' | 'exp'> {
  return {
    sub: user.id,
    githubId: user.githubId,
    username: user.username,
  };
}

/**
 * GitHub API レスポンスからユーザー作成入力への変換
 */
export function mapGitHubUser(githubUser: GitHubUserInfo, accessToken: string): CreateUserInput {
  return {
    githubId: githubUser.id,
    username: githubUser.login,
    email: githubUser.email,
    avatarUrl: githubUser.avatar_url,
    accessToken,
  };
}