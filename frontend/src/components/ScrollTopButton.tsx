// 任务：在全站右下角提供滚动后出现的“回到顶部”圆形按钮，并使用 Grow 过渡
// 方案：监听 window.scrollY 控制 Grow + Fab 显隐，点击平滑滚回顶部，避免冗余 try-catch 遵循 let it crash

import React from "react";
import { Fab, Grow } from "@mui/material";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

const ScrollTopButton: React.FC = () => {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 200);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 任务：自定义更顺滑的回到顶部动画
  // 方案：使用 requestAnimationFrame + easeOutCubic 插值，驱动 document.scrollingElement 的 scrollTop
  const handleClick = () => {
    const el = document.scrollingElement || document.documentElement || document.body;
    const start = el.scrollTop;
    if (!Number.isFinite(start) || start <= 0) return;

    const duration = 420;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const startTime = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = easeOutCubic(progress);
      el.scrollTop = start * (1 - eased);
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  };

  return (
    <Grow in={visible}>
      <Fab
        color="primary"
        size="medium"
        onClick={handleClick}
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: (theme) => theme.zIndex.tooltip,
        }}
        aria-label="回到顶部"
      >
        <KeyboardArrowUpIcon />
      </Fab>
    </Grow>
  );
};

export default ScrollTopButton;
