import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import { MockIndicator, withMockPrefix } from '@/utils/mockIndicator';
import { Project } from '@/types';

export default function Export() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exportFormat, setExportFormat] = useState<'html' | 'zip'>('html');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  const loadProject = async () => {
    if (!projectId) return;

    try {
      setIsLoading(true);
      const { projectsService } = await import('@/services');
      const response = await projectsService.getProject(projectId);

      if (response.success && response.data) {
        setProject(response.data);
      }
    } catch (error) {
      console.error('プロジェクトデータの取得に失敗:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!projectId) return;

    setIsExporting(true);
    try {
      console.warn('🔧 Using MOCK export functionality');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log(`エクスポート完了: ${exportFormat}形式`);
      alert(`${exportFormat.toUpperCase()}形式でのエクスポートが完了しました（モック）`);
    } catch (error) {
      console.error('エクスポートに失敗:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <MockIndicator>
        <MainLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
          </div>
        </MainLayout>
      </MockIndicator>
    );
  }

  if (!project) {
    return (
      <MockIndicator>
        <MainLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="text-red-500 text-lg mb-2">プロジェクトが見つかりません</div>
              <Link to="/" className="text-blue-600 hover:underline">
                ダッシュボードに戻る
              </Link>
            </div>
          </div>
        </MainLayout>
      </MockIndicator>
    );
  }

  return (
    <MockIndicator>
      <MainLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {withMockPrefix('エクスポート＆デプロイ')}
            </h1>
            <p className="text-gray-600">
              {withMockPrefix(project.name)} の完成物を書き出し・デプロイします
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* プレビュー */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <h2 className="text-lg font-medium text-gray-900">プレビュー</h2>
              </div>
              <div className="p-4">
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                  {project.thumbnail ? (
                    <img
                      src={project.thumbnail}
                      alt={project.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <span className="text-gray-400">プレビュー画像</span>
                  )}
                </div>
                <div className="mt-4">
                  <h3 className="font-medium text-gray-900">{project.name}</h3>
                  <p className="text-sm text-gray-500">{project.url}</p>
                </div>
              </div>
            </div>

            {/* エクスポート設定 */}
            <div className="space-y-6">
              {/* ローカルダウンロード */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  ローカルダウンロード
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      エクスポート形式
                    </label>
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value as 'html' | 'zip')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="html">HTML ファイル</option>
                      <option value="zip">ZIP アーカイブ</option>
                    </select>
                  </div>

                  <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExporting ? 'エクスポート中...' : 'ダウンロード'}
                  </button>
                </div>
              </div>

              {/* GitHub連携 */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  GitHub連携
                </h2>
                
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                  </div>
                  <p className="text-gray-500 mb-4">
                    GitHubと連携して自動デプロイを設定
                  </p>
                  <button className="px-4 py-2 bg-gray-800 text-white rounded-md font-medium hover:bg-gray-700">
                    GitHubと連携（準備中）
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 戻るリンク */}
          <div className="mt-8 text-center">
            <Link
              to={`/editor/${projectId}`}
              className="text-blue-600 hover:underline"
            >
              ← エディターに戻る
            </Link>
          </div>
        </div>
      </MainLayout>
    </MockIndicator>
  );
}