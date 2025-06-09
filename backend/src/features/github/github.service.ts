/**
 * GitHub連携のビジネスロジック層
 * 認証・リポジトリ管理・ファイル操作を統合的に処理
 */

import { GitHubRepository, GitHubAuthRepository } from './github.model';
import { validateGitHubToken, SecurityUtils } from './github.validator';
import { logger } from '../../common/utils/logger';
import type { 
  GitHubRepository as IGitHubRepository, 
  GitHubAuthStatus, 
  GitHubAuthStatusData,
  GitHubPushRequest, 
  GitHubPushResponse,
  ApiResponse
} from '../../types/index';
import fs from 'fs/promises';
import path from 'path';

/**
 * GitHub連携サービス
 * 実際のGitHub APIと連携し、リポジトリ操作を行う
 */
export class GitHubService {

  /**
   * 認証状態の確認
   */
  static async getAuthStatus(userId: string): Promise<GitHubAuthStatus> {
    const startTime = Date.now();
    
    try {
      logger.info('GitHub 認証状態確認開始', {
        component: 'GitHubService',
        operation: 'getAuthStatus',
        userId
      });

      const authStatus = await GitHubAuthRepository.getAuthStatus(userId);
      
      const duration = Date.now() - startTime;
      logger.info('GitHub 認証状態確認完了', {
        component: 'GitHubService',
        operation: 'getAuthStatus',
        userId,
        authenticated: authStatus.data?.authenticated,
        duration: `${duration}ms`
      });

      return authStatus;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('GitHub 認証状態確認エラー', {
        component: 'GitHubService',
        operation: 'getAuthStatus',
        userId,
        error: error.message,
        duration: `${duration}ms`
      });
      
      throw new Error('認証状態の確認に失敗しました');
    }
  }

  /**
   * アクセストークンを設定して認証を確立
   */
  static async setAuthToken(userId: string, accessToken: string): Promise<GitHubAuthStatus> {
    const startTime = Date.now();
    
    try {
      logger.info('GitHub 認証トークン設定開始', {
        component: 'GitHubService',
        operation: 'setAuthToken',
        userId,
        tokenMask: SecurityUtils.maskToken(accessToken)
      });

      // トークンの形式バリデーション
      if (!validateGitHubToken(accessToken)) {
        throw new Error('無効なGitHubトークン形式です');
      }

      // GitHubクライアントを作成してユーザー情報を取得
      const githubRepo = new GitHubRepository(accessToken);
      const userInfo = await githubRepo.getAuthenticatedUser();

      // 認証情報を保存
      await GitHubAuthRepository.setAuthInfo(userId, {
        accessToken,
        username: userInfo.username,
        userId
      });

      const authStatus: ApiResponse<GitHubAuthStatusData> = {
        success: true,
        data: {
          authenticated: true,
          username: userInfo.username
        }
      };

      const duration = Date.now() - startTime;
      logger.info('GitHub 認証トークン設定完了', {
        component: 'GitHubService',
        operation: 'setAuthToken',
        userId,
        username: userInfo.username,
        duration: `${duration}ms`
      });

      return authStatus;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('GitHub 認証トークン設定エラー', {
        component: 'GitHubService',
        operation: 'setAuthToken',
        userId,
        error: error.message,
        duration: `${duration}ms`
      });
      
      // 詳細なエラーメッセージを提供
      if (error.message.includes('Bad credentials')) {
        throw new Error('無効なアクセストークンです');
      } else if (error.message.includes('rate limit')) {
        throw new Error('GitHub APIのレート制限に達しました。しばらく待ってから再試行してください');
      }
      
      throw new Error(`認証の設定に失敗しました: ${error.message}`);
    }
  }

  /**
   * 認証解除
   */
  static async removeAuth(userId: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('GitHub 認証解除開始', {
        component: 'GitHubService',
        operation: 'removeAuth',
        userId
      });

      await GitHubAuthRepository.removeAuthInfo(userId);

      const duration = Date.now() - startTime;
      logger.info('GitHub 認証解除完了', {
        component: 'GitHubService',
        operation: 'removeAuth',
        userId,
        duration: `${duration}ms`
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('GitHub 認証解除エラー', {
        component: 'GitHubService',
        operation: 'removeAuth',
        userId,
        error: error.message,
        duration: `${duration}ms`
      });
      
      throw new Error('認証解除に失敗しました');
    }
  }

  /**
   * ユーザーのリポジトリ一覧を取得
   */
  static async getRepositories(userId: string): Promise<IGitHubRepository[]> {
    const startTime = Date.now();
    
    try {
      logger.info('GitHub リポジトリ一覧取得開始', {
        component: 'GitHubService',
        operation: 'getRepositories',
        userId
      });

      const authInfo = await GitHubAuthRepository.getAuthInfo(userId);
      if (!authInfo) {
        // 認証が必要というエラーは401エラーとして扱われるべき
        const error = new Error('GitHub認証が必要です');
        (error as any).statusCode = 401;
        throw error;
      }

      const githubRepo = new GitHubRepository(authInfo.accessToken);
      const repositories = await githubRepo.getUserRepositories();

      const duration = Date.now() - startTime;
      logger.info('GitHub リポジトリ一覧取得完了', {
        component: 'GitHubService',
        operation: 'getRepositories',
        userId,
        repositoryCount: repositories.length,
        duration: `${duration}ms`
      });

      return repositories;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('GitHub リポジトリ一覧取得エラー', {
        component: 'GitHubService',
        operation: 'getRepositories',
        userId,
        error: error.message,
        duration: `${duration}ms`
      });
      
      if (error.message.includes('GitHub認証が必要')) {
        throw error;
      }
      
      throw new Error(`リポジトリ一覧の取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * 新しいリポジトリを作成
   */
  static async createRepository(
    userId: string, 
    name: string, 
    description?: string, 
    isPrivate: boolean = false
  ): Promise<IGitHubRepository> {
    const startTime = Date.now();
    
    try {
      logger.info('GitHub リポジトリ作成開始', {
        component: 'GitHubService',
        operation: 'createRepository',
        userId,
        repositoryName: name,
        isPrivate
      });

      const authInfo = await GitHubAuthRepository.getAuthInfo(userId);
      if (!authInfo) {
        // 認証が必要というエラーは401エラーとして扱われるべき
        const error = new Error('GitHub認証が必要です');
        (error as any).statusCode = 401;
        throw error;
      }

      const githubRepo = new GitHubRepository(authInfo.accessToken);
      const repository = await githubRepo.createRepository(name, description, isPrivate);

      const duration = Date.now() - startTime;
      logger.info('GitHub リポジトリ作成完了', {
        component: 'GitHubService',
        operation: 'createRepository',
        userId,
        repositoryName: name,
        repositoryId: repository.id,
        duration: `${duration}ms`
      });

      return repository;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('GitHub リポジトリ作成エラー', {
        component: 'GitHubService',
        operation: 'createRepository',
        userId,
        repositoryName: name,
        error: error.message,
        duration: `${duration}ms`
      });
      
      if (error.message.includes('name already exists')) {
        throw new Error('同名のリポジトリが既に存在します');
      } else if (error.message.includes('GitHub認証が必要')) {
        throw error;
      }
      
      throw new Error(`リポジトリの作成に失敗しました: ${error.message}`);
    }
  }

  /**
   * ファイルをGitHubリポジトリにプッシュ
   */
  static async pushFiles(userId: string, pushRequest: GitHubPushRequest): Promise<GitHubPushResponse> {
    const startTime = Date.now();
    
    try {
      logger.info('GitHub ファイルプッシュ開始', {
        component: 'GitHubService',
        operation: 'pushFiles',
        userId,
        exportId: pushRequest.exportId,
        repo: pushRequest.repo,
        branch: pushRequest.branch
      });

      const authInfo = await GitHubAuthRepository.getAuthInfo(userId);
      if (!authInfo) {
        // 認証が必要というエラーは401エラーとして扱われるべき
        const error = new Error('GitHub認証が必要です');
        (error as any).statusCode = 401;
        throw error;
      }

      // エクスポートファイルの存在確認
      const exportDir = process.env['TEMP_DIR'] || '/tmp';
      const exportPath = path.join(exportDir, 'exports', pushRequest.exportId);
      
      try {
        await fs.access(exportPath);
      } catch {
        throw new Error('エクスポートファイルが見つかりません');
      }

      const githubRepo = new GitHubRepository(authInfo.accessToken);
      const repoParts = pushRequest.repo.split('/');
      if (repoParts.length !== 2) {
        throw new Error('リポジトリ形式が不正です（owner/repo形式で指定してください）');
      }
      const [owner, repoName] = repoParts;
      if (!owner || !repoName) {
        throw new Error('リポジトリのオーナーまたは名前が指定されていません');
      }

      // リポジトリの存在確認
      try {
        await githubRepo.getRepository(owner, repoName);
      } catch (error: any) {
        if (error.message.includes('404')) {
          throw new Error('指定されたリポジトリが見つかりません');
        }
        throw error;
      }

      // ファイル一覧を取得してプッシュ
      const files = await this.getExportFiles(exportPath);
      const commitPromises: Promise<string>[] = [];

      for (const file of files) {
        const fileContent = await fs.readFile(file.fullPath);
        const base64Content = fileContent.toString('base64');
        
        const commitPromise = githubRepo.commitFile(
          owner,
          repoName,
          file.relativePath,
          base64Content,
          pushRequest.message,
          pushRequest.branch || 'main'
        );
        
        commitPromises.push(commitPromise);
      }

      // 全ファイルのコミットを並列実行
      const commitShas = await Promise.all(commitPromises);
      const latestCommitSha = commitShas[commitShas.length - 1] || ''; // 最後のコミットSHAを使用

      const duration = Date.now() - startTime;
      logger.info('GitHub ファイルプッシュ完了', {
        component: 'GitHubService',
        operation: 'pushFiles',
        userId,
        exportId: pushRequest.exportId,
        repo: pushRequest.repo,
        branch: pushRequest.branch,
        fileCount: files.length,
        commitSha: latestCommitSha,
        duration: `${duration}ms`
      });

      return {
        commitHash: latestCommitSha,
        success: true
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('GitHub ファイルプッシュエラー', {
        component: 'GitHubService',
        operation: 'pushFiles',
        userId,
        exportId: pushRequest.exportId,
        error: error.message,
        duration: `${duration}ms`
      });
      
      if (error.message.includes('GitHub認証が必要') ||
          error.message.includes('エクスポートファイルが見つかりません') ||
          error.message.includes('リポジトリが見つかりません')) {
        throw error;
      }
      
      throw new Error(`ファイルのプッシュに失敗しました: ${error.message}`);
    }
  }

  /**
   * エクスポートディレクトリからファイル一覧を取得
   */
  private static async getExportFiles(exportPath: string): Promise<Array<{ relativePath: string; fullPath: string }>> {
    const files: Array<{ relativePath: string; fullPath: string }> = [];
    
    const collectFiles = async (dirPath: string, relativePath: string = ''): Promise<void> => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;
        
        if (entry.isDirectory()) {
          await collectFiles(fullPath, entryRelativePath);
        } else if (entry.isFile()) {
          // 不要なファイルをスキップ
          if (!this.shouldSkipFile(entry.name)) {
            files.push({
              relativePath: entryRelativePath.replace(/\\/g, '/'), // Windows対応
              fullPath
            });
          }
        }
      }
    };
    
    await collectFiles(exportPath);
    return files;
  }

  /**
   * プッシュ時にスキップすべきファイルかどうかを判定
   */
  private static shouldSkipFile(fileName: string): boolean {
    const skipPatterns = [
      /\.DS_Store$/,           // macOS システムファイル
      /Thumbs\.db$/,           // Windows サムネイルファイル
      /\.git$/,                // Gitディレクトリ
      /node_modules$/,         // Node.js dependencies
      /\.env$/,                // 環境変数ファイル
      /\.log$/,                // ログファイル
      /\.tmp$/,                // 一時ファイル
      /^\..*\.swp$/,           // Vim スワップファイル
    ];
    
    return skipPatterns.some(pattern => pattern.test(fileName));
  }

  /**
   * GitHub認証の開始（OAuth URLの生成）
   */
  static async initiateAuth(scopes: string[] = ['repo']): Promise<{ authUrl: string }> {
    const startTime = Date.now();
    
    try {
      logger.info('GitHub 認証開始URL生成開始', {
        component: 'GitHubService',
        operation: 'initiateAuth',
        scopes
      });

      const clientId = process.env['GITHUB_CLIENT_ID'];
      const callbackUrl = process.env['GITHUB_CALLBACK_URL'] || 'http://localhost:8080/api/auth/github/callback';
      
      if (!clientId) {
        throw new Error('GitHub Client IDが設定されていません');
      }

      const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const scopeString = scopes.join(' ');
      
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl,
        scope: scopeString,
        state: state,
      });

      const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

      const duration = Date.now() - startTime;
      logger.info('GitHub 認証開始URL生成完了', {
        component: 'GitHubService',
        operation: 'initiateAuth',
        scopes,
        duration: `${duration}ms`
      });

      return { authUrl };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('GitHub 認証開始URL生成エラー', {
        component: 'GitHubService',
        operation: 'initiateAuth',
        error: error.message,
        duration: `${duration}ms`
      });
      
      throw new Error(`認証開始の準備に失敗しました: ${error.message}`);
    }
  }

  /**
   * リポジトリのブランチ一覧取得
   */
  static async getBranches(userId: string, owner: string, repo: string): Promise<Array<{ name: string; sha: string; protected: boolean }>> {
    const startTime = Date.now();
    
    try {
      logger.info('GitHub ブランチ一覧取得開始', {
        component: 'GitHubService',
        operation: 'getBranches',
        userId,
        owner,
        repo
      });

      const authInfo = await GitHubAuthRepository.getAuthInfo(userId);
      if (!authInfo) {
        const error = new Error('GitHub認証が必要です');
        (error as any).statusCode = 401;
        throw error;
      }

      const githubRepo = new GitHubRepository(authInfo.accessToken);
      const branches = await githubRepo.getBranches(owner, repo);

      const duration = Date.now() - startTime;
      logger.info('GitHub ブランチ一覧取得完了', {
        component: 'GitHubService',
        operation: 'getBranches',
        userId,
        owner,
        repo,
        branchCount: branches.length,
        duration: `${duration}ms`
      });

      return branches.map(name => ({ name, sha: '', protected: false }));
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('GitHub ブランチ一覧取得エラー', {
        component: 'GitHubService',
        operation: 'getBranches',
        userId,
        owner,
        repo,
        error: error.message,
        duration: `${duration}ms`
      });
      
      if (error.message.includes('GitHub認証が必要')) {
        throw error;
      }
      
      throw new Error(`ブランチ一覧の取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * 認証済みユーザーの情報を取得
   */
  static async getUserInfo(userId: string): Promise<{ username: string; email?: string }> {
    const startTime = Date.now();
    
    try {
      logger.info('GitHub ユーザー情報取得開始', {
        component: 'GitHubService',
        operation: 'getUserInfo',
        userId
      });

      const authInfo = await GitHubAuthRepository.getAuthInfo(userId);
      if (!authInfo) {
        // 認証が必要というエラーは401エラーとして扱われるべき
        const error = new Error('GitHub認証が必要です');
        (error as any).statusCode = 401;
        throw error;
      }

      const githubRepo = new GitHubRepository(authInfo.accessToken);
      const userInfo = await githubRepo.getAuthenticatedUser();

      const duration = Date.now() - startTime;
      logger.info('GitHub ユーザー情報取得完了', {
        component: 'GitHubService',
        operation: 'getUserInfo',
        userId,
        username: userInfo.username,
        duration: `${duration}ms`
      });

      return userInfo;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('GitHub ユーザー情報取得エラー', {
        component: 'GitHubService',
        operation: 'getUserInfo',
        userId,
        error: error.message,
        duration: `${duration}ms`
      });
      
      if (error.message.includes('GitHub認証が必要')) {
        throw error;
      }
      
      throw new Error(`ユーザー情報の取得に失敗しました: ${error.message}`);
    }
  }
}