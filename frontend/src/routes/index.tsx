import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Editor from '@/pages/Editor';
import Export from '@/pages/Export';
import AuthCallback from '@/pages/AuthCallback';
import ProtectedRoute from './ProtectedRoute';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* M-000: ログインページ */}
        <Route path="/login" element={<Login />} />
        
        {/* 認証コールバック */}
        <Route path="/auth/callback" element={<AuthCallback />} />
        
        {/* M-001: ダッシュボード（認証必須） */}
        <Route path="/" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        {/* M-002: プロジェクトエディター */}
        <Route path="/editor/:projectId" element={
          <ProtectedRoute>
            <Editor />
          </ProtectedRoute>
        } />
        
        {/* M-003: エクスポート画面 */}
        <Route path="/export/:projectId" element={
          <ProtectedRoute>
            <Export />
          </ProtectedRoute>
        } />
        
        {/* 不正なパスは認証確認後リダイレクト */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}