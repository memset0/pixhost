// Task: provide a favorites carousel with 16:9 framing, auto-advance, and manual controls.
// Approach: render all slides but only show prev/current/next via 3D transforms and opacity transitions.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";

export type FavoriteCarouselItem = {
  id: number;
  public_url?: string;
  thumbnail?: { format: string; data_base64: string };
};

type CarouselPosition = "current" | "prev" | "next" | "hidden";

// Task: reuse public_url for display but keep it relative for local proxy support.
// Approach: strip hostname when public_url is absolute and fallback to raw path.
const toPublicPath = (publicUrl?: string) => {
  if (!publicUrl) return "";
  if (publicUrl.startsWith("http://") || publicUrl.startsWith("https://")) {
    const url = new URL(publicUrl);
    return `${url.pathname}${url.search}`;
  }
  if (publicUrl.startsWith("//")) {
    const url = new URL(`http:${publicUrl}`);
    return `${url.pathname}${url.search}`;
  }
  if (publicUrl.startsWith("/")) return publicUrl;
  return `/${publicUrl}`;
};

const resolveImageSrc = (item: FavoriteCarouselItem) => {
  if (item.public_url) return toPublicPath(item.public_url);
  if (item.thumbnail) {
    return `data:image/${item.thumbnail.format};base64,${item.thumbnail.data_base64}`;
  }
  return "";
};

const getPosition = (index: number, activeIndex: number, total: number): CarouselPosition => {
  if (index === activeIndex) return "current";
  if (total <= 1) return "hidden";
  const prevIndex = (activeIndex - 1 + total) % total;
  const nextIndex = (activeIndex + 1) % total;
  if (index === prevIndex) return "prev";
  if (index === nextIndex) return "next";
  return "hidden";
};

const FavoriteCarousel: React.FC<{ items: FavoriteCarouselItem[] }> = ({ items }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoSeed, setAutoSeed] = useState(0);
  const total = items.length;

  useEffect(() => {
    if (activeIndex >= total) setActiveIndex(0);
  }, [activeIndex, total]);

  // Task: auto-advance every 5s and reset the timer after manual navigation.
  // Approach: re-create the interval when autoSeed changes.
  useEffect(() => {
    if (total <= 1) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % total);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [autoSeed, total]);

  const goNext = useCallback(() => {
    if (total <= 1) return;
    setActiveIndex((prev) => (prev + 1) % total);
    setAutoSeed((prev) => prev + 1);
  }, [total]);

  const goPrev = useCallback(() => {
    if (total <= 1) return;
    setActiveIndex((prev) => (prev - 1 + total) % total);
    setAutoSeed((prev) => prev + 1);
  }, [total]);

  const positionStyles = useMemo<Record<CarouselPosition, Record<string, string | number>>>(
    () => ({
      current: {
        transform: "translateX(-50%) scale(1) rotateY(0deg)",
        opacity: 1,
        zIndex: 3,
        filter: "blur(0px)",
      },
      prev: {
        transform: "translateX(-122%) scale(0.78) rotateY(16deg)",
        opacity: 0.48,
        zIndex: 2,
        filter: "blur(0.6px)",
      },
      next: {
        transform: "translateX(22%) scale(0.78) rotateY(-16deg)",
        opacity: 0.48,
        zIndex: 2,
        filter: "blur(0.6px)",
      },
      hidden: {
        transform: "translateX(-50%) scale(0.6)",
        opacity: 0,
        zIndex: 1,
        filter: "blur(2px)",
        pointerEvents: "none",
      },
    }),
    []
  );

  if (total === 0) return null;

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          收藏轮播
        </Typography>
        <Stack direction="row" spacing={1}>
          <IconButton onClick={goPrev} disabled={total <= 1} aria-label="上一张">
            <NavigateBeforeIcon />
          </IconButton>
          <IconButton onClick={goNext} disabled={total <= 1} aria-label="下一张">
            <NavigateNextIcon />
          </IconButton>
        </Stack>
      </Stack>

      <Box
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          borderRadius: 2,
          overflow: "hidden",
          background: "linear-gradient(135deg, rgba(15,23,42,0.12), rgba(15,23,42,0.02))",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            perspective: "1200px",
          }}
        >
          {items.map((item, index) => {
            const position = getPosition(index, activeIndex, total);
            const src = resolveImageSrc(item);
            return (
              <Box
                key={item.id}
                sx={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  width: "100%",
                  height: "100%",
                  borderRadius: 2,
                  overflow: "hidden",
                  transformStyle: "preserve-3d",
                  transition: "transform 520ms ease, opacity 420ms ease, filter 420ms ease",
                  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)",
                  backfaceVisibility: "hidden",
                  ...positionStyles[position],
                }}
              >
                <Box
                  component="img"
                  src={src}
                  alt={`favorite-${item.id}`}
                  loading="lazy"
                  sx={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    backgroundColor: "rgba(15, 23, 42, 0.08)",
                  }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.18))",
                  }}
                />
              </Box>
            );
          })}
        </Box>
      </Box>
    </Stack>
  );
};

export default FavoriteCarousel;
