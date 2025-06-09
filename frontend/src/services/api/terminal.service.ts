import { 
  TerminalMessage, 
  TerminalMessageType, 
  API_PATHS 
} from '../../types';

export interface TerminalConnection {
  send: (message: string) => void;
  close: () => void;
  onMessage: (callback: (message: TerminalMessage) => void) => void;
  onClose: (callback: () => void) => void;
  onError: (callback: (error: Event) => void) => void;
}

export const terminalApiService = {
  /**
   * ClaudeCodeターミナルWebSocket接続を開始
   */
  connect(projectId: string): TerminalConnection {
    // WebSocketのベースURLを構成（HTTPのbaseUrlからWSに変換）
    const apiClient = (globalThis as any).apiClient;
    const baseUrl = apiClient?.baseUrl || 'http://localhost:3001';
    const wsUrl = baseUrl.replace(/^http/, 'ws') + API_PATHS.WEBSOCKET.TERMINAL + `?projectId=${projectId}`;
    
    const ws = new WebSocket(wsUrl);
    const messageCallbacks: ((message: TerminalMessage) => void)[] = [];
    const closeCallbacks: (() => void)[] = [];
    const errorCallbacks: ((error: Event) => void)[] = [];

    ws.onmessage = (event) => {
      try {
        const message: TerminalMessage = JSON.parse(event.data);
        messageCallbacks.forEach(callback => callback(message));
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
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
          console.warn('WebSocket is not open. ReadyState:', ws.readyState);
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
      }
    };
  },
};