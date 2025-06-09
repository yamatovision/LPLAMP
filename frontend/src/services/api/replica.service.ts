import { ApiResponse, Replica, ReplicaAsset, API_PATHS } from '@/types';
import { apiClient } from '../api-client';

export const replicaApiService = {
  async getReplica(projectId: string): Promise<ApiResponse<Replica>> {
    return apiClient.get<ApiResponse<Replica>>(API_PATHS.REPLICA.GET(projectId));
  },

  async updateReplica(projectId: string, updates: Partial<Replica>): Promise<ApiResponse<Replica>> {
    return apiClient.put<ApiResponse<Replica>>(API_PATHS.REPLICA.UPDATE(projectId), updates);
  },

  async getReplicaAssets(projectId: string): Promise<ApiResponse<ReplicaAsset[]>> {
    return apiClient.get<ApiResponse<ReplicaAsset[]>>(API_PATHS.REPLICA.ASSETS(projectId));
  },
};