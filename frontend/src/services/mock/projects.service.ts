import { Project, ProjectCreateResponse, ProjectStatusResponse, ApiResponse, PaginatedResponse } from '@/types';
import { MOCK_PROJECTS_DATA, MOCK_PROJECT_DETAIL } from './data/projects.mock';

export const mockProjectsService = {
  async getProjects(): Promise<PaginatedResponse<Project>> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      items: MOCK_PROJECTS_DATA,
      total: MOCK_PROJECTS_DATA.length,
      page: 1,
      limit: 10,
      hasMore: false,
    };
  },

  async createProject(_url: string): Promise<ProjectCreateResponse> {
    console.warn('🔧 Using MOCK data for project creation');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newProjectId = `project-${Date.now()}`;
    
    return {
      projectId: newProjectId,
      status: 'processing',
    };
  },

  async getProjectStatus(_projectId: string): Promise<ProjectStatusResponse> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return {
      status: 'completed',
      progress: 100,
    };
  },

  async getProject(projectId: string): Promise<ApiResponse<Project>> {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const project = MOCK_PROJECTS_DATA.find(p => p.id === projectId) || MOCK_PROJECT_DETAIL;
    
    return {
      success: true,
      data: project,
    };
  },

  async updateProject(projectId: string, updates: Partial<Project>): Promise<ApiResponse<Project>> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const project = MOCK_PROJECTS_DATA.find(p => p.id === projectId) || MOCK_PROJECT_DETAIL;
    const updatedProject = { ...project, ...updates, updatedAt: new Date().toISOString() };
    
    return {
      success: true,
      data: updatedProject,
    };
  },

  async deleteProject(_projectId: string): Promise<ApiResponse<void>> {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    return {
      success: true,
    };
  },
};