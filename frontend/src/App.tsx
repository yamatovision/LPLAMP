import { AuthProvider } from '@/contexts/AuthContext';
import AppRouter from '@/routes';
import '@/styles/globals.css';

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}