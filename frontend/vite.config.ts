// 任务：配置 Vite 开发服务器与 API 代理
// 方案：支持容器网络可配置的后端地址（优先读取环境变量 VITE_BACKEND_ORIGIN，未提供时回落到本地 6007 端口）

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendOrigin =
  process.env.VITE_BACKEND_ORIGIN?.trim() || "http://localhost:6007";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": backendOrigin,
    },
  },
});
