import { Project, ProjectStatus } from '@/types';

export const MOCK_PROJECTS_DATA: Project[] = [
  {
    id: 'project-1',
    name: 'サンプルECサイト',
    url: 'https://example-ecommerce.com',
    thumbnail: 'https://via.placeholder.com/300x200/4F46E5/white?text=EC+Site',
    githubRepo: 'demo-user/sample-ecommerce',
    deploymentUrl: 'https://sample-ecommerce.vercel.app',
    userId: 'user-1',
    status: ProjectStatus.READY,
    createdAt: '2025-01-08T10:00:00Z',
    updatedAt: '2025-01-09T15:30:00Z',
  },
  {
    id: 'project-2',
    name: 'コーポレートサイト',
    url: 'https://example-corporate.com',
    thumbnail: 'https://via.placeholder.com/300x200/10B981/white?text=Corporate',
    githubRepo: 'demo-user/corporate-site',
    deploymentUrl: null,
    userId: 'user-1',
    status: ProjectStatus.READY,
    createdAt: '2025-01-07T14:20:00Z',
    updatedAt: '2025-01-09T09:15:00Z',
  },
  {
    id: 'project-3',
    name: 'ランディングページ',
    url: 'https://example-landing.com',
    thumbnail: 'https://via.placeholder.com/300x200/F59E0B/white?text=Landing',
    githubRepo: null,
    deploymentUrl: null,
    userId: 'user-1',
    status: ProjectStatus.CREATING,
    createdAt: '2025-01-09T16:00:00Z',
    updatedAt: '2025-01-09T16:00:00Z',
  },
];

export const MOCK_PROJECT_DETAIL = MOCK_PROJECTS_DATA[0];