import { useState, type FormEvent } from 'react';
import { GraduationCap, Eye, EyeOff, Loader2, Moon, Sun } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/context/ThemeContext';

type Mode = 'signin' | 'signup';

export default function AuthPage() {
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name, phone, role: 'student' },
          },
        });
        if (signUpError) throw signUpError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-app flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 30% 50%, white 2px, transparent 2px)',
          backgroundSize: '40px 40px',
        }} />
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <GraduationCap className="w-7 h-7" />
            </div>
            <span className="text-2xl font-bold tracking-tight">EduStream</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Tuition Classes,<br />Reimagined.
          </h1>
          <p className="text-lg text-white/80 leading-relaxed max-w-md">
            Stream recorded lessons organized by grade and month. Adaptive quality,
            protected content, and a beautiful learning experience.
          </p>
          <div className="mt-12 space-y-4">
            {['Grade 9 · 10 · 11 organized content', 'Monthly lesson structure', 'Secure streaming with watermarking'].map((feat) => (
              <div key={feat} className="flex items-center gap-3 text-white/90">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm">✓</div>
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
        <button
          onClick={toggleTheme}
          className="absolute top-6 right-6 p-2.5 rounded-xl bg-surface border border-app text-muted hover:text-app transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-2xl bg-primary-600 flex items-center justify-center text-white">
              <GraduationCap className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold">EduStream</span>
          </div>

          <h2 className="text-3xl font-bold mb-2">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-muted mb-8">
            {mode === 'signin' ? 'Sign in to access your lessons' : 'Join to start learning today'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <>
                <Field label="Full Name">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    placeholder="John Doe"
                  />
                </Field>
                <Field label="Phone Number">
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                    placeholder="+94 77 123 4567"
                  />
                </Field>
              </>
            )}

            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
            </Field>

            <Field label="Password">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-12`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-app transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </Field>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-error-50 dark:bg-error-900/20 border border-error-100 dark:border-error-800 text-error-700 dark:text-error-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-muted">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError('');
              }}
              className="text-primary-600 dark:text-primary-400 font-semibold hover:underline"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  'w-full px-4 py-3 rounded-xl bg-surface border-2 border-app text-app placeholder:text-muted focus:border-primary-500 focus:outline-none transition-colors';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-muted mb-2">{label}</label>
      {children}
    </div>
  );
}
