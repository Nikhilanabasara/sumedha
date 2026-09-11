import { useState, useEffect, type ReactNode } from 'react';
import { GraduationCap, LogOut, Moon, Sun, Menu, X, LayoutDashboard, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

interface Props {
  children: ReactNode;
  view: 'student' | 'admin';
  onNavigate: (view: 'student' | 'admin') => void;
}

export default function Layout({ children, view, onNavigate }: Props) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isAdmin = profile?.role === 'admin';

  const navItems = [
    { key: 'student' as const, label: 'My Lessons', icon: LayoutDashboard },
    ...(isAdmin ? [{ key: 'admin' as const, label: 'Admin Panel', icon: Shield }] : []),
  ];

  return (
    <div className="min-h-screen bg-app">
      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled ? 'bg-surface/90 backdrop-blur-lg border-b border-app shadow-sm' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-app text-app"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="font-bold text-lg tracking-tight">EduStream</span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`px-4 py-2 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${
                  view === item.key
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-muted hover:text-app hover:bg-app'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl text-muted hover:text-app hover:bg-app transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-app">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold">
                {profile?.name?.charAt(0).toUpperCase() || '?'}
              </div>
              <span className="text-sm font-medium max-w-[120px] truncate">{profile?.name}</span>
            </div>
            <button
              onClick={signOut}
              className="p-2.5 rounded-xl text-muted hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-surface border-r border-app p-5 animate-slide-in-right">
            <div className="flex items-center justify-between mb-8">
              <span className="font-bold text-lg">Menu</span>
              <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-lg hover:bg-app">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => { onNavigate(item.key); setDrawerOpen(false); }}
                  className={`w-full px-4 py-3 rounded-xl font-medium text-left flex items-center gap-3 transition-colors ${
                    view === item.key
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'text-muted hover:text-app hover:bg-app'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="mt-auto absolute bottom-5 left-5 right-5 pt-4 border-t border-app">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold">
                  {profile?.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <div className="font-medium text-sm">{profile?.name}</div>
                  <div className="text-xs text-muted capitalize">{profile?.role}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="pt-16">
        {children}
      </main>
    </div>
  );
}
