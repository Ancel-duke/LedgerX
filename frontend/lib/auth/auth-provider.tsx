'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { authService } from '@/services/api/auth.service';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = Cookies.get('accessToken');
      if (token) {
        try {
          // Decode JWT token to get user info
          // In production, use a JWT library like 'jwt-decode'
          const payload = JSON.parse(atob(token.split('.')[1]));
          setUser({
            id: payload.sub,
            email: payload.email,
            firstName: '', // These would come from token or separate API call
            lastName: '',
            role: payload.role,
            organizationId: payload.organizationId,
          });
        } catch (error) {
          Cookies.remove('accessToken');
          Cookies.remove('refreshToken');
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authService.login(email, password);
    Cookies.set('accessToken', response.accessToken, { expires: 1 });
    Cookies.set('refreshToken', response.refreshToken, { expires: 7 });
    setUser(response.user);
  };

  const logout = () => {
    Cookies.remove('accessToken');
    Cookies.remove('refreshToken');
    setUser(null);
  };

  const refreshToken = async () => {
    const refreshTokenValue = Cookies.get('refreshToken');
    if (!refreshTokenValue) {
      throw new Error('No refresh token available');
    }

    const response = await authService.refreshToken(refreshTokenValue);
    Cookies.set('accessToken', response.accessToken, { expires: 1 });
    if (response.refreshToken) {
      Cookies.set('refreshToken', response.refreshToken, { expires: 7 });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
