// 任务：展示图片详情并提供裁剪/色调/标签/删除操作
// 方案：拉取 /images/{id} 元数据，并使用 blob 显示原图

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Typography, Stack, Card, CardContent, Chip, Button, TextField, Slider, Accordion, AccordionSummary, AccordionDetails, Snackbar, CircularProgress } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import api from '../api/client';
import { useAuth } from './auth/AuthProvider';

const ImageDetailPage: React.FC = () => {
  const { id } = useParams();
  const imageId = Number(id);
  const { user } = useAuth();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [cropValues, setCropValues] = useState({ top: 0, bottom: 0, left: 0, right: 0 });
  const [hue, setHue] = useState(0);
  const [notice, setNotice] = useState('');
  const [activeEditor, setActiveEditor] = useState<'crop' | 'hue' | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'crop' | 'hue' | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const resetPreview = useCallback(() => {
    setPreviewMode(null);
    setPreviewLoading(false);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const { data, refetch } = useQuery({
    queryKey: ['image', imageId],
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

  const loadFile = useCallback(async () => {
    const response = await api.get(`/images/${imageId}/file`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    setFileUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, [imageId]);

  useEffect(() => {
    if (Number.isFinite(imageId)) {
      resetPreview();
      setActiveEditor(null);
      loadFile();
    }
  }, [imageId, loadFile, resetPreview]);

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const renderPreviewArea = (mode: 'crop' | 'hue') => {
    const dims = computePreviewSize(mode);
    const ratio = dims ? Math.max(dims.width, 1) / Math.max(dims.height, 1) : 4 / 3;
    const isActive = activeEditor === mode;
    const showLoading = isActive && previewLoading && previewMode === mode;
    const showImage = isActive && previewUrl && previewMode === mode && !showLoading;

    return (
      <Stack spacing={1}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          预览
        </Typography>
        <Box
          sx={{
            position: 'relative',
            borderRadius: 1.5,
            border: '1px dashed',
            borderColor: 'divider',
            bgcolor: 'grey.50',
            overflow: 'hidden',
          }}
        >
          {showImage && <Box component="img" src={previewUrl ?? undefined} alt={`${mode}-preview`} sx={{ width: '100%', display: 'block' }} />}
          {isActive && !showImage && (
            <Box
              sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                aspectRatio: `${ratio}`,
                minHeight: 160,
                bgcolor: 'grey.100',
              }}
            >
              {showLoading ? (
                <CircularProgress size={32} />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  暂无预览，请调整参数
                </Typography>
              )}
              <Box sx={{ position: 'absolute', bottom: 8, right: 12 }}>
                <Typography variant="caption" color="text.secondary">
                  {dims ? `${Math.max(1, dims.width)} x ${Math.max(1, dims.height)}` : '等待尺寸信息'}
                </Typography>
              </Box>
            </Box>
          )}
          {!isActive && (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                展开该面板后根据参数自动生成预览
              </Typography>
            </Box>
          )}
        </Box>
      </Stack>
    );
  };

  const handleAccordionChange = (panel: 'crop' | 'hue') => (_event: React.SyntheticEvent, expanded: boolean) => {
    if (!expanded) {
      setActiveEditor(null);
      resetPreview();
      return;
    }
    resetPreview();
    setActiveEditor(panel);
  };

  useEffect(() => {
    if (data?.tags) {
      setTagInput(data.tags.join(','));
    }
  }, [data]);

  const computePreviewSize = useCallback(
    (mode: 'crop' | 'hue') => {
      if (!data?.dimensions?.width || !data.dimensions?.height) return null;
      const baseWidth = data.dimensions.width;
      const baseHeight = data.dimensions.height;
      if (mode === 'crop') {
        const widthRatio = 1 - (cropValues.left + cropValues.right) / 100;
        const heightRatio = 1 - (cropValues.top + cropValues.bottom) / 100;
        return {
          width: Math.max(1, Math.floor(baseWidth * Math.max(widthRatio, 0))),
          height: Math.max(1, Math.floor(baseHeight * Math.max(heightRatio, 0))),
        };
      }
      return { width: baseWidth, height: baseHeight };
    },
    [cropValues.bottom, cropValues.left, cropValues.right, cropValues.top, data?.dimensions?.height, data?.dimensions?.width],
  );

  // 任务：编辑参数变化时实时拉取预览，并在等待后端时用占位与转圈提示
  // 方案：以当前展开的面板为唯一预览来源，变更参数即调用预览接口返回 blob，加载时清空旧预览
  useEffect(() => {
    if (!Number.isFinite(imageId) || !activeEditor) return;

    const controller = new AbortController();
    const payload =
      activeEditor === 'crop'
        ? { mode: 'crop', ...cropValues }
        : { mode: 'hue', delta: hue };

    setPreviewMode(activeEditor);
    setPreviewLoading(true);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    api
      .post(`/images/${imageId}/edit/preview`, payload, { responseType: 'blob', signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        const url = URL.createObjectURL(response.data);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPreviewLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [activeEditor, cropValues.bottom, cropValues.left, cropValues.right, cropValues.top, hue, imageId]);

  const updateTags = async () => {
    await api.put(`/images/${imageId}/tags`, {
      tags: tagInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    });
    setNotice('标签已更新');
    refetch();
  };

  const applyCrop = async () => {
    await api.post(`/images/${imageId}/edit/crop`, cropValues);
    setNotice('裁剪完成');
    refetch();
    loadFile();
  };

  const applyHue = async () => {
    await api.post(`/images/${imageId}/edit/hue`, { delta: hue });
    setNotice('色调调整完成');
    refetch();
    loadFile();
  };

  // 任务：详情页提供外链复制
  // 方案：优先使用接口返回的 public_url，不存在时用 storage_relpath 拼出链接，并在无 Clipboard API 时用 textarea 兜底
  const buildPublicLink = () => {
    if (!data) return '';
    if (data.public_url) return data.public_url;
    if (data.storage_relpath) {
      const origin = window.location.origin.replace(/\/$/, '');
      return `${origin}/images/${data.storage_relpath}`;
    }
    return '';
  };

  const copyPublicLink = async () => {
    const link = buildPublicLink();
    if (!link) return;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
      setNotice('已复制图片链接');
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = link;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    setNotice('已复制图片链接');
  };

  const removeImage = async () => {
    await api.delete(`/images/${imageId}`);
    setNotice('图片已删除');
    refetch();
  };

  const restoreImage = async () => {
    await api.post(`/images/${imageId}/restore`);
    setNotice('图片已恢复');
    refetch();
  };

  if (!data) {
    return <Typography>加载中...</Typography>;
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={2} direction="row" alignItems="center">
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          图片详情
        </Typography>
        {data.is_deleted && <Chip label="已删除" color="warning" />}
      </Stack>

      {/* 任务：按照新需求改造详情页布局，实现大屏 9:3 分栏、小屏上层右栏的排布 */}
      {/* 方案：使用 flex 布局控制 order 与比例，右侧内容按需求逐项展开 */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
        }}
      >
        <Box
          sx={{
            flex: '3 1 0',
            order: { xs: 2, md: 1 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Card>
            <CardContent>{fileUrl && <Box component="img" src={fileUrl} alt="detail" sx={{ width: '100%', borderRadius: 1 }} />}</CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                基础信息
              </Typography>
              <Stack spacing={1}>
                <Typography>上传者：{data.uploader?.username || ''}</Typography>
                {/* 任务：详情页补充展示上传时的原始文件名，仅在存在时呈现 */}
                {data.original_filename && <Typography>原始文件名：{data.original_filename}</Typography>}
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
                  编辑
                </Typography>
                <Accordion expanded={activeEditor === 'crop'} onChange={handleAccordionChange('crop')}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>裁剪</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                        <TextField label="上 (0-100%)" type="number" value={cropValues.top} onChange={(event) => setCropValues({ ...cropValues, top: Number(event.target.value) })} />
                        <TextField label="下 (0-100%)" type="number" value={cropValues.bottom} onChange={(event) => setCropValues({ ...cropValues, bottom: Number(event.target.value) })} />
                        <TextField label="左 (0-100%)" type="number" value={cropValues.left} onChange={(event) => setCropValues({ ...cropValues, left: Number(event.target.value) })} />
                        <TextField label="右 (0-100%)" type="number" value={cropValues.right} onChange={(event) => setCropValues({ ...cropValues, right: Number(event.target.value) })} />
                      </Stack>
                      <Button variant="contained" onClick={applyCrop}>
                        提交裁剪
                      </Button>
                      {renderPreviewArea('crop')}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
                <Accordion expanded={activeEditor === 'hue'} onChange={handleAccordionChange('hue')}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>色调</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      <Slider value={hue} min={-180} max={180} valueLabelDisplay="auto" onChange={(_, value) => setHue(value as number)} />
                      <Button variant="contained" onClick={applyHue}>
                        提交色调调整
                      </Button>
                      {renderPreviewArea('hue')}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              </CardContent>
            </Card>
          )}
        </Box>

        <Box
          sx={{
            flex: '1 1 0',
            order: { xs: 1, md: 2 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {/* 任务：右栏逐个展示复制/删除/标签操作，按钮/textarea 各占一行 */}
          <Button variant="contained" onClick={copyPublicLink} fullWidth>
            复制外链
          </Button>

          {isOwner && !data.is_deleted && (
            <Button variant="contained" color="error" onClick={removeImage} fullWidth>
              删除图片
            </Button>
          )}
          {isOwner && data.is_deleted && (
            <Button variant="outlined" onClick={restoreImage} fullWidth>
              恢复图片
            </Button>
          )}

          {isOwner && (
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <TextField label="自定义标签 (逗号分隔)" value={tagInput} onChange={(event) => setTagInput(event.target.value)} fullWidth multiline minRows={3} />
                  <Button variant="outlined" onClick={updateTags} fullWidth>
                    更新标签
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}
        </Box>
      </Box>

      <Snackbar open={Boolean(notice)} autoHideDuration={2000} message={notice} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Stack>
  );
};

export default ImageDetailPage;
