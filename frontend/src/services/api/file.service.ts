import { apiClient } from '../api-client';
import { 
  ProjectFileResponse,
  ProjectFileUpdateRequest,
  ProjectFileUpdateResponse,
  ProjectDirectory,
  API_PATHS 
} from '../../types';

export const fileApiService = {
  /**
   * プロジェクトファイル取得
   */
  async getFile(projectId: string, filePath: string): Promise<ProjectFileResponse> {
    return apiClient.get<ProjectFileResponse>(API_PATHS.PROJECT_FILES.GET(projectId, filePath));
  },

  /**
   * プロジェクトファイル更新
   */
  async updateFile(projectId: string, filePath: string, request: ProjectFileUpdateRequest): Promise<ProjectFileUpdateResponse> {
    return apiClient.put<ProjectFileUpdateResponse>(API_PATHS.PROJECT_FILES.UPDATE(projectId, filePath), request);
  },

  /**
   * プロジェクトファイル一覧取得
   */
  async listFiles(projectId: string): Promise<ProjectDirectory[]> {
    return apiClient.get<ProjectDirectory[]>(API_PATHS.PROJECT_FILES.LIST(projectId));
  },
};