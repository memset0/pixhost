// 任务：瀑布流浏览与标签筛选
// 方案：React Query 无限分页 + IntersectionObserver 自动加载

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  ImageList,
  ImageListItem,
  Stack,
  TextField,
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Tooltip,
  Snackbar,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import api from "../api/client";

const fetchImages = async (page: number, tags: string, tagMode: string) => {
  const response = await api.get("/images", {
    params: {
      page,
      tags: tags || undefined,
      tag_mode: tagMode,
    },
  });
  return response.data;
};

// 任务：卡片图片使用占位符->缩略图->原图的三段式加载，替换掉骨架屏
// 方案：先显示柔和渐变背景占位，缩略图 onLoad 后淡入，再预加载 public_url 原图并以透明度过渡覆盖
type ProgressiveImageProps = {
  thumbnail: { format: string; data_base64: string };
  fullSrc: string;
  alt: string;
};

const ProgressiveImage: React.FC<ProgressiveImageProps> = ({ thumbnail, fullSrc, alt }) => {
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);
  const thumbSrc = useMemo(() => `data:image/${thumbnail.format};base64,${thumbnail.data_base64}`, [thumbnail]);

  useEffect(() => {
    setThumbLoaded(false);
    setFullLoaded(false);
  }, [thumbSrc, fullSrc]);

  useEffect(() => {
    if (!thumbLoaded) return;
    const img = new Image();
    img.src = fullSrc;
    img.onload = () => setFullLoaded(true);
    return () => {
      img.onload = null;
    };
  }, [thumbLoaded, fullSrc]);

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: 200,
        borderRadius: 2,
        overflow: "hidden",
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        background: "linear-gradient(120deg, #f3ede4 0%, #e6d9c8 100%)",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          opacity: thumbLoaded ? 0 : 1,
          transition: "opacity 200ms ease",
          background: "linear-gradient(135deg, rgba(0,0,0,0.04), rgba(0,0,0,0.08))",
        }}
      />
      <Box
        component="img"
        src={thumbSrc}
        alt={alt}
        onLoad={() => setThumbLoaded(true)}
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: fullLoaded ? "blur(0px)" : "blur(2px)",
          opacity: thumbLoaded && !fullLoaded ? 1 : 0,
          transition: "opacity 220ms ease, filter 220ms ease",
        }}
      />
      {thumbLoaded && (
        <Box
          component="img"
          src={fullSrc}
          alt={alt}
          onLoad={() => setFullLoaded(true)}
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: fullLoaded ? 1 : 0,
            transition: "opacity 260ms ease",
          }}
        />
      )}
    </Box>
  );
};

const BrowsePage: React.FC = () => {
  const [tags, setTags] = useState("");
  const [tagMode, setTagMode] = useState("all");
  const [notice, setNotice] = useState("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const theme = useTheme();
  const upSm = useMediaQuery(theme.breakpoints.up("sm"));
  const upMd = useMediaQuery(theme.breakpoints.up("md"));
  const cols = upMd ? 3 : upSm ? 2 : 1;

  const query = useInfiniteQuery({
    queryKey: ["images", tags, tagMode],
    queryFn: ({ pageParam = 1 }) => fetchImages(pageParam, tags, tagMode),
    getNextPageParam: (lastPage) => {
      const current = lastPage.page * lastPage.page_size;
      if (current >= lastPage.total) return undefined;
      return lastPage.page + 1;
    },
  });

  const items = useMemo(() => {
    return query.data?.pages.flatMap((page: any) => page.items) || [];
  }, [query.data]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
        query.fetchNextPage();
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [query.hasNextPage, query.isFetchingNextPage]);

  // 任务：为列表图片提供一键复制外链的交互
  // 方案：使用后端返回的 public_url，通过剪贴板 API 写入并轻提示
  const copyLink = async (url?: string) => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setNotice("已复制图片链接");
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        浏览图片
      </Typography>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
        <TextField
          label="标签过滤 (逗号分隔)"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          sx={{ flex: 1 }}
        />
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel id="tag-mode-label">模式</InputLabel>
          <Select
            labelId="tag-mode-label"
            value={tagMode}
            label="模式"
            onChange={(event) => setTagMode(event.target.value)}
          >
            <MenuItem value="all">全部</MenuItem>
            <MenuItem value="any">任意</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <ImageList variant="masonry" cols={cols} gap={16} sx={{ m: 0 }}>
        {items.map((item: any) => (
          <ImageListItem
            key={item.id}
            component={RouterLink as any}
            to={`/images/${item.id}`}
            sx={{ textDecoration: "none", position: "relative" }}
          >
            <Tooltip title="复制外链">
              <IconButton
                size="small"
                sx={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  backgroundColor: "rgba(0,0,0,0.35)",
                  color: "#fff",
                  "&:hover": { backgroundColor: "rgba(0,0,0,0.5)" },
                  zIndex: 1,
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  copyLink(item.public_url);
                }}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <ProgressiveImage thumbnail={item.thumbnail} fullSrc={item.public_url} alt={`image-${item.id}`} />
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
              {item.tags.slice(0, 3).map((tag: string) => (
                <Chip key={tag} label={tag} size="small" />
              ))}
            </Stack>
          </ImageListItem>
        ))}
      </ImageList>
      {items.length === 0 && !query.isLoading && (
        <Typography variant="body1" color="text.secondary">
          暂无图片，先去上传吧。
        </Typography>
      )}
      <Box ref={sentinelRef} sx={{ height: 1 }} />
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={1500}
        onClose={() => setNotice("")}
        message={notice}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Stack>
  );
};

export default BrowsePage;
