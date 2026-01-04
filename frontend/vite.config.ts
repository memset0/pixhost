// 任务：配置 Vite 开发服务器与 API 代理，并确保非 localhost 也能访问
// 方案：支持容器网络可配置的后端地址（优先读取环境变量 VITE_BACKEND_ORIGIN，未提供时回落到本地 6007 端口），同时将 dev/preview host 绑定到 0.0.0.0

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendOrigin =
  process.env.VITE_BACKEND_ORIGIN?.trim() || "http://localhost:6007";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": backendOrigin,
    },
  },
  preview: {
    host: "0.0.0.0",
  },
});
