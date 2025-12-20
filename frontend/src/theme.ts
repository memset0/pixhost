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
    h6: {
      fontWeight: 700,
    },
  },
  shape: {
    borderRadius: 12,
  },
  // 任务：确保卡片内容在所有位置都使用统一内边距，并移除 extra padding-bottom
  // 方案：通过 MuiCardContent 的 styleOverrides 把根节点 padding 设为 16 并把最后一项的 padding-bottom 也固定为 16
  components: {
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 16,
          "&:last-child": {
            paddingBottom: 16,
          },
        },
      },
    },
  },
});
