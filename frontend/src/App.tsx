// 任务：定义前端路由与权限守卫
// 方案：基于角色控制页面访问，pending 用户引导至设置页

import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";

import Layout from "./components/Layout";
import { useAuth } from "./pages/auth/AuthProvider";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import UploadPage from "./pages/UploadPage";
import BrowsePage from "./pages/BrowsePage";
import ImageDetailPage from "./pages/ImageDetailPage";
import SettingsPage from "./pages/SettingsPage";

const LoadingScreen = () => (
  <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <CircularProgress />
  </Box>
);

const RequireAuth: React.FC = () => {
  const { token, loading } = useAuth();
  if (loading) {
    return <LoadingScreen />;
  }
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

const RequireRole: React.FC<{ roles: string[]; children: React.ReactNode }> = ({ roles, children }) => {
  const { role } = useAuth();
  if (!roles.includes(role)) {
    return <Navigate to="/settings" replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  const { token, role } = useAuth();
  const defaultPath = token ? (role === "pending" ? "/settings" : "/browse") : "/login";

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={defaultPath} replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<RequireAuth />}>
          <Route
            path="/upload"
            element={
              <RequireRole roles={["user", "admin"]}>
                <UploadPage />
              </RequireRole>
            }
          />
          <Route
            path="/browse"
            element={
              <RequireRole roles={["user", "admin"]}>
                <BrowsePage />
              </RequireRole>
            }
          />
          <Route
            path="/images/:id"
            element={
              <RequireRole roles={["user", "admin"]}>
                <ImageDetailPage />
              </RequireRole>
            }
          />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to={defaultPath} replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
