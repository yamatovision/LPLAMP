import { Project, ProjectCreateResponse, ProjectStatusResponse, ApiResponse, API_PATHS } from '@/types';
import { apiClient } from '../api-client';

export const projectsApiService = {
  async getProjects(): Promise<ApiResponse<{ projects: Project[] }>> {
    return apiClient.get<ApiResponse<{ projects: Project[] }>>(API_PATHS.PROJECTS.BASE);
  },

  async createProject(url: string): Promise<ProjectCreateResponse> {
    return apiClient.post<ProjectCreateResponse>(API_PATHS.PROJECTS.CREATE, { url });
  },

  async getProjectStatus(projectId: string): Promise<ProjectStatusResponse> {
    return apiClient.get<ProjectStatusResponse>(API_PATHS.PROJECTS.STATUS(projectId));
  },

  async getProject(projectId: string): Promise<ApiResponse<Project>> {
    return apiClient.get<ApiResponse<Project>>(API_PATHS.PROJECTS.DETAIL(projectId));
  },

  async updateProject(projectId: string, updates: Partial<Project>): Promise<ApiResponse<Project>> {
    return apiClient.put<ApiResponse<Project>>(API_PATHS.PROJECTS.UPDATE(projectId), updates);
  },

  async deleteProject(projectId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<ApiResponse<void>>(API_PATHS.PROJECTS.DELETE(projectId));
  },
};