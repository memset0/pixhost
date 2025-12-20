// 任务：瀑布流浏览与标签筛选 + 动态列宽分配
// 方案：React Query 无限分页 + IntersectionObserver 自动加载 + 自定义瀑布流分栏(列宽固定、按最矮列落位、Grow 动画)

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Box,
  Grow,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Paper,
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

// 任务：瀑布流卡片高度限制在可视范围内，按宽高比自适应后若仍不满足则等比缩放至区间
// 方案：定义全局最小/最大高度，计算列高度时统一按限制后的显示高度，避免布局与视觉高度不一致
const MIN_CARD_HEIGHT = 100;
const MAX_CARD_HEIGHT = 400;

const getDisplayHeight = (aspect: number, columnWidth: number) => {
  if (!columnWidth) return 0;
  const raw = columnWidth * aspect;
  if (!Number.isFinite(raw)) return 0;
  return Math.min(Math.max(raw, MIN_CARD_HEIGHT), MAX_CARD_HEIGHT);
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
    heights[meta.column] += getDisplayHeight(meta.aspect, columnWidth);
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
    heights[target] += getDisplayHeight(meta.aspect, columnWidth);
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
    heights[target] += getDisplayHeight(meta.aspect, columnWidth);
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

  // 任务：浏览卡片 hover 才展示复制按钮与标签，并设定最小高度+阴影动态
  // 方案：卡片高度限制在 100-600px，若原始等比高度不在区间则等比缩放，不做单轴拉伸；hover 控制阴影与浮层显隐
  useEffect(() => {
    setThumbLoaded(false);
    setFullLoaded(false);
  }, [item.id, cols, meta.column]);

  const growKey = `${item.id}-${cols}-${meta?.column ?? "c"}-${meta?.order ?? "o"}`;
  const displayHeight = getDisplayHeight(meta?.aspect ?? 1, columnWidth);

  return (
    <Grow key={growKey} in={thumbLoaded} appear timeout={260}>
      <Box
        component={RouterLink as any}
        to={`/images/${item.id}`}
        sx={{
          textDecoration: "none",
          "&:hover .waterfall-hover": {
            opacity: 1,
            visibility: "visible",
            transform: "translateY(0)",
          },
        }}
      >
        <Box
          sx={{
            position: "relative",
            borderRadius: 1,
            overflow: "hidden",
            boxShadow: "0 3px 12px rgba(0,0,0,0.08)",
            transition: "box-shadow 180ms ease",
            "&:hover": { boxShadow: "0 10px 30px rgba(0,0,0,0.18)" },
            display: "block",
            backgroundColor: "#f8f8f8",
            height: displayHeight,
          }}
        >
          <Tooltip title="复制外链">
            <IconButton
              size="small"
              className="waterfall-hover"
              sx={{
                position: "absolute",
                top: 8,
                right: 8,
                backgroundColor: "rgba(0,0,0,0.35)",
                color: "#fff",
                "&:hover": { backgroundColor: "rgba(0,0,0,0.5)" },
                zIndex: 1,
                opacity: 0,
                visibility: "hidden",
                transform: "translateY(-4px)",
                transition: "opacity 140ms ease, transform 140ms ease",
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
          <Stack
            direction="row"
            spacing={1}
            className="waterfall-hover"
            sx={{
              position: "absolute",
              left: 12,
              bottom: 12,
              flexWrap: "wrap",
              opacity: 0,
              visibility: "hidden",
              transform: "translateY(4px)",
              transition: "opacity 140ms ease, transform 140ms ease",
              pointerEvents: "none",
            }}
          >
            {item.tags.slice(0, 3).map((tag: string) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                sx={{
                  backgroundColor: "rgba(0,0,0,0.55)",
                  color: "#fff",
                }}
              />
            ))}
          </Stack>
        </Box>
      </Box>
    </Grow>
  );
};

type ListRowProps = {
  item: any;
  copyLink: (url?: string) => void;
  refetch: () => void;
};

const ListRow: React.FC<ListRowProps> = ({ item, copyLink, refetch }) => {
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);

  useEffect(() => {
    setThumbLoaded(false);
    setFullLoaded(false);
  }, [item.id]);

  const sizeText = item.size_bytes ? `${(item.size_bytes / 1024).toFixed(1)} KB` : "--";
  const created = item.created_at ? new Date(item.created_at).toLocaleString() : "--";
  const isDeleted = item.is_deleted;

  return (
    <TableRow hover>
      <TableCell align="center">{item.id}</TableCell>
      <TableCell align="center">
        <Box
          component={RouterLink as any}
          to={`/images/${item.id}`}
          sx={{
            position: "relative",
            display: "inline-block",
            width: 140,
            height: 90,
            borderRadius: 1,
            overflow: "hidden",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        >
          <Box
            component="img"
            src={`data:image/${item.thumbnail.format};base64,${item.thumbnail.data_base64}`}
            alt={`thumb-${item.id}`}
            onLoad={() => setThumbLoaded(true)}
            loading="lazy"
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: fullLoaded ? "blur(0px)" : "blur(1px)",
              transition: "filter 180ms ease",
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
      </TableCell>
      <TableCell align="center">{item.original_filename || "--"}</TableCell>
      <TableCell align="center">{sizeText}</TableCell>
      <TableCell align="center">{created}</TableCell>
      <TableCell align="center">
        <Stack direction="row" spacing={1} justifyContent="center">
          <Button size="small" variant="outlined" onClick={() => copyLink(item.public_url)}>
            复制链接
          </Button>
          {!isDeleted && (
            <Button
              size="small"
              color="error"
              variant="outlined"
              onClick={async () => {
                await api.delete(`/images/${item.id}`);
                refetch();
              }}
            >
              删除
            </Button>
          )}
          {isDeleted && (
            <Button
              size="small"
              color="success"
              variant="outlined"
              onClick={async () => {
                await api.post(`/images/${item.id}/restore`);
                refetch();
              }}
            >
              恢复
            </Button>
          )}
        </Stack>
      </TableCell>
    </TableRow>
  );
};

const BrowsePage: React.FC = () => {
  const [tags, setTags] = useState("");
  const [tagMode, setTagMode] = useState("all");
  const [notice, setNotice] = useState("");
  const [layout, setLayout] = useState<"waterfall" | "list">(() => {
    const cached = localStorage.getItem("browse_layout");
    return cached === "list" ? "list" : "waterfall";
  });
  // 任务：视图切换后重新从第一页开始加载，避免在另一种视图加载过多数据导致切换卡顿
  // 方案：记录视图切换计数并写入 queryKey，每次切换都会触发 React Query 全量重取，同时清空瀑布流元数据
  const [layoutReloadVersion, setLayoutReloadVersion] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const waterfallRef = useRef<HTMLDivElement | null>(null);
  const theme = useTheme();
  const upSm = useMediaQuery(theme.breakpoints.up("sm"));
  const upMd = useMediaQuery(theme.breakpoints.up("md"));
  const upLg = useMediaQuery(theme.breakpoints.up("lg"));
  const upXl = useMediaQuery(theme.breakpoints.up("xl"));
  const cols = upXl ? 5 : upLg ? 4 : upMd ? 3 : upSm ? 2 : 1;
  const [columnWidth, setColumnWidth] = useState(0);
  const [metas, setMetas] = useState<Record<string, WaterfallMeta>>({});
  const reflowedColsRef = useRef(cols);

  const query = useInfiniteQuery({
    queryKey: ["images", tags, tagMode, layoutReloadVersion],
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
  // 方案：记录图片加载得到的宽高比，计算列宽，按数据顺序把已加载图片落到当前高度最矮的列（同高取最左），列数变化时整体按顺序重排；所有展示节点使用 Grow 动画出现
  useEffect(() => {
    const nextMetas: Record<string, WaterfallMeta> = {};
    items.forEach((item: any, index: number) => {
      const existing = metas[item.id];
      nextMetas[item.id] = existing
        ? existing
        : { aspect: 1, loaded: false, column: null, order: index };
      // 确保顺序稳定：列表顺序即分配顺序
      if (existing && existing.order === null) {
        nextMetas[item.id] = { ...existing, order: index };
      }
    });
    setMetas(nextMetas);
  }, [items]);

  useEffect(() => {
    // 任务：切换视图后重新绑定容器宽度监听，避免容器被卸载导致宽度变成 0/负值从而卡片高度被夹到最小值
    // 方案：依赖 layout 重新注册 ResizeObserver，并对计算结果做下限 0 保护
    const container = waterfallRef.current;
    if (!container) {
      setColumnWidth(0);
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = entry?.contentRect?.width ?? 0;
      const next = width > 0 ? (width - 16 * (cols - 1)) / cols : 0;
      setColumnWidth(Math.max(next, 0));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [cols, layout]);

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
        const order = meta.order ?? 0;
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

  useEffect(() => {
    localStorage.setItem("browse_layout", layout);
  }, [layout]);

  const handleLayoutChange = useCallback(
    (_: unknown, value: "waterfall" | "list" | null) => {
      if (!value || value === layout) return;
      setLayout(value);
      setLayoutReloadVersion((prev) => prev + 1);
      setMetas({});
    },
    [layout]
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
        <ToggleButtonGroup
          exclusive
          value={layout}
          onChange={handleLayoutChange}
          size="small"
        >
          <ToggleButton value="waterfall">瀑布流</ToggleButton>
          <ToggleButton value="list">列表</ToggleButton>
        </ToggleButtonGroup>
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
            <MenuItem value="all">AND</MenuItem>
            <MenuItem value="any">OR</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {layout === "waterfall" && (
        <>
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
        </>
      )}

      {layout === "list" && (
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ backgroundColor: "transparent", boxShadow: "none" }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell align="center" sx={{ fontWeight: 700 }}>
                  ID
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>
                  图片
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>
                  原始文件名
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>
                  大小
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>
                  上传时间
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>
                  操作
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item: any) => (
                <ListRow key={item.id} item={item} copyLink={copyLink} refetch={query.refetch} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
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
