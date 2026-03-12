import React, { createContext, useContext, useState } from 'react';

export type Role = 'commuter' | 'driver' | 'lgu';

interface AuthState {
  role: Role | null;
  login: (role: Role) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = 'ptis_role';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'commuter' || stored === 'driver' || stored === 'lgu') {
      return stored;
    }
    return null;
  });

  const login = (newRole: Role) => {
    setRole(newRole);
    localStorage.setItem(STORAGE_KEY, newRole);
  };

  const logout = () => {
    setRole(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
