// 任务：定义全局主题与字体，保证界面风格统一
// 方案：设置自定义字体栈与颜色系统，避免默认样式

import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#2d6a4f" },
    secondary: { main: "#f4a261" },
    background: { default: "#f7f3ef", paper: "#ffffff" },
  },
  typography: {
    fontFamily: '"Noto Serif SC", "Source Han Serif SC", "PingFang SC", serif',
  },
  shape: {
    borderRadius: 12,
  },
});
