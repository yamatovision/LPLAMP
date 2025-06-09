/**
 * GitHubリポジトリ管理とOAuth認証のデータモデル
 * 外部GitHub APIを活用し、実際のリポジトリ操作を行う
 */

import { Octokit } from '@octokit/rest';
import { logger } from '../../common/utils/logger';
import type { GitHubRepository as GitHubRepositoryInterface, GitHubAuthStatus } from '../../types/index';
import { GitHubAuthModel } from '../../models/GitHubAuth';

/**
 * GitHub API認証情報の管理
 */
export interface GitHubAuthInfo {
  accessToken: string;
  username: string;
  userId: string;
}

/**
 * GitHubリポジトリリポジトリ層
 * 実際のGitHub APIを使用してリポジトリ操作を行う
 */
export class GitHubRepository {
  private octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({
      auth: accessToken,
    });
    
    logger.info('GitHub API クライアント初期化完了', {
      component: 'GitHubRepository',
      hasToken: !!accessToken
    });
  }

  /**
   * 認証済みユーザーのリポジトリ一覧を取得
   */
  async getUserRepositories(): Promise<GitHubRepositoryInterface[]> {
    const startTime = Date.now();
    
    try {
      logger.info('GitHub リポジトリ一覧取得開始', {
        component: 'GitHubRepository',
        operation: 'getUserRepositories'
      });

      const response = await this.octokit.rest.repos.listForAuthenticatedUser({
        sort: 'updated',
        direction: 'desc',
        per_page: 100, // 最大100件まで取得
        type: 'all' // public, private両方
      });

      const repositories = response.data.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        defaultBranch: repo.default_branch,
        htmlUrl: repo.html_url
      }));

      const duration = Date.now() - startTime;
      logger.info('GitHub リポジトリ一覧取得完了', {
        component: 'GitHubRepository',
        operation: 'getUserRepositories',
        repositoryCount: repositories.length,
        duration: `${duration}ms`
      });

      return repositories;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('GitHub リポジトリ一覧取得エラー', {
        component: 'GitHubRepository',
        operation: 'getUserRepositories',
        error: error.message,
        status: error.status,
        duration: `${duration}ms`
      });
      
      throw new Error(`リポジトリ一覧の取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * 新しいリポジトリを作成
   */
  async createRepository(name: string, description?: string, isPrivate: boolean = false): Promise<GitHubRepositoryInterface> {
    const startTime = Date.now();
    
    try {
      logger.info('GitHub リポジトリ作成開始', {
        component: 'GitHubRepository',
        operation: 'createRepository',
        repositoryName: name,
        isPrivate
      });

      const response = await this.octokit.rest.repos.createForAuthenticatedUser({
        name,
        description: description || `LPlamp project: ${name}`,
        private: isPrivate,
        auto_init: true, // READMEファイルを自動作成
      });

      const repository = {
        id: response.data.id,
        name: response.data.name,
        fullName: response.data.full_name,
        private: response.data.private,
        defaultBranch: response.data.default_branch,
        htmlUrl: response.data.html_url
      };

      const duration = Date.now() - startTime;
      logger.info('GitHub リポジトリ作成完了', {
        component: 'GitHubRepository',
        operation: 'createRepository',
        repositoryName: name,
        repositoryId: repository.id,
        duration: `${duration}ms`
      });

      return repository;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('GitHub リポジトリ作成エラー', {
        component: 'GitHubRepository',
        operation: 'createRepository',
        repositoryName: name,
        error: error.message,
        status: error.status,
        duration: `${duration}ms`
      });
      
      throw new Error(`リポジトリの作成に失敗しました: ${error.message}`);
    }
  }

  /**
   * リポジトリの詳細情報を取得
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepositoryInterface> {
    const startTime = Date.now();
    
    try {
      logger.info('GitHub リポジトリ詳細取得開始', {
        component: 'GitHubRepository',
        operation: 'getRepository',
        owner,
        repo
      });

      const response = await this.octokit.rest.repos.get({
        owner,
        repo
      });

      const repository = {
        id: response.data.id,
        name: response.data.name,
        fullName: response.data.full_name,
        private: response.data.private,
        defaultBranch: response.data.default_branch,
        htmlUrl: response.data.html_url
      };

      const duration = Date.now() - startTime;
      logger.info('GitHub リポジトリ詳細取得完了', {
        component: 'GitHubRepository',
        operation: 'getRepository',
        owner,
        repo,
        duration: `${duration}ms`
      });

      return repository;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('GitHub リポジトリ詳細取得エラー', {
        component: 'GitHubRepository',
        operation: 'getRepository',
        owner,
        repo,
        error: error.message,
        status: error.status,
        duration: `${duration}ms`
      });
      
      throw new Error(`リポジトリの詳細取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * ファイルをリポジトリにコミット
   * @param owner リポジトリオーナー
   * @param repo リポジトリ名
   * @param path ファイルパス
   * @param content ファイル内容（Base64エンコード済み）
   * @param message コミットメッセージ
   * @param branch ブランチ名
   */
  async commitFile(
    owner: string, 
    repo: string, 
    path: string, 
    content: string, 
    message: string,
    branch: string = 'main'
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      logger.info('GitHub ファイルコミット開始', {
        component: 'GitHubRepository',
        operation: 'commitFile',
        owner,
        repo,
        path,
        branch,
        contentSize: content.length
      });

      // 既存ファイルの確認
      let sha: string | undefined;
      try {
        const existingFile = await this.octokit.rest.repos.getContent({
          owner,
          repo,
          path,
          ref: branch
        });
        
        if ('sha' in existingFile.data) {
          sha = existingFile.data.sha;
          logger.info('既存ファイルを更新', {
            component: 'GitHubRepository',
            path,
            existingSha: sha
          });
        }
      } catch (error: any) {
        if (error.status === 404) {
          logger.info('新規ファイルを作成', {
            component: 'GitHubRepository',
            path
          });
        } else {
          throw error;
        }
      }

      // ファイルの作成または更新
      const updateData: {
        owner: string;
        repo: string;
        path: string;
        message: string;
        content: string;
        branch: string;
        sha?: string;
      } = {
        owner,
        repo,
        path,
        message,
        content,
        branch
      };

      if (sha) {
        updateData.sha = sha;
      }

      const response = await this.octokit.rest.repos.createOrUpdateFileContents(updateData);

      const commitSha = response.data.commit.sha ?? '';
      const duration = Date.now() - startTime;
      
      logger.info('GitHub ファイルコミット完了', {
        component: 'GitHubRepository',
        operation: 'commitFile',
        owner,
        repo,
        path,
        branch,
        commitSha,
        duration: `${duration}ms`
      });

      return commitSha;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('GitHub ファイルコミットエラー', {
        component: 'GitHubRepository',
        operation: 'commitFile',
        owner,
        repo,
        path,
        branch,
        error: error.message,
        status: error.status,
        duration: `${duration}ms`
      });
      
      throw new Error(`ファイルのコミットに失敗しました: ${error.message}`);
    }
  }

  /**
   * 認証状態の確認
   */
  async getAuthenticatedUser(): Promise<{ username: string; email?: string }> {
    const startTime = Date.now();
    
    try {
      logger.info('GitHub 認証ユーザー情報取得開始', {
        component: 'GitHubRepository',
        operation: 'getAuthenticatedUser'
      });

      const response = await this.octokit.rest.users.getAuthenticated();
      
      const userInfo: { username: string; email?: string } = {
        username: response.data.login
      };
      
      if (response.data.email) {
        userInfo.email = response.data.email;
      }

      const duration = Date.now() - startTime;
      logger.info('GitHub 認証ユーザー情報取得完了', {
        component: 'GitHubRepository',
        operation: 'getAuthenticatedUser',
        username: userInfo.username,
        duration: `${duration}ms`
      });

      return userInfo;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('GitHub 認証ユーザー情報取得エラー', {
        component: 'GitHubRepository',
        operation: 'getAuthenticatedUser',
        error: error.message,
        status: error.status,
        duration: `${duration}ms`
      });
      
      throw new Error(`認証ユーザー情報の取得に失敗しました: ${error.message}`);
    }
  }
}

/**
 * GitHub認証状態管理（PostgreSQL + Sequelize）
 * 永続化層を使用した本格的な認証情報管理
 */
export class GitHubAuthRepository {
  /**
   * 認証情報を保存
   */
  static async setAuthInfo(userId: string, authInfo: GitHubAuthInfo): Promise<void> {
    try {
      logger.info('GitHub 認証情報保存開始', {
        component: 'GitHubAuthRepository',
        operation: 'setAuthInfo',
        userId,
        username: authInfo.username
      });

      // 既存の認証情報があれば更新、なければ新規作成
      const [, created] = await GitHubAuthModel.upsert({
        userId,
        accessToken: authInfo.accessToken,
        tokenType: 'bearer',
        scope: 'repo',
        username: authInfo.username,
        isActive: true,
        lastUsedAt: new Date()
      });

      logger.info('GitHub 認証情報保存完了', {
        component: 'GitHubAuthRepository',
        operation: 'setAuthInfo',
        userId,
        username: authInfo.username,
        created
      });
    } catch (error: any) {
      logger.error('GitHub 認証情報保存エラー', {
        component: 'GitHubAuthRepository',
        operation: 'setAuthInfo',
        userId,
        error: error.message
      });
      throw new Error(`GitHub認証情報の保存に失敗しました: ${error.message}`);
    }
  }

  /**
   * 認証情報を取得
   */
  static async getAuthInfo(userId: string): Promise<GitHubAuthInfo | null> {
    try {
      logger.info('GitHub 認証情報取得開始', {
        component: 'GitHubAuthRepository',
        operation: 'getAuthInfo',
        userId
      });

      const githubAuth = await GitHubAuthModel.findOne({
        where: {
          userId,
          isActive: true
        }
      });

      if (!githubAuth) {
        logger.info('GitHub 認証情報が見つかりません', {
          component: 'GitHubAuthRepository',
          operation: 'getAuthInfo',
          userId,
          found: false
        });
        return null;
      }

      // 最終使用日時を更新
      await githubAuth.update({ lastUsedAt: new Date() });

      const authInfo: GitHubAuthInfo = {
        accessToken: githubAuth.accessToken,
        username: githubAuth.username,
        userId: githubAuth.userId
      };

      logger.info('GitHub 認証情報取得完了', {
        component: 'GitHubAuthRepository',
        operation: 'getAuthInfo',
        userId,
        found: true,
        username: githubAuth.username
      });

      return authInfo;
    } catch (error: any) {
      logger.error('GitHub 認証情報取得エラー', {
        component: 'GitHubAuthRepository',
        operation: 'getAuthInfo',
        userId,
        error: error.message
      });
      
      // データベース関連のエラーの場合は認証なしとして扱う（テスト環境等で起こりうる）
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        logger.warn('データベーステーブルが存在しません - 認証なしとして処理', {
          component: 'GitHubAuthRepository',
          operation: 'getAuthInfo',
          userId,
          error: error.message
        });
        return null;
      }
      
      // その他のエラーは通常通り投げる
      throw new Error(`GitHub認証情報の取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * 認証情報を削除
   */
  static async removeAuthInfo(userId: string): Promise<void> {
    try {
      logger.info('GitHub 認証情報削除開始', {
        component: 'GitHubAuthRepository',
        operation: 'removeAuthInfo',
        userId
      });

      const result = await GitHubAuthModel.update(
        { isActive: false },
        {
          where: {
            userId,
            isActive: true
          }
        }
      );

      const removed = result[0] > 0;

      logger.info('GitHub 認証情報削除完了', {
        component: 'GitHubAuthRepository',
        operation: 'removeAuthInfo',
        userId,
        removed
      });
    } catch (error: any) {
      logger.error('GitHub 認証情報削除エラー', {
        component: 'GitHubAuthRepository',
        operation: 'removeAuthInfo',
        userId,
        error: error.message
      });
      throw new Error(`GitHub認証情報の削除に失敗しました: ${error.message}`);
    }
  }

  /**
   * 認証状態の確認
   */
  static async getAuthStatus(userId: string): Promise<GitHubAuthStatus> {
    try {
      const authInfo = await this.getAuthInfo(userId);
      
      const status: GitHubAuthStatus = {
        authenticated: !!authInfo
      };
      
      if (authInfo?.username) {
        status.username = authInfo.username;
      }
      
      return status;
    } catch (error: any) {
      logger.error('GitHub 認証状態確認エラー', {
        component: 'GitHubAuthRepository',
        operation: 'getAuthStatus',
        userId,
        error: error.message
      });
      
      // エラーの場合は未認証として扱う
      return { authenticated: false };
    }
  }
}