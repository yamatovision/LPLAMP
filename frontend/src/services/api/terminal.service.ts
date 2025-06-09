import { 
  TerminalMessage, 
  TerminalMessageType, 
  ElementInfo,
  API_PATHS 
} from '../../types';

export interface TerminalConnection {
  send: (message: string) => void;
  sendElementContext: (element: ElementInfo) => void;
  close: () => void;
  onMessage: (callback: (message: TerminalMessage) => void) => void;
  onClose: (callback: () => void) => void;
  onError: (callback: (error: Event) => void) => void;
  onElementSent: (callback: (data: { sessionId: string; element: string }) => void) => void;
}

export const terminalApiService = {
  /**
   * ClaudeCode WebSocket接続を開始
   */
  connect(projectId: string): TerminalConnection {
    // WebSocketのベースURLを構成（HTTPのbaseUrlからWSに変換）
    const apiClient = (globalThis as any).apiClient;
    const baseUrl = apiClient?.baseUrl || 'http://localhost:8000';
    const wsUrl = baseUrl.replace(/^http/, 'ws') + API_PATHS.WEBSOCKET.TERMINAL + `?projectId=${projectId}`;
    
    const ws = new WebSocket(wsUrl);
    const messageCallbacks: ((message: TerminalMessage) => void)[] = [];
    const closeCallbacks: (() => void)[] = [];
    const errorCallbacks: ((error: Event) => void)[] = [];
    const elementSentCallbacks: ((data: { sessionId: string; element: string }) => void)[] = [];

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // ClaudeCode専用イベントの処理
        if (data.type === 'terminal:element-sent') {
          elementSentCallbacks.forEach(callback => callback(data));
          return;
        }
        
        // 通常のターミナルメッセージの処理
        if (data.type && data.data !== undefined) {
          const message: TerminalMessage = data;
          messageCallbacks.forEach(callback => callback(message));
        }
      } catch (error) {
        console.error('ClaudeCode WebSocket message parse error:', error);
      }
    };

    ws.onclose = () => {
      closeCallbacks.forEach(callback => callback());
    };

    ws.onerror = (error) => {
      errorCallbacks.forEach(callback => callback(error));
    };

    return {
      send: (message: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          const terminalMessage: TerminalMessage = {
            type: TerminalMessageType.INPUT,
            data: message,
            timestamp: new Date().toISOString()
          };
          ws.send(JSON.stringify(terminalMessage));
        } else {
          console.warn('ClaudeCode WebSocket is not open. ReadyState:', ws.readyState);
        }
      },
      
      sendElementContext: (element: ElementInfo) => {
        if (ws.readyState === WebSocket.OPEN) {
          const elementMessage = {
            type: 'terminal:element-context',
            projectId,
            element
          };
          ws.send(JSON.stringify(elementMessage));
        } else {
          console.warn('Cannot send element context: ClaudeCode WebSocket is not open');
        }
      },
      
      close: () => {
        ws.close();
      },
      
      onMessage: (callback: (message: TerminalMessage) => void) => {
        messageCallbacks.push(callback);
      },
      
      onClose: (callback: () => void) => {
        closeCallbacks.push(callback);
      },
      
      onError: (callback: (error: Event) => void) => {
        errorCallbacks.push(callback);
      },

      onElementSent: (callback: (data: { sessionId: string; element: string }) => void) => {
        elementSentCallbacks.push(callback);
      }
    };
  },
};