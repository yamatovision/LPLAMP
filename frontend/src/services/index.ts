// API サービス
import { authApiService } from './api/auth.service';
import { projectsApiService } from './api/projects.service';
import { replicaApiService } from './api/replica.service';
import { historyApiService } from './api/history.service';
import { elementApiService } from './api/element.service';
import { exportApiService } from './api/export.service';
import { fileApiService } from './api/file.service';
import { githubApiService } from './api/github.service';
import { deployApiService } from './api/deploy.service';

// 認証APIは実APIのみ使用（テスト通過済み）
export const authService = authApiService;

// プロジェクトAPIは実APIのみ使用（テスト通過済み）
export const projectsService = projectsApiService;

// レプリカAPIは実APIのみ使用（テスト通過済み）
export const replicaService = replicaApiService;

// 履歴管理APIは実APIのみ使用（テスト通過済み）
export const historyService = historyApiService;

// Element APIは実APIのみ使用（テスト通過済み）
export const elementService = elementApiService;

// Export APIは実APIのみ使用（テスト通過済み）
export const exportService = exportApiService;


// File APIは実APIのみ使用（テスト通過済み）
export const fileService = fileApiService;

// GitHub APIは実APIのみ使用（テスト通過済み）
export const githubService = githubApiService;

// デプロイメントAPIは実APIのみ使用（テスト通過済み）
export const deployService = deployApiService;