// 任务：实现登录页面与登录请求
// 方案：提交用户名密码到 /auth/login，成功后保存 token

import React, { useState } from "react";
import { Box, Button, Card, CardContent, TextField, Typography, Alert } from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import api from "../../api/client";
import { useAuth } from "./AuthProvider";

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, refreshUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setError("");
    try {
      const response = await api.post("/auth/login", { username, password });
      login(response.data.access_token, response.data.role);
      await refreshUser();
      navigate(response.data.role === "pending" ? "/settings" : "/browse");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "登录失败");
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card sx={{ width: 420 }}>
        <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            登录 Pixhost
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="用户名" value={username} onChange={(e) => setUsername(e.target.value)} />
          <TextField
            label="密码"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button variant="contained" onClick={handleSubmit} sx={{ fontWeight: 600 }}>
            登录
          </Button>
          <Button component={RouterLink} to="/register" sx={{ textTransform: "none" }}>
            没有账号？去注册
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginPage;
