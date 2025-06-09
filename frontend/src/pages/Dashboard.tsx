import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import { Project, ProjectCreate } from '@/types';
import GitHubIntegrationOptions from '@/components/features/github/GitHubIntegrationOptions';

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newProjectUrl, setNewProjectUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showGitHubOptions, setShowGitHubOptions] = useState(false);
  const [gitHubOptions, setGitHubOptions] = useState<any>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const { projectsService } = await import('@/services');
      const response = await projectsService.getProjects();
      if (response.data) {
        setProjects(response.data.projects);
      }
    } catch (error) {
      console.error('プロジェクトの取得に失敗:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectUrl || isCreating) return;

    setIsCreating(true);
    try {
      const { projectsService } = await import('@/services');
      
      // GitHub連携オプションを含めたプロジェクト作成データ
      const projectData: ProjectCreate = {
        url: newProjectUrl,
        ...gitHubOptions
      };
      
      const response = await projectsService.createProject(projectData);
      
      console.log('Dashboard: プロジェクト作成レスポンス:', response);
      console.log('Dashboard: response.data:', response.data);
      console.log('Dashboard: projectId:', response.data?.projectId);
      
      setNewProjectUrl('');
      setGitHubOptions(null);
      setShowGitHubOptions(false);
      
      if (response.data?.projectId) {
        console.log('Dashboard: エディターにリダイレクト中:', response.data.projectId);
        window.location.href = `/editor/${response.data.projectId}`;
      } else {
        console.error('Dashboard: projectIdが取得できませんでした');
        console.error('Dashboard: レスポンス構造:', JSON.stringify(response, null, 2));
      }
    } catch (error) {
      console.error('プロジェクトの作成に失敗:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
        <MainLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
          </div>
        </MainLayout>
    );
  }

  return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* URL入力セクション */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              新しいプロジェクトを開始
            </h2>
            <form onSubmit={handleCreateProject}>
              {/* 基本URL入力 */}
              <div className="flex gap-4 mb-4">
                <input
                  type="url"
                  value={newProjectUrl}
                  onChange={(e) => setNewProjectUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <button
                  type="submit"
                  disabled={isCreating || !newProjectUrl}
                  className="px-6 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? '作成中...' : '作成開始'}
                </button>
              </div>
              
              {/* GitHub連携オプション（段階的開示） */}
              <div className="border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowGitHubOptions(!showGitHubOptions)}
                  className="flex items-center text-sm text-gray-600 hover:text-gray-800"
                >
                  <span className="mr-2">
                    {showGitHubOptions ? '▼' : '▶'}
                  </span>
                  GitHub連携オプション（自動デプロイ）
                </button>
                
                {showGitHubOptions && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <GitHubIntegrationOptions
                      onOptionsChange={setGitHubOptions}
                    />
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* プロジェクト一覧 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              あなたのプロジェクト
            </h2>
            
            {projects.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-lg mb-2">プロジェクトがありません</div>
                <div className="text-gray-500 text-sm">上のフォームからURLを入力して最初のプロジェクトを作成しましょう</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    to={`/editor/${project.id}`}
                    className="group block bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow"
                  >
                    <div className="aspect-video bg-gray-100 rounded-t-lg overflow-hidden">
                      {project.thumbnail ? (
                        <img
                          src={project.thumbnail}
                          alt={project.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <span>No Image</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="p-4">
                      <h3 className="font-medium text-gray-900 mb-2 truncate">
                        {project.name}
                      </h3>
                      <p className="text-sm text-gray-500 mb-2 truncate">
                        {project.url}
                      </p>
                      <div className="flex justify-between items-center text-xs text-gray-400">
                        <span>作成: {formatDate(project.createdAt)}</span>
                        <span>更新: {formatDate(project.updatedAt)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </MainLayout>
  );
}