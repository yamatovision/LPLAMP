/**
 * ===== 型定義同期ガイドライン =====
 * 型ファイルは下記2つの同期された型ファイルが存在します。  
 *  - **フロントエンド**: `frontend/src/types/index.ts`
 *　 - **バックエンド**: `backend/src/types/index.ts`
 * 【基本原則】この/types/index.tsを更新したら、もう一方の/types/index.tsも必ず同じ内容に更新する
 * 
 * 【変更の責任】
 * - 型定義を変更した開発者は、両方のファイルを即座に同期させる責任を持つ
 * - 1つのtypes/index.tsの更新は禁止。必ず1つを更新したらもう一つも更新その場で行う
 * 
 * 【絶対に守るべき原則】
 * 1. フロントエンドとバックエンドで異なる型を作らない
 * 2. 同じデータ構造に対して複数の型を作らない
 * 3. 新しいプロパティは必ずオプショナルとして追加
 * 4. APIパスは必ずこのファイルで一元管理する
 * 5. コード内でAPIパスをハードコードしない
 * 6. 2つの同期されたtypes/index.tsを単一の真実源とする
 * 7. パスパラメータを含むエンドポイントは関数として提供する
 */

// ===== 基本型定義 =====

/**
 * 基本ID型
 */
export type ID = string;

/**
 * タイムスタンプ
 */
export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}

/**
 * ページネーション
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * API共通レスポンス
 */
export interface ApiResponse<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, any>;
}

/**
 * ページネーション付きレスポンス
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ===== プロジェクト関連 =====

/**
 * プロジェクト作成時の型
 */
export interface ProjectCreate {
  url: string;
  name?: string;
}

/**
 * プロジェクト基本情報
 */
export interface ProjectBase extends ProjectCreate {
  name: string;
  thumbnail?: string | null;
  githubRepo?: string | null;
  deploymentUrl?: string | null;
  userId?: ID;  // 認証実装で追加
}

/**
 * プロジェクト完全情報
 */
export interface Project extends ProjectBase, Timestamps {
  id: ID;
  status: ProjectStatus;
}

/**
 * プロジェクトステータス
 */
export enum ProjectStatus {
  CREATING = 'creating',
  READY = 'ready',
  ERROR = 'error'
}

/**
 * プロジェクト作成レスポンス
 */
export interface ProjectCreateResponse {
  projectId: ID;
  status: 'processing';
}

/**
 * プロジェクトステータスレスポンス
 */
export interface ProjectStatusResponse {
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

// ===== レプリカ関連 =====

/**
 * レプリカデータ
 */
export interface Replica extends Timestamps {
  id: ID;
  projectId: ID;
  html: string;
  css: string;
  assets: ReplicaAsset[];
}

/**
 * レプリカアセット
 */
export interface ReplicaAsset {
  id: ID;
  replicaId: ID;
  originalUrl: string;
  localPath: string;
  mimeType: string;
  size: number;
}

// ===== 要素選択・編集関連 =====

/**
 * 要素情報
 */
export interface ElementInfo {
  selector: string;
  tagName: string;
  text?: string;
  html?: string;
  styles?: ElementStyles;
}

/**
 * 要素スタイル
 */
export interface ElementStyles {
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontFamily?: string;
  [key: string]: string | undefined;
}

/**
 * 要素コンテキストリクエスト
 */
export interface ElementContextRequest {
  element: ElementInfo;
  projectId: ID;
}

/**
 * 要素コンテキストレスポンス
 */
export interface ElementContextResponse {
  contextId: ID;
  message: string;
}

/**
 * 編集バリエーション
 */
export interface EditVariation {
  id: ID;
  elementSelector: string;
  content: string;
  preview: string;
  selected?: boolean;
}

// ===== 履歴管理 =====

/**
 * 編集履歴
 */
export interface History extends Timestamps {
  id: ID;
  projectId: ID;
  description: string;
  snapshot: HistorySnapshot;
  type: HistoryType;
}

/**
 * 履歴タイプ
 */
export enum HistoryType {
  CREATE = 'create',
  EDIT = 'edit',
  AI_EDIT = 'ai_edit',
  REVERT = 'revert'
}

/**
 * 履歴スナップショット
 */
export interface HistorySnapshot {
  html: string;
  changedElements: ElementInfo[];
}

// ===== エクスポート関連 =====

/**
 * エクスポート準備リクエスト
 */
export interface ExportPrepareRequest {
  projectId: ID;
  format: ExportFormat;
  optimize: boolean;
}

/**
 * エクスポートフォーマット
 */
export enum ExportFormat {
  HTML = 'html',
  ZIP = 'zip'
}

/**
 * エクスポート準備レスポンス
 */
export interface ExportPrepareResponse {
  exportId: ID;
  files: FileInfo[];
}

/**
 * ファイル情報
 */
export interface FileInfo {
  path: string;
  size: number;
  mimeType: string;
}

/**
 * エクスポート履歴
 */
export interface Export extends Timestamps {
  id: ID;
  projectId: ID;
  format: ExportFormat;
  url: string;
}

// ===== GitHub連携 =====

/**
 * GitHub認証状態
 */
export interface GitHubAuthStatus {
  authenticated: boolean;
  username?: string;
}

/**
 * GitHubリポジトリ
 */
export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
}

/**
 * GitHubプッシュリクエスト
 */
export interface GitHubPushRequest {
  exportId: ID;
  repo: string;
  branch: string;
  message: string;
}

/**
 * GitHubプッシュレスポンス
 */
export interface GitHubPushResponse {
  commitHash: string;
  success: boolean;
}

// ===== 認証関連 =====

/**
 * ユーザー情報
 */
export interface User extends Timestamps {
  id: ID;
  githubId: string;
  username: string;
  email?: string | null;
  avatarUrl?: string | null;
  lastLoginAt: string;
}

/**
 * 認証済みユーザー（必須プロパティのみ）
 */
export interface AuthenticatedUser {
  id: string;
  githubId: string;
  username: string;
}

/**
 * Express Request型拡張
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * 認証状態レスポンス
 */
export interface AuthStatusResponse {
  authenticated: boolean;
  user?: User;
}

/**
 * ログインレスポンス
 */
export interface LoginResponse {
  redirectUrl: string;
}

/**
 * JWT ペイロード
 */
export interface JWTPayload {
  sub: string;        // User ID
  githubId: string;   // GitHub ID
  username: string;   // GitHub username
  iat: number;        // 発行時刻
  exp: number;        // 有効期限
}

// ===== デプロイメント関連 =====

/**
 * デプロイプロバイダー
 */
export enum DeployProvider {
  GITHUB_PAGES = 'github-pages',
  VERCEL = 'vercel',
  NETLIFY = 'netlify'
}

/**
 * デプロイリクエスト
 */
export interface DeployRequest {
  repo: string;
  provider: DeployProvider;
  customDomain?: string;
}

/**
 * デプロイレスポンス
 */
export interface DeployResponse {
  deploymentId: ID;
  status: DeploymentStatus;
}

/**
 * デプロイメントステータス
 */
export enum DeploymentStatus {
  PENDING = 'pending',
  BUILDING = 'building',
  READY = 'ready',
  ERROR = 'error'
}

/**
 * デプロイメント詳細
 */
export interface DeploymentDetail {
  id: ID;
  projectId: ID;
  provider: DeployProvider;
  status: DeploymentStatus;
  url?: string;
  customDomain?: string;
  logs?: string[];
  deployedAt?: string;
}

// ===== ClaudeCode連携 =====

/**
 * ターミナルメッセージタイプ
 */
export enum TerminalMessageType {
  INPUT = 'input',
  OUTPUT = 'output',
  ERROR = 'error',
  SYSTEM = 'system'
}

/**
 * ターミナルメッセージ
 */
export interface TerminalMessage {
  type: TerminalMessageType;
  data: string;
  timestamp?: string;
}

/**
 * 編集セッション
 */
export interface EditSession extends Timestamps {
  id: ID;
  projectId: ID;
  elementContext?: ElementInfo;
  messages: TerminalMessage[];
  status: EditSessionStatus;
}

/**
 * 編集セッションステータス
 */
export enum EditSessionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// ===== プロジェクトファイル管理 =====

/**
 * プロジェクトファイル情報
 */
export interface ProjectFile {
  path: string;
  content: string;
  size: number;
  mimeType: string;
  lastModified: string;
}

/**
 * プロジェクトファイル取得レスポンス
 */
export interface ProjectFileResponse {
  file: ProjectFile;
  exists: boolean;
}

/**
 * プロジェクトファイル更新リクエスト
 */
export interface ProjectFileUpdateRequest {
  content: string;
  encoding?: 'utf8' | 'base64';
}

/**
 * プロジェクトファイル更新レスポンス
 */
export interface ProjectFileUpdateResponse {
  success: boolean;
  file: ProjectFile;
}

/**
 * プロジェクトディレクトリ構造
 */
export interface ProjectDirectory {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: ProjectDirectory[] | undefined;
  size?: number | undefined;
}

// ===== APIパス定義 =====

// ===== 認証設定 =====

/**
 * 認証不要のエンドポイント
 */
export const PUBLIC_ENDPOINTS = [
  '/api/auth/status',
  '/api/auth/github/login',
  '/api/auth/github/callback',
  '/api/health',
];

export const API_PATHS = {
  // プロジェクト関連
  PROJECTS: {
    BASE: '/api/projects',
    CREATE: '/api/projects/create',
    DETAIL: (projectId: string) => `/api/projects/${projectId}`,
    UPDATE: (projectId: string) => `/api/projects/${projectId}`,
    STATUS: (projectId: string) => `/api/projects/${projectId}/status`,
    DELETE: (projectId: string) => `/api/projects/${projectId}`,
  },

  // レプリカ関連
  REPLICA: {
    GET: (projectId: string) => `/api/projects/${projectId}/replica`,
    UPDATE: (projectId: string) => `/api/projects/${projectId}/replica`,
    ASSETS: (projectId: string) => `/api/projects/${projectId}/replica/assets`,
  },

  // 要素編集関連
  ELEMENT: {
    CONTEXT: '/api/element/context',
    VARIATIONS: (projectId: string) => `/api/projects/${projectId}/variations`,
  },

  // 履歴関連
  HISTORY: {
    LIST: (projectId: string) => `/api/projects/${projectId}/history`,
    DETAIL: (projectId: string, historyId: string) => `/api/projects/${projectId}/history/${historyId}`,
    RESTORE: (projectId: string, historyId: string) => `/api/projects/${projectId}/history/${historyId}/restore`,
  },

  // エクスポート関連
  EXPORT: {
    PREPARE: '/api/export/prepare',
    DOWNLOAD: (exportId: string) => `/api/export/${exportId}/download`,
    LIST: (projectId: string) => `/api/projects/${projectId}/exports`,
  },

  // 認証関連
  AUTH: {
    STATUS: '/api/auth/status',
    GITHUB_LOGIN: '/api/auth/github/login',
    GITHUB_CALLBACK: '/api/auth/github/callback',
    LOGOUT: '/api/auth/logout',
    ME: '/api/auth/me',
  },

  // GitHub関連
  GITHUB: {
    AUTH_STATUS: '/api/github/auth/status',
    REPOS: '/api/github/repos',
    REPOS_CREATE: '/api/github/repos/create',
    PUSH: '/api/github/push',
  },

  // デプロイメント関連
  DEPLOY: {
    TRIGGER: '/api/deploy/trigger',
    STATUS: (deploymentId: string) => `/api/deploy/${deploymentId}/status`,
    LIST: (projectId: string) => `/api/projects/${projectId}/deployments`,
  },

  // WebSocket
  WEBSOCKET: {
    TERMINAL: '/ws/terminal',
  },

  // プロジェクトファイル管理
  PROJECT_FILES: {
    GET: (projectId: string, filePath: string) => `/api/projects/${projectId}/files/${encodeURIComponent(filePath)}`,
    UPDATE: (projectId: string, filePath: string) => `/api/projects/${projectId}/files/${encodeURIComponent(filePath)}`,
    LIST: (projectId: string) => `/api/projects/${projectId}/files`,
  },
};

// ===== バリデーション定数 =====

export const VALIDATION = {
  PROJECT: {
    NAME: {
      MIN_LENGTH: 1,
      MAX_LENGTH: 100,
    },
    URL: {
      PATTERN: /^https?:\/\/.+/,
    },
  },
  EXPORT: {
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  },
  GITHUB: {
    COMMIT_MESSAGE: {
      MAX_LENGTH: 500,
    },
  },
};