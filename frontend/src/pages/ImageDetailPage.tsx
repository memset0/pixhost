// 任务：展示图片详情并提供裁剪/色调/标签/删除操作
// 方案：拉取 /images/{id} 元数据，并使用 blob 显示原图

import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  Chip,
  Button,
  TextField,
  Slider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import api from "../api/client";
import { useAuth } from "./auth/AuthProvider";

const ImageDetailPage: React.FC = () => {
  const { id } = useParams();
  const imageId = Number(id);
  const { user } = useAuth();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [cropValues, setCropValues] = useState({ top: 0, bottom: 0, left: 0, right: 0 });
  const [hue, setHue] = useState(0);
  const [notice, setNotice] = useState("");

  const { data, refetch } = useQuery({
    queryKey: ["image", imageId],
    queryFn: async () => {
      const response = await api.get(`/images/${imageId}`);
      return response.data;
    },
    enabled: Number.isFinite(imageId),
  });

  const isOwner = useMemo(() => {
    if (!data || !user) return false;
    return data.uploader?.id === user.id;
  }, [data, user]);

  const loadFile = async () => {
    const response = await api.get(`/images/${imageId}/file`, { responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    setFileUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  };

  useEffect(() => {
    if (Number.isFinite(imageId)) {
      loadFile();
    }
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [imageId]);

  useEffect(() => {
    if (data?.tags) {
      setTagInput(data.tags.join(","));
    }
  }, [data]);

  const updateTags = async () => {
    await api.put(`/images/${imageId}/tags`, {
      tags: tagInput.split(",").map((item) => item.trim()).filter(Boolean),
    });
    setNotice("标签已更新");
    refetch();
  };

  const applyCrop = async () => {
    await api.post(`/images/${imageId}/edit/crop`, cropValues);
    setNotice("裁剪完成");
    refetch();
    loadFile();
  };

  const applyHue = async () => {
    await api.post(`/images/${imageId}/edit/hue`, { delta: hue });
    setNotice("色调调整完成");
    refetch();
    loadFile();
  };

  const removeImage = async () => {
    await api.delete(`/images/${imageId}`);
    setNotice("图片已删除");
    refetch();
  };

  const restoreImage = async () => {
    await api.post(`/images/${imageId}/restore`);
    setNotice("图片已恢复");
    refetch();
  };

  if (!data) {
    return <Typography>加载中...</Typography>;
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        图片详情
      </Typography>
      {notice && <Alert severity="success">{notice}</Alert>}

      <Card>
        <CardContent>
          {fileUrl && (
            <Box
              component="img"
              src={fileUrl}
              alt="detail"
              sx={{ width: "100%", borderRadius: 2 }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            基础信息
          </Typography>
          <Stack spacing={1}>
            <Typography>上传者：{data.uploader?.username || ""}</Typography>
            <Typography>上传时间：{data.created_at}</Typography>
            <Typography>更新时间：{data.updated_at}</Typography>
            {data.dimensions && (
              <Typography>
                尺寸：{data.dimensions.width} x {data.dimensions.height}
              </Typography>
            )}
            {data.capture_time?.taken_at && <Typography>拍摄时间：{data.capture_time.taken_at}</Typography>}
            {data.location?.latitude !== null && data.location?.latitude !== undefined && (
              <Typography>
                地点：{data.location.latitude}, {data.location.longitude}
              </Typography>
            )}
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {data.tags?.map((tag: string) => (
                <Chip key={tag} label={tag} size="small" />
              ))}
            </Stack>
            {data.exif?.length > 0 && (
              <Stack spacing={1}>
                <Typography sx={{ fontWeight: 600 }}>EXIF 信息</Typography>
                {data.exif.slice(0, 6).map((entry: any) => (
                  <Typography key={entry.key} variant="body2">
                    {entry.key}: {entry.value}
                  </Typography>
                ))}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              标签管理
            </Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="自定义标签 (逗号分隔)"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                fullWidth
              />
              <Button variant="contained" onClick={updateTags}>
                更新标签
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {isOwner && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              编辑
            </Typography>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>裁剪</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField
                      label="上 (0-100%)"
                      type="number"
                      value={cropValues.top}
                      onChange={(event) => setCropValues({ ...cropValues, top: Number(event.target.value) })}
                    />
                    <TextField
                      label="下 (0-100%)"
                      type="number"
                      value={cropValues.bottom}
                      onChange={(event) => setCropValues({ ...cropValues, bottom: Number(event.target.value) })}
                    />
                    <TextField
                      label="左 (0-100%)"
                      type="number"
                      value={cropValues.left}
                      onChange={(event) => setCropValues({ ...cropValues, left: Number(event.target.value) })}
                    />
                    <TextField
                      label="右 (0-100%)"
                      type="number"
                      value={cropValues.right}
                      onChange={(event) => setCropValues({ ...cropValues, right: Number(event.target.value) })}
                    />
                  </Stack>
                  <Button variant="contained" onClick={applyCrop}>
                    提交裁剪
                  </Button>
                </Stack>
              </AccordionDetails>
            </Accordion>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>色调</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Slider
                    value={hue}
                    min={-180}
                    max={180}
                    valueLabelDisplay="auto"
                    onChange={(_, value) => setHue(value as number)}
                  />
                  <Button variant="contained" onClick={applyHue}>
                    提交色调调整
                  </Button>
                </Stack>
              </AccordionDetails>
            </Accordion>
          </CardContent>
        </Card>
      )}

      {isOwner && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              删除与恢复
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button variant="contained" color="error" onClick={removeImage}>
                删除
              </Button>
              <Button variant="outlined" onClick={restoreImage}>
                恢复
              </Button>
              {data.is_deleted && <Chip label="已删除" color="warning" />}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
};

export default ImageDetailPage;
