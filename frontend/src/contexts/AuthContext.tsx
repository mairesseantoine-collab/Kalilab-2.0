import React, { createContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole, LoginResponse } from '../types';
import { authApi } from '../api/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('kalilab-token');
    const savedUser = localStorage.getItem('kalilab-user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('kalilab-user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    const data = response.data as LoginResponse;
    const user: User = {
      id: data.user_id,
      uuid: '',
      nom: data.nom,
      prenom: data.prenom,
      email,
      role: data.role as UserRole,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    localStorage.setItem('kalilab-token', data.access_token);
    localStorage.setItem('kalilab-user', JSON.stringify(user));
    setUser(user);
  }, []);

  const logout = useCallback(() => {
    authApi.logout().catch(() => {});
    localStorage.removeItem('kalilab-token');
    localStorage.removeItem('kalilab-user');
    setUser(null);
    window.location.href = '/login';
  }, []);

  const hasRole = useCallback((...roles: UserRole[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

import { useContext } from 'react';
export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
