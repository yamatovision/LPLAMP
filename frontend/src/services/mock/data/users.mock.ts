import { User } from '@/types';

export const MOCK_USER_DATA: User = {
  id: 'user-1',
  githubId: '12345678',
  username: 'demo-user',
  email: 'demo@example.com',
  avatarUrl: 'https://avatars.githubusercontent.com/u/12345678?v=4',
  lastLoginAt: new Date().toISOString(),
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: new Date().toISOString(),
};