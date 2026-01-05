// 任务：提供“帮我找图”页面，支持输入 prompt 并展示 AI 检索结果
// 方案：调用 /mcp/search 获取 AI 输出与图片列表，横向滚动展示图片并加入加载动效

import React, { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  TextField,
  Stack,
  Paper,
  Chip,
  Grow,
  Fade,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { keyframes } from "@mui/material/styles";

import api from "../api/client";

type SearchItem = {
  id: number;
  created_at: string;
  thumbnail: { format: string; data_base64: string };
  tags: string[];
  is_deleted: boolean;
  public_url: string;
  original_filename?: string;
  size_bytes?: number;
};

type SearchResponse = {
  query: string;
  tags: string[];
  ai_output: string;
  items: SearchItem[];
};

const pulse = keyframes`
  0% { transform: scale(0.9); opacity: 0.6; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0.6; }
`;

const dotBounce = keyframes`
  0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
  40% { transform: translateY(-4px); opacity: 1; }
`;

const AiSearchPage: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiOutput, setAiOutput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [items, setItems] = useState<SearchItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    const query = prompt.trim();
    if (!query) {
      setError("请输入需要检索的描述");
      return;
    }
    setLoading(true);
    setError("");
    setAiOutput("");
    setTags([]);
    setItems([]);
    setHasSearched(true);

    try {
      const response = await api.post<SearchResponse>("/mcp/search", { query });
      setAiOutput(response.data.ai_output || "");
      setTags(response.data.tags || []);
      setItems(response.data.items || []);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "检索失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Card sx={{ background: "linear-gradient(135deg, #ffffff 0%, #f6efe7 100%)" }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              帮我找图
            </Typography>
            <Typography variant="body2" color="text.secondary">
              输入你想找的画面描述，AI 会从现有标签里选出最相关的关键词并给出匹配图片。
            </Typography>
            <TextField
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              label="检索描述"
              placeholder="例如：午后阳光、室内咖啡、慵懒的猫"
              multiline
              minRows={3}
              fullWidth
            />
            <Button
              variant="contained"
              color="secondary"
              startIcon={<SearchIcon />}
              onClick={handleSearch}
              disabled={loading}
              sx={{ alignSelf: "flex-start", textTransform: "none", fontWeight: 600 }}
            >
              {loading ? "检索中..." : "开始检索"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Fade in={loading} timeout={200}>
        <Box
          sx={{
            display: loading ? "flex" : "none",
            alignItems: "center",
            gap: 2,
            px: 3,
            py: 2,
            borderRadius: 2,
            backgroundColor: "rgba(45, 106, 79, 0.08)",
            border: "1px solid rgba(45, 106, 79, 0.2)",
          }}
        >
          {/* 任务：在等待 AI 返回时展示搜索动画 */}
          {/* 方案：使用脉冲圆点 + 跳动省略号，提示模型正在检索 */}
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: "#2d6a4f",
              animation: `${pulse} 1.1s ease-in-out infinite`,
            }}
          />
          <Typography sx={{ fontWeight: 600 }}>大模型正在搜索中</Typography>
          <Box sx={{ display: "flex", gap: 0.6 }}>
            {[0, 1, 2].map((idx) => (
              <Box
                key={idx}
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: "#f4a261",
                  animation: `${dotBounce} 1s ${idx * 0.2}s infinite`,
                }}
              />
            ))}
          </Box>
        </Box>
      </Fade>

      {error && (
        <Paper sx={{ px: 2, py: 1.5, borderLeft: "4px solid #c0392b", backgroundColor: "#fff5f5" }}>
          <Typography color="error" sx={{ fontWeight: 600 }}>
            {error}
          </Typography>
        </Paper>
      )}

      {!loading && hasSearched && !error && items.length === 0 && (
        <Paper sx={{ px: 2, py: 2 }}>
          <Typography color="text.secondary">暂时没有匹配到图片，可以尝试换个描述。</Typography>
        </Paper>
      )}

      {!loading && tags.length > 0 && (
        <Grow in timeout={300}>
          <Paper sx={{ px: 2, py: 1.5 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                匹配到的标签
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {tags.map((tag) => (
                  <Chip key={tag} label={tag} color="primary" size="small" />
                ))}
              </Stack>
            </Stack>
          </Paper>
        </Grow>
      )}

      {!loading && items.length > 0 && (
        <Grow in timeout={300}>
          <Paper sx={{ px: 2, py: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              匹配图片
            </Typography>
            <Box
              sx={{
                display: "flex",
                gap: 2,
                overflowX: "auto",
                height: "10em",
                pb: 1,
              }}
            >
              {items.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    height: "10em",
                    minWidth: "10em",
                    borderRadius: 1,
                    overflow: "hidden",
                    boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
                    backgroundColor: "#f4efe8",
                    flex: "0 0 auto",
                    transition: "transform 200ms ease, box-shadow 200ms ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: "0 12px 24px rgba(0,0,0,0.18)",
                    },
                  }}
                >
                  <Box
                    component="img"
                    src={`data:image/${item.thumbnail.format};base64,${item.thumbnail.data_base64}`}
                    alt={item.original_filename || `image-${item.id}`}
                    sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </Box>
              ))}
            </Box>
          </Paper>
        </Grow>
      )}

      {!loading && aiOutput && (
        <Grow in timeout={300}>
          <Paper sx={{ px: 2, py: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              大模型完整输出
            </Typography>
            <Typography
              component="pre"
              sx={{
                margin: 0,
                whiteSpace: "pre-wrap",
                fontFamily: '"Noto Serif SC", "Source Han Serif SC", "PingFang SC", serif',
                color: "text.secondary",
                lineHeight: 1.7,
              }}
            >
              {aiOutput}
            </Typography>
          </Paper>
        </Grow>
      )}
    </Stack>
  );
};

export default AiSearchPage;
