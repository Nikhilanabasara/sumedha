import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import AuthPage from '@/pages/AuthPage';
import Layout from '@/components/Layout';
import StudentDashboard from '@/pages/StudentDashboard';
import AdminDashboard from '@/pages/AdminDashboard';

function AppContent() {
  const { session, profile, loading } = useAuth();
  const [view, setView] = useState<'student' | 'admin'>('student');

  if (loading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthPage />;
  }

  const isAdmin = profile.role === 'admin';
  const effectiveView = view === 'admin' && !isAdmin ? 'student' : view;

  return (
    <Layout view={effectiveView} onNavigate={setView}>
      {effectiveView === 'admin' && isAdmin ? <AdminDashboard /> : <StudentDashboard />}
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
