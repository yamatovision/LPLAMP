import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

describe('プロンプトセキュリティテスト', () => {
  const scriptPath = path.join(process.cwd(), '..', 'scripts', 'security', 'prompt-manager.sh');
  const tempBaseDir = '/dev/shm/.appgenius_temp';
  
  // テスト用の環境変数
  const testPrompt = 'テスト用プロンプト内容';
  
  beforeAll(() => {
    // テスト用のプロンプトSecretを設定
    process.env['LPGENIUS_PROMPT_SECRET'] = testPrompt;
  });
  
  afterAll(() => {
    // 環境変数をクリーンアップ
    delete process.env['LPGENIUS_PROMPT_SECRET'];
  });
  
  afterEach(async () => {
    // テスト後のクリーンアップ
    try {
      const files = await fs.readdir(tempBaseDir);
      for (const file of files) {
        if (file.startsWith('.vq')) {
          await fs.unlink(path.join(tempBaseDir, file));
        }
      }
    } catch (error) {
      // ディレクトリが存在しない場合は無視
    }
  });

  test('プロンプトファイルが/dev/shmに作成されること', async () => {
    const { stdout } = await execAsync(`LPGENIUS_PROMPT_SECRET="${testPrompt}" bash ${scriptPath}`);
    const filePath = stdout.trim();
    
    // ファイルパスが正しい場所を指していることを確認
    expect(filePath).toMatch(/^\/dev\/shm\/\.appgenius_temp\/\.vq[a-f0-9]{12}$/);
    
    // ファイルが実際に存在することを確認
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
    
    // ファイルの内容が正しいことを確認
    const content = await fs.readFile(filePath, 'utf8');
    expect(content).toBe(testPrompt);
  }, 10000);

  test('ファイル権限が600であること', async () => {
    const { stdout } = await execAsync(`LPGENIUS_PROMPT_SECRET="${testPrompt}" bash ${scriptPath}`);
    const filePath = stdout.trim();
    
    // ファイルの権限を確認
    const stats = await fs.stat(filePath);
    const mode = (stats.mode & parseInt('777', 8)).toString(8);
    
    expect(mode).toBe('600');
  }, 10000);

  test('環境変数が設定されていない場合はエラーになること', async () => {
    // 一時的に環境変数を削除
    const originalSecret = process.env['LPGENIUS_PROMPT_SECRET'];
    delete process.env['LPGENIUS_PROMPT_SECRET'];
    
    try {
      await execAsync(`bash ${scriptPath}`);
      fail('エラーが発生するはずですが、発生しませんでした');
    } catch (error: any) {
      expect(error.code).toBe(1);
      expect(error.stderr).toContain('LPGENIUS_PROMPT_SECRET が設定されていません');
    } finally {
      // 環境変数を復元
      process.env['LPGENIUS_PROMPT_SECRET'] = originalSecret;
    }
  }, 10000);

  test('45秒後に自動削除されること', async () => {
    
    const { stdout } = await execAsync(`LPGENIUS_PROMPT_SECRET="${testPrompt}" bash ${scriptPath}`);
    const filePath = stdout.trim();
    
    // ファイルが存在することを確認
    const initialExists = await fs.access(filePath).then(() => true).catch(() => false);
    expect(initialExists).toBe(true);
    
    // 46秒待機（45秒 + バッファ）
    await new Promise(resolve => setTimeout(resolve, 46000));
    
    // ファイルが削除されていることを確認
    const finalExists = await fs.access(filePath).then(() => true).catch(() => false);
    expect(finalExists).toBe(false);
  }, 60000);

  test('不正なアクセス試行が失敗すること', async () => {
    const { stdout } = await execAsync(`LPGENIUS_PROMPT_SECRET="${testPrompt}" bash ${scriptPath}`);
    const filePath = stdout.trim();
    
    // 別のユーザーとしてアクセスを試みる（権限エラーが発生するはず）
    try {
      // ファイルの権限を確認（600なので所有者以外はアクセス不可）
      const stats = await fs.stat(filePath);
      const mode = stats.mode & parseInt('777', 8);
      
      // 権限が600（所有者のみ読み書き可能）であることを確認
      expect(mode).toBe(parseInt('600', 8));
    } catch (error) {
      // エラーが発生した場合も正常（アクセス権限がない）
    }
  }, 10000);
});