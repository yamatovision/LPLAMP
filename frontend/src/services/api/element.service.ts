import { apiClient } from '../api-client';
import { 
  ElementContextRequest, 
  ElementContextResponse, 
  API_PATHS 
} from '../../types';

export const elementApiService = {
  /**
   * 要素コンテキストをClaudeCodeに伝達
   */
  async createContext(request: ElementContextRequest): Promise<ElementContextResponse> {
    return apiClient.post<ElementContextResponse>(API_PATHS.ELEMENT.CONTEXT, request);
  },
};