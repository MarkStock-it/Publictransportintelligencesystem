import React, { createContext, useContext, useEffect, useState } from 'react';

export type Role = 'commuter' | 'driver' | 'lgu';

interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: Role;
}

interface LoginResult {
  ok: boolean;
  role?: Role;
  error?: string;
}

interface AuthState {
  user: AuthUser | null;
  role: Role | null;
  token: string | null;
  login: (username: string, password: string) => Promise<LoginResult>;
  register: (payload: {
    username: string;
    password: string;
    name: string;
    role: Role;
  }) => Promise<LoginResult>;
  refreshMe: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_TOKEN_KEY = 'ptis_token';
const STORAGE_USER_KEY = 'ptis_user';

const getStoredUser = (): AuthUser | null => {
  const raw = localStorage.getItem(STORAGE_USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed?.role === 'commuter' || parsed?.role === 'driver' || parsed?.role === 'lgu') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(getStoredUser);
  const role = user?.role ?? null;

  const persistSession = (nextToken: string, nextUser: AuthUser) => {
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem(STORAGE_TOKEN_KEY, nextToken);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(nextUser));
  };

  const login = async (username: string, password: string): Promise<LoginResult> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        return { ok: false, error: data?.message ?? 'Login failed' };
      }

      persistSession(data.token, data.user);
      return { ok: true, role: data.user.role };
    } catch {
      return { ok: false, error: 'Backend unavailable. Start the backend server.' };
    }
  };

  const register = async (payload: {
    username: string;
    password: string;
    name: string;
    role: Role;
  }): Promise<LoginResult> => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        return { ok: false, error: data?.message ?? 'Registration failed' };
      }

      persistSession(data.token, data.user);
      return { ok: true, role: data.user.role };
    } catch {
      return { ok: false, error: 'Backend unavailable. Start the backend server.' };
    }
  };

  const refreshMe = async () => {
    const activeToken = token ?? localStorage.getItem(STORAGE_TOKEN_KEY);
    if (!activeToken) return;

    try {
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });

      if (!response.ok) {
        logout();
        return;
      }

      const data = await response.json();
      setUser(data.user);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.user));
    } catch {
      // Keep cached user during temporary network problems.
    }
  };

  useEffect(() => {
    if (token) {
      void refreshMe();
    }
    // Run only when token changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, role, token, login, register, refreshMe, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
