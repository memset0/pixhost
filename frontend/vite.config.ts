// 任务：配置 Vite 开发服务器与 API 代理
// 方案：本地开发时将 /api 代理到后端端口

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:6007",
    },
  },
});
