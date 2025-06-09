import { apiClient } from '../api-client';
import { 
  ExportPrepareRequest, 
  ExportPrepareResponse, 
  API_PATHS 
} from '../../types';

export const exportApiService = {
  /**
   * エクスポート準備（ファイル最適化とパッケージング）
   */
  async prepare(request: ExportPrepareRequest): Promise<ExportPrepareResponse> {
    return apiClient.post<ExportPrepareResponse>(API_PATHS.EXPORT.PREPARE, request);
  },

  /**
   * エクスポートファイルのダウンロード
   */
  async download(exportId: string): Promise<Blob> {
    const response = await fetch(`${apiClient['baseUrl']}${API_PATHS.EXPORT.DOWNLOAD(exportId)}`, {
      method: 'GET',
      credentials: 'include',
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Download failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    
    return response.blob();
  },
};