import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';
import type { AuthPayload, MeResponse, User } from '../types/api';

export type { User };

interface AuthCtx {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, name: string, password: string, role?: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('accessToken'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('accessToken');
    if (stored) {
      api.get<MeResponse>('/auth/me')
        .then((data) => {
          if (!data?.user) throw new Error('Invalid session');
          setUser(data.user);
        })
        .catch(() => { localStorage.clear(); setToken(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const persistSession = (data: AuthPayload | undefined) => {
    if (!data?.accessToken || !data.refreshToken || !data.user) {
      throw new Error('Unexpected response from server');
    }
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setToken(data.accessToken);
    setUser(data.user);
  };

  const login = async (email: string, password: string) => {
    const data = await api.post<AuthPayload>('/auth/login', { email, password });
    persistSession(data);
  };

  const signup = async (email: string, name: string, password: string, role = 'user') => {
    const data = await api.post<AuthPayload>('/auth/signup', { email, name, password, role });
    persistSession(data);
  };

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
