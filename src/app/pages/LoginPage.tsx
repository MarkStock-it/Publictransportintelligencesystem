import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, type Role } from '../context/AuthContext';

const DESTINATION_BY_ROLE: Record<Role, string> = {
  commuter: '/commuter',
  driver: '/driver',
  lgu: '/lgu',
};

const DEMO_CREDENTIALS = [
  { role: 'commuter', username: 'commuter1', password: 'commuter123' },
  { role: 'driver', username: 'driver1', password: 'driver123' },
  { role: 'lgu', username: 'lgu1', password: 'lgu123' },
] as const;

const AVAILABLE_ROUTES = [
  '04L - Lahug - Carbon',
  '06B - Bulacao - Ayala',
  '13C - Mabolo - Pier',
  '13T - Talamban - Banilad',
] as const;

const JEEP_ID_REGEX = /^JEEP-[A-Z0-9]{2,10}$/;

export default function LoginPage() {
  const { login, register, role: authRole } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('commuter');
  const [jeepId, setJeepId] = useState('');
  const [jeepRoute, setJeepRoute] = useState<string>(AVAILABLE_ROUTES[0]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitLabel = useMemo(() => (mode === 'login' ? 'Sign in' : 'Create account'), [mode]);

  useEffect(() => {
    if (authRole) {
      navigate(DESTINATION_BY_ROLE[authRole], { replace: true });
    }
  }, [authRole, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (mode === 'register' && role === 'driver') {
      const normalizedJeepId = jeepId.trim().toUpperCase();
      if (!JEEP_ID_REGEX.test(normalizedJeepId)) {
        setError('Invalid Jeep ID format. Use JEEP- followed by 2-10 letters/numbers (e.g., JEEP-BD70).');
        return;
      }
    }

    setIsSubmitting(true);

    const result = mode === 'login'
      ? await login(username, password)
      : await register({ username, password, name, role, jeepId: role === 'driver' ? jeepId.trim().toUpperCase() : undefined, route: role === 'driver' ? jeepRoute : undefined });

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? 'Authentication failed');
      return;
    }

    navigate(DESTINATION_BY_ROLE[result.role ?? role], { replace: true });
  };

  const fillDemo = (credentials: typeof DEMO_CREDENTIALS[number]) => {
    setMode('login');
    setRole(credentials.role);
    setUsername(credentials.username);
    setPassword(credentials.password);
    setName('');
    setError(null);
  };

  const ROLE_META: Record<Role, { label: string; emoji: string; desc: string }> = {
    commuter: { label: 'Commuter', emoji: '🚌', desc: 'Find your ride' },
    driver:   { label: 'Driver',   emoji: '🚐', desc: 'Share your location' },
    lgu:      { label: 'LGU',      emoji: '🏛️', desc: 'Monitor routes' },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-4 py-10 relative overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-blue-600/15 blur-[120px]" />

      <div className="relative z-10 w-full max-w-sm space-y-5">

        {/* Brand */}
        <div className="text-center space-y-1 pb-1">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-400/25 mb-3 shadow-xl shadow-indigo-950">
            <svg className="w-8 h-8 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M8 7h8M8 11h4m-6 8l1.5-4.5M16 19l1.5-4.5M3 7h18l-2 12H5L3 7z" />
            </svg>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">LarGo</h1>
          <p className="text-indigo-300/60 text-sm">See your ride before it sees you</p>
        </div>

        {/* Role picker */}
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(ROLE_META) as [Role, typeof ROLE_META[Role]][]).map(([r, meta]) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl text-center transition-all duration-150 border ${
                role === r
                  ? 'bg-indigo-500/30 border-indigo-400/60 text-white shadow-lg shadow-indigo-900/40'
                  : 'bg-white/[0.04] border-white/10 text-white/40 hover:bg-white/[0.08] hover:text-white/60'
              }`}
            >
              <span className="text-xl leading-none">{meta.emoji}</span>
              <span className="text-[11px] font-bold tracking-wide">{meta.label}</span>
            </button>
          ))}
        </div>

        {/* Glass card */}
        <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/10 rounded-2xl p-5 space-y-4 shadow-2xl">

          {/* Login / Register toggle */}
          <div className="flex gap-5 border-b border-white/10 pb-3">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`text-sm font-semibold pb-0.5 border-b-2 transition-all ${
                  mode === m
                    ? 'text-white border-indigo-400'
                    : 'text-white/30 border-transparent hover:text-white/50'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <input
                className="w-full rounded-xl bg-white/[0.07] border border-white/15 text-white placeholder-white/25 px-4 py-3 text-sm focus:outline-none focus:border-indigo-400/70 transition-colors"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                required
              />
            )}

            {mode === 'register' && role === 'driver' && (
              <>
                <input
                  className="w-full rounded-xl bg-white/[0.07] border border-white/15 text-white placeholder-white/25 px-4 py-3 text-sm uppercase tracking-wider focus:outline-none focus:border-indigo-400/70 transition-colors"
                  value={jeepId}
                  onChange={(e) => setJeepId(e.target.value)}
                  placeholder="Jeep ID — e.g. JEEP-BD70"
                  pattern="^JEEP-[A-Z0-9]{2,10}$"
                  title="Format: JEEP-XXXX"
                  required
                />
                <select
                  className="w-full rounded-xl bg-slate-800 border border-white/15 text-white/80 px-4 py-3 text-sm focus:outline-none focus:border-indigo-400/70 transition-colors"
                  value={jeepRoute}
                  onChange={(e) => setJeepRoute(e.target.value)}
                  required
                >
                  {AVAILABLE_ROUTES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </>
            )}

            <input
              className="w-full rounded-xl bg-white/[0.07] border border-white/15 text-white placeholder-white/25 px-4 py-3 text-sm focus:outline-none focus:border-indigo-400/70 transition-colors"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              required
              autoComplete="username"
            />
            <input
              type="password"
              className="w-full rounded-xl bg-white/[0.07] border border-white/15 text-white placeholder-white/25 px-4 py-3 text-sm focus:outline-none focus:border-indigo-400/70 transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />

            {error && (
              <div className="flex items-start gap-2 bg-red-500/15 border border-red-400/30 rounded-xl px-3 py-2.5">
                <span className="text-red-400 text-xs leading-relaxed">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-sm font-bold py-3 shadow-lg shadow-indigo-900/50 hover:from-indigo-400 hover:to-blue-400 disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {isSubmitting ? 'Please wait…' : submitLabel}
            </button>
          </form>
        </div>

        {/* Demo users */}
        <div className="text-center space-y-2">
          <p className="text-[11px] text-white/25 uppercase tracking-widest">Quick demo</p>
          <div className="flex justify-center gap-2">
            {DEMO_CREDENTIALS.map((creds) => (
              <button
                key={creds.role}
                type="button"
                onClick={() => fillDemo(creds)}
                className="px-4 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/50 hover:text-white/80 text-xs font-medium transition-all capitalize"
              >
                {creds.role}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
