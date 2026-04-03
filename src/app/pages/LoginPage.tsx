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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 mb-3">
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h8M8 11h4m-6 8l1.5-4.5M16 19l1.5-4.5M3 7h18l-2 12H5L3 7z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">LarGo</h1>
          <p className="mt-1 text-sm text-gray-500">Public Transport Intelligence System</p>
        </div>

        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex rounded-lg border border-gray-200 p-1">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 text-sm py-2 rounded-md transition-colors ${
                mode === 'login' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 text-sm py-2 rounded-md transition-colors ${
                mode === 'register' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              Register
            </button>
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Role</span>
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
              >
                <option value="commuter">Commuter</option>
                <option value="driver">Driver</option>
                <option value="lgu">LGU Officer</option>
              </select>
            </label>

            {mode === 'register' && (
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Full name</span>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Juan Dela Cruz"
                  required
                />
              </label>
            )}

            {mode === 'register' && role === 'driver' && (
              <>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Jeep ID</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm uppercase"
                    value={jeepId}
                    onChange={(event) => setJeepId(event.target.value)}
                    placeholder="JEEP-BD70"
                    pattern="^JEEP-[A-Z0-9]{2,10}$"
                    title="Use format JEEP-XXXX (letters/numbers only), e.g., JEEP-BD70"
                    required={role === 'driver'}
                  />
                  <p className="mt-1 text-[11px] text-gray-500">
                    Format: <span className="font-mono">JEEP-XXXX</span>. Example: <span className="font-mono">JEEP-BD70</span>
                  </p>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Route</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    value={jeepRoute}
                    onChange={(event) => setJeepRoute(event.target.value)}
                    required={role === 'driver'}
                  >
                    {AVAILABLE_ROUTES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </label>
              </>
            )}

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Username</span>
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="driver1"
                required
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Password</span>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </label>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 border border-red-100">{error}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {isSubmitting ? 'Please wait...' : submitLabel}
            </button>
          </form>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Demo users</p>
            <div className="grid grid-cols-1 gap-2">
              {DEMO_CREDENTIALS.map((creds) => (
                <button
                  key={creds.role}
                  type="button"
                  onClick={() => fillDemo(creds)}
                  className="w-full text-left border border-gray-200 rounded-lg px-3 py-2 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-gray-900 capitalize">{creds.role}</span>
                  <span className="block text-xs text-gray-500">{creds.username} / {creds.password}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">Simple backend auth is now enabled</p>
      </div>
    </div>
  );
}
