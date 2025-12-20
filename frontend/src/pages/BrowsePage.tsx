// 任务：瀑布流浏览与标签筛选 + 动态列宽分配
// 方案：React Query 无限分页 + IntersectionObserver 自动加载 + 自定义瀑布流分栏(列宽固定、按最矮列落位、Grow 动画)

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Box,
  Grow,
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

type WaterfallMeta = {
  aspect: number;
  loaded: boolean;
  column: number | null;
  order: number | null;
};

const pickShortestColumn = (heights: number[]) => {
  let index = 0;
  for (let i = 1; i < heights.length; i += 1) {
    if (heights[i] < heights[index]) index = i;
  }
  return index;
};

const getColumnHeights = (metas: Record<string, WaterfallMeta>, columnWidth: number, cols: number) => {
  const heights = Array.from({ length: cols }, () => 0);
  Object.values(metas).forEach((meta) => {
    if (!meta.loaded || meta.column === null) return;
    heights[meta.column] += columnWidth * meta.aspect;
  });
  return heights;
};

const fillPendingColumns = (metas: Record<string, WaterfallMeta>, cols: number, columnWidth: number) => {
  const pending = Object.entries(metas)
    .filter(([, meta]) => meta.loaded && meta.column === null)
    .sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));
  if (pending.length === 0) return metas;

  const heights = getColumnHeights(metas, columnWidth, cols);
  const next = { ...metas };

  pending.forEach(([id, meta]) => {
    const target = pickShortestColumn(heights);
    heights[target] += columnWidth * meta.aspect;
    next[id] = { ...meta, column: target };
  });

  return next;
};

const reflowLoadedColumns = (metas: Record<string, WaterfallMeta>, cols: number, columnWidth: number) => {
  const loaded = Object.entries(metas)
    .filter(([, meta]) => meta.loaded)
    .sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));
  const heights = Array.from({ length: cols }, () => 0);
  const next = { ...metas };

  loaded.forEach(([id, meta]) => {
    const target = pickShortestColumn(heights);
    heights[target] += columnWidth * meta.aspect;
    next[id] = { ...meta, column: target };
  });

  return next;
};

const ImageLoader: React.FC<{ src: string; id: string; onLoad: (id: string, width: number, height: number) => void }> = ({
  src,
  id,
  onLoad,
}) => {
  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => onLoad(id, img.naturalWidth, img.naturalHeight);
    return () => {
      img.onload = null;
    };
  }, [src, id, onLoad]);

  return null;
};

type WaterfallCardProps = {
  item: any;
  meta: WaterfallMeta;
  columnWidth: number;
  cols: number;
  copyLink: (url?: string) => void;
};

const WaterfallCard: React.FC<WaterfallCardProps> = ({ item, meta, columnWidth, cols, copyLink }) => {
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);

  useEffect(() => {
    setThumbLoaded(false);
    setFullLoaded(false);
  }, [item.id, cols, meta.column]);

  const growKey = `${item.id}-${cols}-${meta?.column ?? "c"}-${meta?.order ?? "o"}`;
  const displayHeight = columnWidth ? columnWidth * (meta?.aspect ?? 1) : "auto";

  return (
    <Grow key={growKey} in={thumbLoaded} appear timeout={260}>
      <Box component={RouterLink as any} to={`/images/${item.id}`} sx={{ textDecoration: "none" }}>
        <Box
          sx={{
            position: "relative",
            borderRadius: 2,
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            display: "block",
            backgroundColor: "#f8f8f8",
            height: displayHeight,
          }}
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
          <Box
            component="img"
            src={`data:image/${item.thumbnail.format};base64,${item.thumbnail.data_base64}`}
            alt={`thumbnail-${item.id}`}
            onLoad={() => setThumbLoaded(true)}
            loading="lazy"
            sx={{
              display: "block",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: fullLoaded ? "blur(0px)" : "blur(1px)",
              transition: "filter 180ms ease, opacity 180ms ease",
            }}
          />
          {thumbLoaded && (
            <Box
              component="img"
              src={item.public_url}
              alt={`image-${item.id}`}
              loading="lazy"
              onLoad={() => setFullLoaded(true)}
              sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: fullLoaded ? 1 : 0,
                transition: "opacity 200ms ease",
              }}
            />
          )}
        </Box>
        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
          {item.tags.slice(0, 3).map((tag: string) => (
            <Chip key={tag} label={tag} size="small" />
          ))}
        </Stack>
      </Box>
    </Grow>
  );
};

const BrowsePage: React.FC = () => {
  const [tags, setTags] = useState("");
  const [tagMode, setTagMode] = useState("all");
  const [notice, setNotice] = useState("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const waterfallRef = useRef<HTMLDivElement | null>(null);
  const theme = useTheme();
  const upSm = useMediaQuery(theme.breakpoints.up("sm"));
  const upMd = useMediaQuery(theme.breakpoints.up("md"));
  const cols = upMd ? 3 : upSm ? 2 : 1;
  const [columnWidth, setColumnWidth] = useState(0);
  const [metas, setMetas] = useState<Record<string, WaterfallMeta>>({});
  const loadOrderRef = useRef(0);
  const reflowedColsRef = useRef(cols);

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

  // 任务：图片无固定高度，保持原始宽高比并按最矮列放置，列变化时重新分配
  // 方案：记录图片加载得到的宽高比，计算列宽，按加载顺序把已加载图片落到当前高度最矮的列；列数变化时整体按顺序重排；所有展示节点使用 Grow 动画出现
  useEffect(() => {
    const nextMetas: Record<string, WaterfallMeta> = {};
    items.forEach((item: any) => {
      const existing = metas[item.id];
      nextMetas[item.id] = existing ?? { aspect: 1, loaded: false, column: null, order: null };
    });
    setMetas(nextMetas);
  }, [items]);

  useEffect(() => {
    const container = waterfallRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setColumnWidth((entry.contentRect.width - 16 * (cols - 1)) / cols);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [cols]);

  useEffect(() => {
    if (!columnWidth || reflowedColsRef.current === cols) return;
    setMetas((prev) => reflowLoadedColumns(prev, cols, columnWidth));
    reflowedColsRef.current = cols;
  }, [cols, columnWidth]);

  useEffect(() => {
    if (!columnWidth) return;
    setMetas((prev) => fillPendingColumns(prev, cols, columnWidth));
  }, [columnWidth, cols]);

  // 任务：为列表图片提供一键复制外链的交互
  // 方案：使用后端返回的 public_url，通过剪贴板 API 写入并轻提示
  const copyLink = async (url?: string) => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setNotice("已复制图片链接");
  };

  const handleImageLoad = useCallback(
    (id: string, width: number, height: number) => {
      setMetas((prev) => {
        const meta = prev[id];
        if (!meta) return prev;
        const order = meta.order ?? loadOrderRef.current++;
        const aspect = height && width ? height / width : 1;

        if (!columnWidth || cols === 0) {
          return { ...prev, [id]: { ...meta, loaded: true, aspect, order, column: null } };
        }

        const heights = getColumnHeights(prev, columnWidth, cols);
        const target = pickShortestColumn(heights);

        return {
          ...prev,
          [id]: {
            ...meta,
            loaded: true,
            aspect,
            order,
            column: target,
          },
        };
      });
    },
    [columnWidth, cols]
  );

  const columns = useMemo(() => {
    const result = Array.from({ length: cols }, () => [] as any[]);
    items.forEach((item: any) => {
      const meta = metas[item.id];
      if (meta?.loaded && meta.column !== null && result[meta.column]) {
        result[meta.column].push(item);
      }
    });
    return result;
  }, [cols, items, metas]);

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

      <Box
        ref={waterfallRef}
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          columnGap: 2,
          rowGap: 2,
        }}
      >
        {columns.map((columnItems, columnIndex) => (
          <Stack key={`col-${columnIndex}`} spacing={2}>
            {columnItems.map((item: any) => {
              const meta = metas[item.id];
              if (!meta) return null;
              return (
                <WaterfallCard
                  key={`${item.id}-${cols}-${meta?.column ?? "c"}-${meta?.order ?? "o"}`}
                  item={item}
                  meta={meta}
                  columnWidth={columnWidth}
                  cols={cols}
                  copyLink={copyLink}
                />
              );
            })}
          </Stack>
        ))}
      </Box>
      {items.map((item: any) => {
        const meta = metas[item.id];
        if (meta?.loaded) return null;
        return <ImageLoader key={`loader-${item.id}`} id={item.id} src={item.public_url} onLoad={handleImageLoad} />;
      })}
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
