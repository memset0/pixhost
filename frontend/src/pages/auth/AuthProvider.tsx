// 任务：维护登录状态并在页面刷新后恢复用户信息
// 方案：localStorage 持久化 token，并在启动时拉取 /users/me

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../../api/client";

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  role: string;
};

type AuthContextValue = {
  token: string;
  role: string;
  user: AuthUser | null;
  loading: boolean;
  login: (token: string, role: string) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("pixhost_token") || "");
  const [role, setRole] = useState(localStorage.getItem("pixhost_role") || "");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const response = await api.get<AuthUser>("/users/me");
      setUser(response.data);
      setRole(response.data.role);
      localStorage.setItem("pixhost_role", response.data.role);
    } catch (err) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [token]);

  const login = (newToken: string, newRole: string) => {
    localStorage.setItem("pixhost_token", newToken);
    localStorage.setItem("pixhost_role", newRole);
    setToken(newToken);
    setRole(newRole);
  };

  const logout = () => {
    localStorage.removeItem("pixhost_token");
    localStorage.removeItem("pixhost_role");
    setToken("");
    setRole("");
    setUser(null);
  };

  const value = useMemo(
    () => ({ token, role, user, loading, login, logout, refreshUser }),
    [token, role, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("AuthContext missing");
  }
  return ctx;
};
