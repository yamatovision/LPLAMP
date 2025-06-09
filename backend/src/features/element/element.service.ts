import { ElementContext, elementContextRepository } from './element.model';
import { ElementContextRequest, ElementContextResponse, ID, ElementInfo } from '../../types';
import { projectRepository } from '../projects/projects.model';
import { logger } from '../../common/utils/logger';

export class ElementService {
  
  /**
   * 要素コンテキストを作成し、ClaudeCodeに情報を渡す
   */
  async createElementContext(
    request: ElementContextRequest,
    userId: ID
  ): Promise<ElementContextResponse> {
    const startTime = Date.now();
    logger.info(`[ElementService] 要素コンテキスト作成開始`, {
      projectId: request.projectId,
      selector: request.element.selector,
      tagName: request.element.tagName,
      userId
    });

    try {
      // プロジェクトの存在確認とアクセス権限チェック
      const project = await projectRepository.findById(request.projectId);
      if (!project || project.userId !== userId) {
        logger.warn(`[ElementService] プロジェクトが見つからないかアクセス権限がありません`, {
          projectId: request.projectId,
          userId
        });
        throw new Error('プロジェクトが見つからないか、アクセス権限がありません');
      }

      // 要素情報の詳細ログ出力
      logger.info(`[ElementService] 要素情報の詳細`, {
        projectId: request.projectId,
        element: {
          selector: request.element.selector,
          tagName: request.element.tagName,
          textLength: request.element.text?.length || 0,
          htmlLength: request.element.html?.length || 0,
          stylesCount: request.element.styles ? Object.keys(request.element.styles).length : 0
        }
      });

      // 要素コンテキストを保存
      const context = await this.saveElementContext(request);
      
      // ClaudeCodeとの連携（現在は模擬実装）
      const claudeMessage = await this.prepareClaudeCodeContext(request.element, request.projectId);

      const processingTime = Date.now() - startTime;
      logger.info(`[ElementService] 要素コンテキスト作成完了`, {
        projectId: request.projectId,
        contextId: context.id,
        processingTime: `${processingTime}ms`
      });

      return {
        contextId: context.id,
        message: claudeMessage
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`[ElementService] 要素コンテキスト作成エラー`, {
        projectId: request.projectId,
        error: error instanceof Error ? error.message : String(error),
        processingTime: `${processingTime}ms`,
        userId
      });
      throw error;
    }
  }

  /**
   * 要素コンテキストを保存
   */
  private async saveElementContext(
    request: ElementContextRequest
  ): Promise<ElementContext> {
    logger.info(`[ElementService] 要素コンテキスト保存開始`, {
      projectId: request.projectId,
      selector: request.element.selector
    });

    try {
      const elementContext = await elementContextRepository.create({
        projectId: request.projectId,
        element: request.element,
        contextData: {
          timestamp: new Date().toISOString(),
          userAgent: 'LPlamp-Editor',
          sessionInfo: {
            createdAt: new Date().toISOString(),
            elementType: request.element.tagName
          }
        }
      });

      logger.info(`[ElementService] 要素コンテキスト保存完了`, {
        contextId: elementContext.id,
        projectId: request.projectId
      });

      return elementContext;

    } catch (error) {
      logger.error(`[ElementService] 要素コンテキスト保存エラー`, {
        projectId: request.projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('要素コンテキストの保存に失敗しました');
    }
  }

  /**
   * ClaudeCodeのコンテキスト準備（模擬実装）
   * 実際の実装では、ClaudeCode APIとの連携を行う
   */
  private async prepareClaudeCodeContext(
    element: ElementInfo,
    projectId: ID
  ): Promise<string> {
    logger.info(`[ElementService] ClaudeCodeコンテキスト準備開始`, {
      projectId,
      selector: element.selector,
      tagName: element.tagName
    });

    // 要素情報をClaudeCodeが理解しやすい形式に変換
    const contextMessage = this.formatElementForClaude(element);

    logger.info(`[ElementService] ClaudeCodeコンテキスト準備完了`, {
      projectId,
      messageLength: contextMessage.length
    });

    return contextMessage;
  }

  /**
   * 要素情報をClaudeCode用にフォーマット
   */
  private formatElementForClaude(element: ElementInfo): string {
    const textPreview = element.text && element.text.length > 100 
      ? element.text.substring(0, 100) + '...'
      : element.text || '';

    const htmlPreview = element.html && element.html.length > 500
      ? element.html.substring(0, 500) + '...'
      : element.html || '';

    return `選択された要素の情報をClaudeCodeに伝達しました：

【要素詳細】
- セレクタ: ${element.selector}
- タグ名: ${element.tagName}
- テキスト内容: "${textPreview}"
- スタイル情報:
  - 色: ${element.styles?.color || 'N/A'}
  - 背景色: ${element.styles?.backgroundColor || 'N/A'}
  - フォントサイズ: ${element.styles?.fontSize || 'N/A'}
  - フォントファミリー: ${element.styles?.fontFamily || 'N/A'}

【HTML構造（抜粋）】
${htmlPreview}

この要素に対してClaudeCodeターミナルで編集指示を行えます。`;
  }

  /**
   * プロジェクトの要素コンテキスト履歴を取得
   */
  async getElementContextHistory(
    projectId: ID,
    userId: ID,
    limit: number = 10
  ): Promise<ElementContext[]> {
    logger.info(`[ElementService] 要素コンテキスト履歴取得開始`, {
      projectId,
      userId,
      limit
    });

    try {
      // プロジェクトアクセス権限チェック
      const project = await projectRepository.findById(projectId);
      if (!project || project.userId !== userId) {
        throw new Error('プロジェクトが見つからないか、アクセス権限がありません');
      }

      const contexts = await elementContextRepository.findByProjectId(projectId, limit);

      logger.info(`[ElementService] 要素コンテキスト履歴取得完了`, {
        projectId,
        count: contexts.length
      });

      return contexts;

    } catch (error) {
      logger.error(`[ElementService] 要素コンテキスト履歴取得エラー`, {
        projectId,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

export const elementService = new ElementService();