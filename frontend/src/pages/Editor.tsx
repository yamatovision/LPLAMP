import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import EditorLayout from '@/layouts/EditorLayout';
import { Project, Replica, ElementInfo, TerminalMessage, TerminalMessageType } from '@/types';
import { useAutoSave, createEditChanges, createProjectFile } from '@/hooks/useAutoSave';
import { GitHubStatusBar } from '@/components/features/github/GitHubStatusBar';
import { terminalApiService, TerminalConnection } from '@/services/api/terminal.service';

export default function Editor() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [replica, setReplica] = useState<Replica | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editMode, setEditMode] = useState<'ai' | 'manual' | null>(null);
  const replicaContainerRef = useRef<HTMLDivElement>(null);
  
  // ClaudeCodeターミナル関連状態
  const [terminalConnection, setTerminalConnection] = useState<TerminalConnection | null>(null);
  const [terminalMessages, setTerminalMessages] = useState<TerminalMessage[]>([]);
  const [isClaudeCodeReady, setIsClaudeCodeReady] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);

  // 自動保存フックの統合
  const {
    lastSaved,
    isSaving,
    saveStatus,
    triggerAutoSave
  } = useAutoSave(projectId || '');

  useEffect(() => {
    if (projectId) {
      loadProjectData();
      initializeClaudeCode();
    }
  }, [projectId]);

  // ClaudeCode接続の初期化
  const initializeClaudeCode = () => {
    if (!projectId) return;

    try {
      const connection = terminalApiService.connect(projectId);
      
      // ClaudeCodeメッセージ受信
      connection.onMessage((message: TerminalMessage) => {
        setTerminalMessages(prev => [...prev, message]);
        
        // ClaudeCode準備完了の検出
        if (message.data.includes('ClaudeCode準備完了')) {
          setIsClaudeCodeReady(true);
        }
      });

      // 要素送信完了通知
      connection.onElementSent((data) => {
        console.log('要素情報送信完了:', data);
        setShowTerminal(true); // ターミナルを自動表示
      });

      // 接続エラー処理
      connection.onError((error) => {
        console.error('ClaudeCode接続エラー:', error);
        setTerminalMessages(prev => [...prev, {
          type: TerminalMessageType.ERROR,
          data: 'ClaudeCodeとの接続に失敗しました',
          timestamp: new Date().toISOString()
        }]);
      });

      // 接続クローズ処理
      connection.onClose(() => {
        console.log('ClaudeCode接続が閉じられました');
        setIsClaudeCodeReady(false);
        setTerminalConnection(null);
      });

      setTerminalConnection(connection);
    } catch (error) {
      console.error('ClaudeCode初期化エラー:', error);
    }
  };

  const loadProjectData = async () => {
    if (!projectId) return;

    try {
      setIsLoading(true);
      const { projectsService, replicaService } = await import('@/services');
      
      const [projectResponse, replicaResponse] = await Promise.all([
        projectsService.getProject(projectId),
        replicaService.getReplica(projectId),
      ]);

      if (projectResponse.success && projectResponse.data) {
        setProject(projectResponse.data);
      }

      if (replicaResponse.success && replicaResponse.data) {
        setReplica(replicaResponse.data);
      }
    } catch (error) {
      console.error('プロジェクトデータの取得に失敗:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // レプリカ表示後に要素クリックイベントを設定
  useEffect(() => {
    if (replica && replicaContainerRef.current) {
      setupElementClickHandlers();
    }
  }, [replica]);

  const setupElementClickHandlers = () => {
    if (!replicaContainerRef.current) return;

    const container = replicaContainerRef.current;
    const clickableElements = container.querySelectorAll('*');

    clickableElements.forEach((element) => {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const target = e.target as HTMLElement;
        const elementInfo = extractElementInfo(target);
        setSelectedElement(elementInfo);
        highlightElement(target);
        
        // ClaudeCodeに要素情報を自動送信
        if (terminalConnection && isClaudeCodeReady) {
          terminalConnection.sendElementContext(elementInfo);
        } else {
          console.warn('ClaudeCodeが準備できていません');
        }
      });
    });
  };

  const extractElementInfo = (element: HTMLElement): ElementInfo => {
    const computedStyle = window.getComputedStyle(element);
    
    // 要素のセレクターを生成
    const selector = generateSelector(element);
    
    return {
      selector,
      tagName: element.tagName.toLowerCase(),
      text: element.textContent?.trim() || '',
      html: element.outerHTML,
      styles: {
        color: computedStyle.color,
        backgroundColor: computedStyle.backgroundColor,
        fontSize: computedStyle.fontSize,
        fontFamily: computedStyle.fontFamily,
      }
    };
  };

  const generateSelector = (element: HTMLElement): string => {
    // 簡単なセレクター生成（改善可能）
    let selector = element.tagName.toLowerCase();
    
    if (element.id) {
      selector += `#${element.id}`;
    }
    
    if (element.className) {
      const classes = element.className.split(' ').filter(cls => cls.trim());
      if (classes.length > 0) {
        selector += '.' + classes.join('.');
      }
    }
    
    return selector;
  };

  const highlightElement = (element: HTMLElement) => {
    // 既存のハイライトを削除
    const existingHighlight = replicaContainerRef.current?.querySelector('.element-highlight');
    if (existingHighlight) {
      existingHighlight.remove();
    }

    // 新しいハイライトを追加
    const rect = element.getBoundingClientRect();
    const containerRect = replicaContainerRef.current?.getBoundingClientRect();
    
    if (containerRect) {
      const highlight = document.createElement('div');
      highlight.className = 'element-highlight';
      highlight.style.cssText = `
        position: absolute;
        left: ${rect.left - containerRect.left}px;
        top: ${rect.top - containerRect.top}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        border: 2px solid #3B82F6;
        background-color: rgba(59, 130, 246, 0.1);
        pointer-events: none;
        z-index: 1000;
      `;
      
      replicaContainerRef.current?.appendChild(highlight);
    }
  };

  const handleAIEdit = () => {
    if (!selectedElement) return;
    
    console.log('AI編集開始:', selectedElement);
    setEditMode('ai');
    setShowEditModal(true);
    
    // ClaudeCodeターミナル起動の実装（将来的に）
    // TODO: WebSocket接続でClaudeCodeターミナルと連携
  };

  const handleManualEdit = () => {
    if (!selectedElement) return;
    
    console.log('手動編集開始:', selectedElement);
    setEditMode('manual');
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditMode(null);
  };

  /**
   * 編集内容を保存し自動保存をトリガー
   */
  const handleSaveEdit = async (newContent: string, newStyles?: Record<string, string>) => {
    if (!selectedElement || !replica || !projectId) return;

    try {
      // HTMLコンテンツを更新（簡易実装）
      const updatedHtml = replica.html.replace(
        selectedElement.html || '',
        newContent
      );
      
      // 更新されたレプリカの状態を設定
      setReplica({ ...replica, html: updatedHtml });

      // 編集変更をAutoSaveに通知
      const editChanges = createEditChanges(
        `${editMode === 'ai' ? 'AI編集' : '手動編集'}: ${selectedElement.tagName}要素を更新`,
        [
          createProjectFile('index.html', updatedHtml, 'text/html'),
          // スタイル変更があればCSSファイルも更新
          ...(newStyles ? [createProjectFile('styles.css', replica.css, 'text/css')] : [])
        ]
      );

      // 自動保存をトリガー
      await triggerAutoSave(editChanges);

      console.log('編集内容が保存されました');
      closeEditModal();

    } catch (error) {
      console.error('編集内容の保存に失敗:', error);
    }
  };

  if (isLoading) {
    return (
        <EditorLayout projectName="読み込み中...">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
          </div>
        </EditorLayout>
    );
  }

  if (!project) {
    return (
        <EditorLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="text-red-500 text-lg mb-2">プロジェクトが見つかりません</div>
              <div className="text-gray-500">指定されたプロジェクトが存在しないか、アクセス権限がありません</div>
            </div>
          </div>
        </EditorLayout>
    );
  }

  if (!replica) {
    return (
        <EditorLayout projectName={project.name}>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center max-w-md">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-5 5l-5-5m10-5l-5 5l-5-5" />
                  </svg>
                </div>
              </div>
              <div className="text-yellow-600 text-lg font-medium mb-2">レプリカを準備中</div>
              <div className="text-gray-600 mb-4">
                {project.status === 'creating' ? 
                  'ウェブサイトのレプリカを作成しています。しばらくお待ちください。' :
                  project.status === 'error' ?
                  'レプリカの作成中にエラーが発生しました。' :
                  'レプリカを準備中です。'
                }
              </div>
              <button 
                onClick={loadProjectData}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                再読み込み
              </button>
            </div>
          </div>
        </EditorLayout>
    );
  }

  return (
      <EditorLayout 
        projectName={project.name} 
        saveStatus={saveStatus}
      >
        {/* GitHub状態表示バー */}
        <GitHubStatusBar 
          project={project}
          saveStatus={saveStatus}
          lastSaved={lastSaved}
        />
        
        <div className="flex-1 bg-gray-100">
          {/* レプリカビューワー */}
          <div className="h-full p-4">
            <div className="bg-white rounded-lg shadow-sm h-full overflow-auto">
              <div className="p-4 border-b">
                <h3 className="text-lg font-medium text-gray-900">
                  レプリカプレビュー
                </h3>
                <p className="text-sm text-gray-500">
                  要素をクリックして編集を開始してください
                </p>
              </div>
              
              <div className="p-4">
                {/* レプリカHTML表示エリア */}
                <div className="border rounded-lg relative">
                  <div
                    ref={replicaContainerRef}
                    className="w-full h-96 overflow-auto border-0 rounded-lg relative"
                    dangerouslySetInnerHTML={{ __html: replica.html }}
                  />
                </div>
                
                {/* 選択中の要素情報 */}
                {selectedElement && (
                  <div className="mt-4 bg-green-50 rounded-lg p-4">
                    <h4 className="font-medium text-green-900 mb-2">選択中の要素</h4>
                    <div className="text-sm text-green-800 space-y-1">
                      <div><strong>タグ:</strong> {selectedElement.tagName}</div>
                      <div><strong>セレクター:</strong> {selectedElement.selector}</div>
                      <div><strong>テキスト:</strong> {selectedElement.text?.substring(0, 100)}{selectedElement.text && selectedElement.text.length > 100 ? '...' : ''}</div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button 
                        onClick={handleAIEdit}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        AI編集
                      </button>
                      <button 
                        onClick={handleManualEdit}
                        className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                      >
                        手動編集
                      </button>
                    </div>
                  </div>
                )}

                {/* 保存状態表示 */}
                {(saveStatus !== 'idle' || lastSaved) && (
                  <div className="mt-4 p-3 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {saveStatus === 'saving' && (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                            <span className="text-blue-600 text-sm">保存中...</span>
                          </>
                        )}
                        {saveStatus === 'saved' && (
                          <>
                            <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className="text-green-600 text-sm">保存済み</span>
                          </>
                        )}
                        {saveStatus === 'error' && (
                          <>
                            <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </div>
                            <span className="text-red-600 text-sm">保存エラー</span>
                          </>
                        )}
                      </div>
                      {lastSaved && (
                        <span className="text-gray-500 text-xs">
                          {lastSaved.toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 編集情報パネル */}
                <div className="mt-4 bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">編集方法</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• プレビュー内の要素をクリックして選択</li>
                    <li>• 浮動ツールバーから編集方法を選択</li>
                    <li>• AI編集ではClaudeCodeターミナルが自動起動</li>
                    <li>• 変更は自動的に保存されます（Ctrl+Sで明示的保存）</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 編集モーダル */}
        {showEditModal && selectedElement && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  {editMode === 'ai' ? 'AI編集' : '手動編集'} - {selectedElement.tagName}
                </h3>
                <button
                  onClick={closeEditModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-2">
                  <strong>セレクター:</strong> {selectedElement.selector}
                </div>
                <div className="text-sm text-gray-600 mb-4">
                  <strong>現在のテキスト:</strong> {selectedElement.text}
                </div>
              </div>

              {editMode === 'ai' ? (
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      AI編集指示
                    </label>
                    <textarea
                      className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="この要素をどのように編集したいかをAIに指示してください&#10;例: このタイトルをもっとキャッチーにして、色を赤にして"
                    />
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                    <p className="text-sm text-yellow-800">
                      🚧 AI編集機能は開発中です。ClaudeCodeターミナルとの連携を実装予定です。
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      テキスト内容
                    </label>
                    <textarea
                      id="manual-edit-textarea"
                      className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      defaultValue={selectedElement.text}
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      スタイル
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">色</label>
                        <input
                          id="manual-edit-color"
                          type="color"
                          defaultValue={selectedElement.styles?.color || '#000000'}
                          className="w-full h-8 border border-gray-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">背景色</label>
                        <input
                          id="manual-edit-bgcolor"
                          type="color"
                          defaultValue={selectedElement.styles?.backgroundColor || '#ffffff'}
                          className="w-full h-8 border border-gray-300 rounded"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={closeEditModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  disabled={isSaving}
                  onClick={async () => {
                    if (editMode === 'ai') {
                      // AI編集実装（将来のClaudeCode連携）
                      console.log('AI編集実行（未実装）');
                      closeEditModal();
                    } else {
                      // 手動編集の保存
                      const textareaElement = document.querySelector('#manual-edit-textarea') as HTMLTextAreaElement;
                      const colorInput = document.querySelector('#manual-edit-color') as HTMLInputElement;
                      const bgColorInput = document.querySelector('#manual-edit-bgcolor') as HTMLInputElement;
                      
                      if (textareaElement) {
                        const newContent = selectedElement?.html?.replace(
                          selectedElement.text || '',
                          textareaElement.value
                        ) || '';
                        
                        const newStyles = {
                          color: colorInput?.value,
                          backgroundColor: bgColorInput?.value
                        };
                        
                        await handleSaveEdit(newContent, newStyles);
                      }
                    }
                  }}
                >
                  {isSaving ? '保存中...' : (editMode === 'ai' ? 'AI編集実行' : '変更を保存')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ClaudeCodeターミナル */}
        {showTerminal && (
          <div className="fixed bottom-0 left-0 right-0 h-80 bg-gray-900 border-t border-gray-600 z-40">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-white font-medium">🤖 ClaudeCode</span>
                {isClaudeCodeReady ? (
                  <span className="text-green-400 text-sm">Ready</span>
                ) : (
                  <span className="text-yellow-400 text-sm">Connecting...</span>
                )}
              </div>
              <button 
                onClick={() => setShowTerminal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="h-full flex flex-col">
              {/* メッセージ表示エリア */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {terminalMessages.map((message, index) => (
                  <div key={index} className="text-sm">
                    <span className="text-gray-400 text-xs">
                      {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ''}
                    </span>
                    <div className={`mt-1 ${
                      message.type === TerminalMessageType.ERROR ? 'text-red-400' :
                      message.type === TerminalMessageType.SYSTEM ? 'text-blue-400' :
                      message.type === TerminalMessageType.INPUT ? 'text-green-400' :
                      'text-white'
                    }`}>
                      {message.data}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* 入力エリア */}
              <div className="border-t border-gray-600 p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={isClaudeCodeReady ? "ClaudeCodeに指示を入力..." : "ClaudeCodeの準備中..."}
                    disabled={!isClaudeCodeReady}
                    className="flex-1 bg-gray-800 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && terminalConnection && isClaudeCodeReady) {
                        const input = e.currentTarget.value;
                        if (input.trim()) {
                          terminalConnection.send(input);
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const input = document.querySelector('input[placeholder*="ClaudeCode"]') as HTMLInputElement;
                      if (input && input.value.trim() && terminalConnection && isClaudeCodeReady) {
                        terminalConnection.send(input.value);
                        input.value = '';
                      }
                    }}
                    disabled={!isClaudeCodeReady}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    送信
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ClaudeCodeターミナル表示ボタン */}
        {!showTerminal && (
          <button
            onClick={() => setShowTerminal(true)}
            className="fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 z-30"
          >
            🤖
          </button>
        )}
      </EditorLayout>
  );
}