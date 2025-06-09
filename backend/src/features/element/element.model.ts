import { ID, ElementInfo } from '../../types';
import { logger } from '../../common/utils/logger';
import { randomUUID } from 'crypto';

/**
 * 要素コンテキスト
 */
export interface ElementContext {
  id: ID;
  projectId: ID;
  element: ElementInfo;
  contextData?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * 要素コンテキスト作成データ
 */
export interface ElementContextCreate {
  projectId: ID;
  element: ElementInfo;
  contextData?: Record<string, any>;
}

/**
 * 要素コンテキストリポジトリインターフェース
 */
export interface ElementContextRepository {
  /**
   * 新規要素コンテキスト作成
   */
  create(contextData: ElementContextCreate): Promise<ElementContext>;
  
  /**
   * プロジェクト別要素コンテキスト一覧取得
   */
  findByProjectId(projectId: ID, limit?: number): Promise<ElementContext[]>;
  
  /**
   * 要素コンテキスト詳細取得
   */
  findById(contextId: ID): Promise<ElementContext | null>;
  
  /**
   * 要素コンテキスト削除
   */
  delete(contextId: ID): Promise<boolean>;
}

/**
 * インメモリ要素コンテキストリポジトリ
 */
export class InMemoryElementContextRepository implements ElementContextRepository {
  private contexts: Map<ID, ElementContext> = new Map();

  /**
   * 新規要素コンテキスト作成
   */
  async create(contextData: ElementContextCreate): Promise<ElementContext> {
    const contextId = randomUUID();
    const now = new Date().toISOString();
    
    // 要素情報のバリデーション
    this.validateElement(contextData.element);
    
    const context: ElementContext = {
      id: contextId,
      projectId: contextData.projectId,
      element: contextData.element,
      contextData: contextData.contextData || {},
      createdAt: now,
      updatedAt: now
    };

    this.contexts.set(contextId, context);
    
    logger.info('要素コンテキスト作成完了', {
      contextId,
      projectId: contextData.projectId,
      selector: contextData.element.selector
    });

    return context;
  }

  /**
   * プロジェクト別要素コンテキスト一覧取得
   */
  async findByProjectId(projectId: ID, limit: number = 10): Promise<ElementContext[]> {
    const projectContexts = Array.from(this.contexts.values())
      .filter(context => context.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    logger.debug('プロジェクト要素コンテキスト一覧取得', {
      projectId,
      contextCount: projectContexts.length,
      limit
    });

    return projectContexts;
  }

  /**
   * 要素コンテキスト詳細取得
   */
  async findById(contextId: ID): Promise<ElementContext | null> {
    const context = this.contexts.get(contextId) || null;
    
    if (context) {
      logger.debug('要素コンテキスト詳細取得成功', { contextId });
    } else {
      logger.warn('要素コンテキストが見つかりません', { contextId });
    }

    return context;
  }

  /**
   * 要素コンテキスト削除
   */
  async delete(contextId: ID): Promise<boolean> {
    const success = this.contexts.delete(contextId);
    
    if (success) {
      logger.info('要素コンテキスト削除完了', { contextId });
    } else {
      logger.warn('削除対象要素コンテキストが見つかりません', { contextId });
    }

    return success;
  }

  /**
   * 要素情報のバリデーション
   */
  private validateElement(element: ElementInfo): void {
    if (!element || typeof element !== 'object') {
      throw new Error('要素情報はオブジェクトである必要があります');
    }
    
    const required = ['selector', 'tagName', 'text', 'html', 'styles'];
    for (const field of required) {
      if (!(field in element)) {
        throw new Error(`要素情報に必須フィールド「${field}」が含まれていません`);
      }
    }
    
    if (!element.styles || typeof element.styles !== 'object') {
      throw new Error('スタイル情報はオブジェクトである必要があります');
    }
    
    const requiredStyles = ['color', 'backgroundColor', 'fontSize', 'fontFamily'];
    for (const style of requiredStyles) {
      if (!(style in element.styles)) {
        throw new Error(`スタイル情報に必須フィールド「${style}」が含まれていません`);
      }
    }
  }

  /**
   * テスト用：全データクリア
   */
  async clearAll(): Promise<void> {
    this.contexts.clear();
    logger.debug('要素コンテキストデータクリア完了');
  }

  /**
   * テスト用：データ件数取得
   */
  async count(): Promise<number> {
    return this.contexts.size;
  }
}

/**
 * 要素コンテキストリポジトリのシングルトンインスタンス
 */
export const elementContextRepository: ElementContextRepository = new InMemoryElementContextRepository();