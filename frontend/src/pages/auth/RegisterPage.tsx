// 任务：实现注册页面并进行前端校验
// 方案：提交注册信息到 /auth/register，提示等待审批

import React, { useState } from "react";
import { Box, Button, Card, CardContent, TextField, Typography, Alert } from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import api from "../../api/client";

const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    if (password.length < 6) {
      setError("密码长度至少 6 个字符");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    try {
      await api.post("/auth/register", { username, email, password });
      setSuccess("注册成功，请等待管理员审批");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "注册失败");
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card sx={{ width: 460 }}>
        <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            注册 Pixhost
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
          <TextField label="用户名" value={username} onChange={(e) => setUsername(e.target.value)} />
          <TextField label="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField
            label="密码"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <TextField
            label="确认密码"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <Button variant="contained" onClick={handleSubmit} sx={{ fontWeight: 600 }}>
            注册
          </Button>
          <Button component={RouterLink} to="/login" sx={{ textTransform: "none" }}>
            已有账号？去登录
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default RegisterPage;
