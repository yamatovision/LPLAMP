import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import EditorLayout from '@/layouts/EditorLayout';
import { Project, Replica } from '@/types';

export default function Editor() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [replica, setReplica] = useState<Replica | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  useEffect(() => {
    if (projectId) {
      loadProjectData();
    }
  }, [projectId]);

  const loadProjectData = async () => {
    if (!projectId) return;

    try {
      setIsLoading(true);
      const { projectsService, replicaService } = await import('@/services');
      
      const [projectResponse, replicaResponse] = await Promise.all([
        projectsService.getProject(projectId),
        replicaService.getReplica(projectId),
      ]);

      if (projectResponse.success && projectResponse.data) {
        setProject(projectResponse.data);
      }

      if (replicaResponse.success && replicaResponse.data) {
        setReplica(replicaResponse.data);
      }
    } catch (error) {
      console.error('プロジェクトデータの取得に失敗:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
        <EditorLayout projectName="読み込み中...">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
          </div>
        </EditorLayout>
    );
  }

  if (!project || !replica) {
    return (
        <EditorLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="text-red-500 text-lg mb-2">プロジェクトが見つかりません</div>
              <div className="text-gray-500">指定されたプロジェクトが存在しないか、アクセス権限がありません</div>
            </div>
          </div>
        </EditorLayout>
    );
  }

  return (
      <EditorLayout 
        projectName={project.name} 
        saveStatus={saveStatus}
      >
        <div className="flex-1 bg-gray-100">
          {/* レプリカビューワー */}
          <div className="h-full p-4">
            <div className="bg-white rounded-lg shadow-sm h-full overflow-auto">
              <div className="p-4 border-b">
                <h3 className="text-lg font-medium text-gray-900">
                  レプリカプレビュー
                </h3>
                <p className="text-sm text-gray-500">
                  要素をクリックして編集を開始してください
                </p>
              </div>
              
              <div className="p-4">
                {/* レプリカHTML表示エリア */}
                <div className="border rounded-lg">
                  <iframe
                    srcDoc={replica.html}
                    className="w-full h-96 border-0 rounded-lg"
                    title="レプリカプレビュー"
                  />
                </div>
                
                {/* 編集情報パネル */}
                <div className="mt-4 bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">編集方法</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• プレビュー内の要素をクリックして選択</li>
                    <li>• 浮動ツールバーから編集方法を選択</li>
                    <li>• AI編集ではClaudeCodeターミナルが自動起動</li>
                    <li>• 変更は自動的に保存されます</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </EditorLayout>
  );
}