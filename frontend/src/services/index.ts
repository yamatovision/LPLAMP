import { AuthStatusResponse, LoginResponse, Project, ProjectCreateResponse, ProjectStatusResponse, ApiResponse, PaginatedResponse, Replica } from '@/types';

import { mockAuthService } from './mock/auth.service';
import { mockProjectsService } from './mock/projects.service';
import { mockReplicaService } from './mock/replica.service';

export const authService = {
  async getAuthStatus(): Promise<AuthStatusResponse> {
    return mockAuthService.getAuthStatus();
  },

  async login(): Promise<LoginResponse> {
    return mockAuthService.login();
  },

  async logout(): Promise<void> {
    return mockAuthService.logout();
  },
};

export const projectsService = {
  async getProjects(): Promise<PaginatedResponse<Project>> {
    return mockProjectsService.getProjects();
  },

  async createProject(url: string): Promise<ProjectCreateResponse> {
    return mockProjectsService.createProject(url);
  },

  async getProjectStatus(projectId: string): Promise<ProjectStatusResponse> {
    return mockProjectsService.getProjectStatus(projectId);
  },

  async getProject(projectId: string): Promise<ApiResponse<Project>> {
    return mockProjectsService.getProject(projectId);
  },

  async updateProject(projectId: string, updates: Partial<Project>): Promise<ApiResponse<Project>> {
    return mockProjectsService.updateProject(projectId, updates);
  },

  async deleteProject(projectId: string): Promise<ApiResponse<void>> {
    return mockProjectsService.deleteProject(projectId);
  },
};

export const replicaService = {
  async getReplica(projectId: string): Promise<ApiResponse<Replica>> {
    return mockReplicaService.getReplica(projectId);
  },

  async updateReplica(projectId: string, updates: Partial<Replica>): Promise<ApiResponse<Replica>> {
    return mockReplicaService.updateReplica(projectId, updates);
  },
};