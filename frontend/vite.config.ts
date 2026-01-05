// 任务：配置 Vite 开发服务器与 API 代理，并确保非 localhost 也能访问；将 memset0.cn 加入允许的 host 列表
// 方案：支持容器网络可配置的后端地址（优先读取环境变量 VITE_BACKEND_ORIGIN，未提供时回落到本地 6007 端口），同时将 dev/preview host 绑定到 0.0.0.0 并补充 host 白名单

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendOrigin =
  process.env.VITE_BACKEND_ORIGIN?.trim() || "http://localhost:6007";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: ["memset0.cn"],
    proxy: {
      "/api": backendOrigin,
      // 任务：开发环境下让 /images 走后端服务，保证图片直链可用
      // 方案：Vite proxy 追加 /images 指向同一后端
      "/images": backendOrigin,
    },
    watch: {
      ignored: ["**/.pnpm-store/**", "**/node_modules/**"],
    },
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: ["memset0.cn"],
  },
});
