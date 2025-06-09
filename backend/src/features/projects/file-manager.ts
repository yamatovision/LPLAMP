import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../common/utils/logger';
import { ProjectFile, ProjectDirectory, ProjectFileUpdateRequest } from '../../types';

/**
 * プロジェクトファイル管理クラス
 */
export class ProjectFileManager {
  private readonly baseDir: string;

  constructor() {
    this.baseDir = process.env['PROJECTS_BASE_DIR'] || '/tmp/lplamp-projects';
  }

  /**
   * プロジェクトのベースディレクトリパスを取得
   */
  private getProjectPath(projectId: string): string {
    return path.join(this.baseDir, projectId);
  }

  /**
   * 完全なファイルパスを取得（セキュリティチェック付き）
   */
  private getSecureFilePath(projectId: string, filePath: string): string {
    const projectPath = this.getProjectPath(projectId);
    const resolvedPath = path.resolve(projectPath, filePath);

    // パストラバーサル攻撃の防止
    if (!resolvedPath.startsWith(projectPath)) {
      throw new Error('無効なファイルパス');
    }

    return resolvedPath;
  }

  /**
   * プロジェクトディレクトリの初期化
   */
  public async initializeProjectDirectory(projectId: string): Promise<void> {
    const projectPath = this.getProjectPath(projectId);
    
    try {
      await fs.access(projectPath);
    } catch {
      await fs.mkdir(projectPath, { recursive: true });
      logger.info(`プロジェクトディレクトリ作成: ${projectPath}`);
    }
  }

  /**
   * ファイルの存在確認
   */
  public async fileExists(projectId: string, filePath: string): Promise<boolean> {
    try {
      const fullPath = this.getSecureFilePath(projectId, filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * ファイルの取得
   */
  public async getFile(projectId: string, filePath: string): Promise<ProjectFile | null> {
    try {
      const fullPath = this.getSecureFilePath(projectId, filePath);
      const stats = await fs.stat(fullPath);

      if (!stats.isFile()) {
        return null;
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      const mimeType = this.getMimeType(filePath);

      return {
        path: filePath,
        content,
        size: stats.size,
        mimeType,
        lastModified: stats.mtime.toISOString()
      };

    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null;
      }
      logger.error(`ファイル取得エラー: ${projectId}/${filePath}`, { error });
      throw error;
    }
  }

  /**
   * ファイルの更新または作成
   */
  public async updateFile(
    projectId: string, 
    filePath: string, 
    updateRequest: ProjectFileUpdateRequest
  ): Promise<ProjectFile> {
    try {
      const fullPath = this.getSecureFilePath(projectId, filePath);
      const dirPath = path.dirname(fullPath);

      // ディレクトリの作成（存在しない場合）
      await fs.mkdir(dirPath, { recursive: true });

      // エンコーディングに応じた書き込み
      const encoding = updateRequest.encoding || 'utf8';
      
      if (encoding === 'base64') {
        const buffer = Buffer.from(updateRequest.content, 'base64');
        await fs.writeFile(fullPath, buffer);
      } else {
        await fs.writeFile(fullPath, updateRequest.content, 'utf-8');
      }

      logger.info(`ファイル更新: ${projectId}/${filePath}`, {
        size: updateRequest.content.length,
        encoding
      });

      // 更新後のファイル情報を取得
      const updatedFile = await this.getFile(projectId, filePath);
      if (!updatedFile) {
        throw new Error('ファイル更新後の取得に失敗');
      }

      return updatedFile;

    } catch (error) {
      logger.error(`ファイル更新エラー: ${projectId}/${filePath}`, { error });
      throw error;
    }
  }

  /**
   * ファイルの削除
   */
  public async deleteFile(projectId: string, filePath: string): Promise<void> {
    try {
      const fullPath = this.getSecureFilePath(projectId, filePath);
      await fs.unlink(fullPath);
      logger.info(`ファイル削除: ${projectId}/${filePath}`);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.error(`ファイル削除エラー: ${projectId}/${filePath}`, { error });
        throw error;
      }
    }
  }

  /**
   * ディレクトリ一覧の取得
   */
  public async listDirectory(projectId: string, dirPath: string = ''): Promise<ProjectDirectory[]> {
    try {
      // パストラバーサル攻撃の防止
      if (dirPath.includes('..') || path.isAbsolute(dirPath)) {
        throw new Error('Invalid path');
      }

      const fullPath = this.getSecureFilePath(projectId, dirPath);
      
      // ディレクトリの存在確認
      try {
        const stats = await fs.stat(fullPath);
        if (!stats.isDirectory()) {
          throw new Error('ディレクトリが見つかりません');
        }
      } catch (statError: any) {
        if (statError.code === 'ENOENT') {
          throw new Error('ディレクトリが見つかりません');
        }
        throw statError;
      }

      const entries = await fs.readdir(fullPath, { withFileTypes: true });

      const result: ProjectDirectory[] = [];

      for (const entry of entries) {
        // 隠しファイル・ディレクトリを除外
        if (entry.name.startsWith('.')) {
          continue;
        }

        const entryPath = path.join(dirPath, entry.name);
        const fullEntryPath = path.join(fullPath, entry.name);

        if (entry.isFile()) {
          const stats = await fs.stat(fullEntryPath);
          result.push({
            name: entry.name,
            path: entryPath,
            type: 'file',
            size: stats.size,
            modified: stats.mtime.toISOString()
          });
        } else if (entry.isDirectory()) {
          const stats = await fs.stat(fullEntryPath);
          result.push({
            name: entry.name,
            path: entryPath,
            type: 'directory',
            modified: stats.mtime.toISOString()
          });
        }
      }

      // ソート（ディレクトリを最初に、その後ファイル名順）
      result.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('Invalid path')) {
        throw new Error('Invalid path');
      }
      
      if (errorMessage.includes('ディレクトリが見つかりません')) {
        throw new Error('ディレクトリが見つかりません');
      }
      
      if ((error as any).code === 'ENOENT') {
        throw new Error('ディレクトリが見つかりません');
      }
      
      logger.error(`ディレクトリ一覧取得エラー: ${projectId}/${dirPath}`, { error });
      throw error;
    }
  }

  /**
   * プロジェクト全体のディレクトリツリーの取得
   */
  public async getProjectTree(projectId: string): Promise<ProjectDirectory> {
    const projectPath = this.getProjectPath(projectId);
    
    try {
      await fs.access(projectPath);
    } catch {
      // プロジェクトディレクトリが存在しない場合は初期化
      await this.initializeProjectDirectory(projectId);
    }

    return this.buildDirectoryTree(projectId, '', path.basename(projectPath));
  }

  /**
   * ディレクトリツリーの構築（再帰的）
   */
  private async buildDirectoryTree(
    projectId: string, 
    relativePath: string, 
    name: string
  ): Promise<ProjectDirectory> {
    const entries = await this.listDirectory(projectId, relativePath);
    const children: ProjectDirectory[] = [];

    for (const entry of entries) {
      if (entry.type === 'directory') {
        const childTree = await this.buildDirectoryTree(projectId, entry.path, entry.name);
        children.push(childTree);
      } else {
        children.push(entry);
      }
    }

    // ディレクトリ自体の統計情報を取得
    const fullPath = this.getSecureFilePath(projectId, relativePath);
    let modified: string | undefined;
    
    try {
      const stats = await fs.stat(fullPath);
      modified = stats.mtime.toISOString();
    } catch {
      // エラーの場合はmodifiedを設定しない
      modified = undefined;
    }

    return {
      name,
      path: relativePath,
      type: 'directory',
      children: children.length > 0 ? children : undefined,
      modified
    };
  }

  /**
   * MIMEタイプの推定
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.xml': 'application/xml',
      '.yaml': 'application/x-yaml',
      '.yml': 'application/x-yaml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * プロジェクトディレクトリの削除
   */
  public async deleteProject(projectId: string): Promise<void> {
    try {
      const projectPath = this.getProjectPath(projectId);
      await fs.rm(projectPath, { recursive: true, force: true });
      logger.info(`プロジェクトディレクトリ削除: ${projectPath}`);
    } catch (error) {
      logger.error(`プロジェクトディレクトリ削除エラー: ${projectId}`, { error });
      throw error;
    }
  }

  /**
   * プロジェクトディスク使用量の取得
   */
  public async getProjectDiskUsage(projectId: string): Promise<number> {
    try {
      const projectPath = this.getProjectPath(projectId);
      return await this.calculateDirectorySize(projectPath);
    } catch (error) {
      logger.error(`ディスク使用量取得エラー: ${projectId}`, { error });
      return 0;
    }
  }

  /**
   * ディレクトリサイズの計算（再帰的）
   */
  private async calculateDirectorySize(dirPath: string): Promise<number> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      let totalSize = 0;

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        
        if (entry.isFile()) {
          const stats = await fs.stat(entryPath);
          totalSize += stats.size;
        } else if (entry.isDirectory()) {
          totalSize += await this.calculateDirectorySize(entryPath);
        }
      }

      return totalSize;
    } catch {
      return 0;
    }
  }
}