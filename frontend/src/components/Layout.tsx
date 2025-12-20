// 任务：提供统一的页面框架与导航栏
// 方案：使用 MUI AppBar + ToolBar + Container 布局，并添加滚动时显示阴影的交互效果

import React from "react";
import { AppBar, Toolbar, Typography, Button, Box, Container, Chip, useScrollTrigger } from "@mui/material";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { useAuth } from "../pages/auth/AuthProvider";

const navItems = [
  { label: "浏览", path: "/browse", restricted: true },
  { label: "上传", path: "/upload", restricted: true },
  { label: "设置", path: "/settings", restricted: false },
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, logout } = useAuth();
  const location = useLocation();

  const canAccessImages = role === "user" || role === "admin";

  // 任务：实现页面滚动时 AppBar 显示阴影，回到顶部时阴影消失
  // 方案：使用 MUI 的 useScrollTrigger 钩子监听滚动状态，动态调整 elevation 属性
  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 0,
  });

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar 
        position="sticky" 
        elevation={trigger ? 4 : 0} 
        sx={{ 
          backgroundColor: "#1f3c2f",
          transition: "box-shadow 0.3s ease-in-out" 
        }}
      >
        <Toolbar sx={{ display: "flex", gap: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
            Pixhost
          </Typography>
          {role && (
            <Chip
              label={`角色: ${role}`}
              size="small"
              sx={{ backgroundColor: "#2d6a4f", color: "#fff" }}
            />
          )}
          {navItems
            .filter((item) => (item.restricted ? canAccessImages : true))
            .map((item) => (
            <Button
              key={item.path}
              component={RouterLink}
              to={item.path}
              color={location.pathname === item.path ? "secondary" : "inherit"}
              variant={location.pathname === item.path ? "contained" : "text"}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              {item.label}
            </Button>
          ))}
          <Button
            color="inherit"
            variant="outlined"
            onClick={logout}
            sx={{ textTransform: "none", borderColor: "rgba(255,255,255,0.6)" }}
          >
            退出
          </Button>
        </Toolbar>
      </AppBar>
      <Container sx={{ py: 4 }}>{children}</Container>
    </Box>
  );
};

export default Layout;
