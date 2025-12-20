// 任务：统一封装 API 客户端，自动带上 JWT
// 方案：axios 实例 + 请求拦截器读取本地 token

import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pixhost_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
