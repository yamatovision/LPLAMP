import { Replica, ApiResponse } from '@/types';
import { MOCK_REPLICA_DATA } from './data/replica.mock';

export const mockReplicaService = {
  async getReplica(_projectId: string): Promise<ApiResponse<Replica>> {
    console.warn('🔧 Using MOCK data for replica');
    await new Promise(resolve => setTimeout(resolve, 600));
    
    return {
      success: true,
      data: MOCK_REPLICA_DATA,
    };
  },

  async updateReplica(_projectId: string, updates: Partial<Replica>): Promise<ApiResponse<Replica>> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const updatedReplica = {
      ...MOCK_REPLICA_DATA,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    return {
      success: true,
      data: updatedReplica,
    };
  },
};