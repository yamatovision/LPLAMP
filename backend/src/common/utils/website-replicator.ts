import puppeteer, { Browser, Page } from 'puppeteer';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as url from 'url';
import { logger } from './logger';

export interface ReplicaResult {
  success: boolean;
  html: string;
  css: string;
  outputDir: string;
  error?: string;
}

export class WebsiteReplicator {
  private browser: Browser | null = null;
  private baseUrl: string;
  private outputDir: string;
  private downloadedAssets: Set<string> = new Set();

  constructor(
    targetUrl: string, 
    outputDir?: string,
    private disableJavaScript: boolean = false
  ) {
    this.baseUrl = this.normalizeUrl(targetUrl);
    this.outputDir = outputDir || `replica_${Date.now()}`;
  }

  /**
   * URLを正規化
   */
  private normalizeUrl(targetUrl: string): string {
    if (!targetUrl.startsWith('http')) {
      return `https://${targetUrl}`;
    }
    return targetUrl;
  }

  /**
   * ウェブサイトレプリカを作成
   */
  async replicate(): Promise<ReplicaResult> {
    try {
      logger.info('ウェブサイトレプリカ作成開始', { url: this.baseUrl });
      
      // Puppeteerブラウザー起動
      await this.launchBrowser();
      
      // メインページを取得
      const page = await this.browser!.newPage();
      await this.setupPage(page);
      
      // ページを読み込み
      await page.goto(this.baseUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // 出力ディレクトリ作成
      await this.ensureOutputDirectory();
      
      // CSS抽出
      const css = await this.extractCSS(page);
      
      // アセットをダウンロード
      await this.downloadAssets(page);
      
      // HTMLを取得して画像パスを修正
      let html = await page.content();
      html = await this.processHtml(html);
      
      // JavaScript無効化モードの場合はscriptタグを除去
      if (this.disableJavaScript) {
        html = this.removeScriptTags(html);
        logger.info('JavaScriptコードを除去しました');
      }
      
      // ファイルに保存
      await this.saveFiles(html, css);
      
      await this.closeBrowser();
      
      logger.info('ウェブサイトレプリカ作成完了', { 
        url: this.baseUrl, 
        outputDir: this.outputDir 
      });

      return {
        success: true,
        html,
        css,
        outputDir: this.outputDir
      };

    } catch (error) {
      logger.error('ウェブサイトレプリカ作成エラー', { 
        url: this.baseUrl, 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      await this.closeBrowser();
      
      return {
        success: false,
        html: '',
        css: '',
        outputDir: this.outputDir,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Puppeteerブラウザー起動
   */
  private async launchBrowser(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows'
      ]
    });
  }

  /**
   * ページセットアップ
   */
  private async setupPage(page: Page): Promise<void> {
    // ビューポートサイズ設定
    await page.setViewport({ width: 1920, height: 1080 });
    
    // ユーザーエージェント設定
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    // JavaScript設定
    await page.setJavaScriptEnabled(!this.disableJavaScript);
    
    if (this.disableJavaScript) {
      logger.info('JavaScript無効化モードでレプリケート実行');
    }
  }

  /**
   * 出力ディレクトリ作成
   */
  private async ensureOutputDirectory(): Promise<void> {
    const fullPath = path.resolve(this.outputDir);
    await fs.mkdir(fullPath, { recursive: true });
    await fs.mkdir(path.join(fullPath, 'assets'), { recursive: true });
  }

  /**
   * CSS抽出
   */
  private async extractCSS(page: Page): Promise<string> {
    try {
      // 全てのCSSRuleを取得
      const css = await page.evaluate(`(() => {
        const styles = [];
        
        // インライン<style>タグから取得
        const styleTags = document.querySelectorAll('style');
        styleTags.forEach(style => {
          if (style.textContent) {
            styles.push(style.textContent);
          }
        });
        
        // 外部CSSファイルのルールを取得
        for (const stylesheet of Array.from(document.styleSheets)) {
          try {
            const rules = Array.from(stylesheet.cssRules || stylesheet.rules || []);
            rules.forEach(rule => {
              styles.push(rule.cssText);
            });
          } catch (e) {
            // CORS制限などでアクセスできない場合はスキップ
            console.warn('CSSルールアクセスエラー:', e);
          }
        }
        
        return styles.join('\\n');
      })()`);
      
      return css as string;
    } catch (error) {
      logger.warn('CSS抽出でエラー', { error });
      return '';
    }
  }

  /**
   * アセットをダウンロード
   */
  private async downloadAssets(page: Page): Promise<void> {
    try {
      // 画像URLを取得
      const imageUrls = await page.evaluate(`(() => {
        const images = Array.from(document.querySelectorAll('img'));
        return images
          .map(img => img.src)
          .filter(src => src && !src.startsWith('data:'));
      })()`);

      // 背景画像URLを取得
      const backgroundUrls = await page.evaluate(`(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        const urls = [];
        
        elements.forEach(el => {
          const style = window.getComputedStyle(el);
          const bgImage = style.backgroundImage;
          
          if (bgImage && bgImage !== 'none') {
            const matches = bgImage.match(/url\\(['"]?([^'"]+)['"]?\\)/g);
            if (matches) {
              matches.forEach(match => {
                const urlMatch = match.match(/url\\(['"]?([^'"]+)['"]?\\)/);
                if (urlMatch && urlMatch[1] && !urlMatch[1].startsWith('data:')) {
                  urls.push(urlMatch[1]);
                }
              });
            }
          }
        });
        
        return urls;
      })()`);

      const allUrls = [...new Set([...(imageUrls as string[]), ...(backgroundUrls as string[])])];
      
      // 各URLを並列ダウンロード
      await Promise.allSettled(
        allUrls.map(assetUrl => this.downloadAsset(assetUrl))
      );
      
    } catch (error) {
      logger.warn('アセットダウンロードでエラー', { error });
    }
  }

  /**
   * 個別アセットをダウンロード
   */
  private async downloadAsset(assetUrl: string): Promise<void> {
    try {
      // 絶対URLに変換
      const absoluteUrl = url.resolve(this.baseUrl, assetUrl);
      
      if (this.downloadedAssets.has(absoluteUrl)) {
        return; // 既にダウンロード済み
      }

      // ファイル名を生成
      const urlPath = new URL(absoluteUrl).pathname;
      const fileName = path.basename(urlPath) || `asset_${Date.now()}`;
      const filePath = path.join(this.outputDir, 'assets', fileName);

      // HTTP GETでダウンロード
      const response = await fetch(absoluteUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      await fs.writeFile(filePath, Buffer.from(buffer));

      this.downloadedAssets.add(absoluteUrl);
      
    } catch (error) {
      logger.warn('アセットダウンロード失敗', { 
        assetUrl, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * HTMLを処理してローカルパスに変更
   */
  private async processHtml(html: string): Promise<string> {
    try {
      // 画像のsrcをローカルパスに置換
      html = html.replace(/src="([^"]+)"/g, (match, src) => {
        if (src.startsWith('data:') || src.startsWith('./') || src.startsWith('../')) {
          return match; // データURLや相対パスはそのまま
        }
        
        const absoluteUrl = url.resolve(this.baseUrl, src);
        const urlPath = new URL(absoluteUrl).pathname;
        const fileName = path.basename(urlPath) || `asset_${Date.now()}`;
        
        // ダウンロード済みのアセットのみローカルパスに変更
        if (this.downloadedAssets.has(absoluteUrl)) {
          return `src="/replica-assets/${this.outputDir}/assets/${fileName}"`;
        } else {
          // ダウンロードに失敗した場合は空の画像に変更
          return `src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg=="`;
        }
      });

      // 背景画像のURLをローカルパスに置換
      html = html.replace(/background-image:\s*url\(['"]?([^'"]+)['"]?\)/g, (match, bgUrl) => {
        if (bgUrl.startsWith('data:') || bgUrl.startsWith('./') || bgUrl.startsWith('../')) {
          return match;
        }
        
        const absoluteUrl = url.resolve(this.baseUrl, bgUrl);
        const urlPath = new URL(absoluteUrl).pathname;
        const fileName = path.basename(urlPath) || `asset_${Date.now()}`;
        
        // ダウンロード済みのアセットのみローカルパスに変更
        if (this.downloadedAssets.has(absoluteUrl)) {
          return `background-image: url('/replica-assets/${this.outputDir}/assets/${fileName}')`;
        } else {
          // ダウンロードに失敗した場合は背景画像を削除
          return `background-image: none`;
        }
      });

      return html;
    } catch (error) {
      logger.warn('HTML処理でエラー', { error });
      return html;
    }
  }

  /**
   * ファイルに保存
   */
  private async saveFiles(html: string, css: string): Promise<void> {
    const htmlPath = path.join(this.outputDir, 'index.html');
    const cssPath = path.join(this.outputDir, 'styles.css');

    // HTMLファイルにCSSリンクを追加
    const finalHtml = html.replace(
      '</head>',
      '  <link rel="stylesheet" href="./styles.css">\n</head>'
    );

    await fs.writeFile(htmlPath, finalHtml, 'utf-8');
    await fs.writeFile(cssPath, css, 'utf-8');
  }

  /**
   * JavaScriptタグを除去
   */
  private removeScriptTags(html: string): string {
    try {
      // <script>タグを全て除去
      html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      
      // インライン JavaScript イベントハンドラーを除去
      html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
      
      // javascript: プロトコルのリンクを除去
      html = html.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
      
      return html;
    } catch (error) {
      logger.warn('JavaScriptタグ除去でエラー', { error });
      return html;
    }
  }

  /**
   * ブラウザーを閉じる
   */
  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}