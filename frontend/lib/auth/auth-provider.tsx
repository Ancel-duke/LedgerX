'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { authService, type MeResponse } from '@/services/api/auth.service';
import type { User, Organization } from '@/types';

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  organizations: Array<{ id: string; name: string; slug: string }>;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  refetchMe: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetchMe = useCallback(async () => {
    const token = Cookies.get('accessToken');
    if (!token) return;
    try {
      const data: MeResponse = await authService.getMe();
      setUser(data.user);
      setOrganization(data.organization);
      setOrganizations(data.organizations ?? []);
    } catch {
      Cookies.remove('accessToken');
      Cookies.remove('refreshToken');
      setUser(null);
      setOrganization(null);
      setOrganizations([]);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const token = Cookies.get('accessToken');
      if (token) {
        await refetchMe();
      }
      setIsLoading(false);
    };
    initAuth();
  }, [refetchMe]);

  const login = async (email: string, password: string) => {
    const response = await authService.login(email, password);
    Cookies.set('accessToken', response.accessToken, { expires: 1 });
    Cookies.set('refreshToken', response.refreshToken, { expires: 7 });
    setUser(response.user);
    const data: MeResponse = await authService.getMe();
    setOrganization(data.organization);
    setOrganizations(data.organizations ?? []);
  };

  const logout = () => {
    Cookies.remove('accessToken');
    Cookies.remove('refreshToken');
    setUser(null);
    setOrganization(null);
    setOrganizations([]);
  };

  const refreshToken = async () => {
    const refreshTokenValue = Cookies.get('refreshToken');
    if (!refreshTokenValue) throw new Error('No refresh token available');
    const response = await authService.refreshToken(refreshTokenValue);
    Cookies.set('accessToken', response.accessToken, { expires: 1 });
    if (response.refreshToken) {
      Cookies.set('refreshToken', response.refreshToken, { expires: 7 });
    }
  };

  const switchOrganization = async (organizationId: string) => {
    const tokens = await authService.switchOrganization(organizationId);
    Cookies.set('accessToken', tokens.accessToken, { expires: 1 });
    Cookies.set('refreshToken', tokens.refreshToken, { expires: 7 });
    await refetchMe();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        organizations,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshToken,
        refetchMe,
        switchOrganization,
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
