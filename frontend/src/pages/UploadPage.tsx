// 任务：提供拖拽/选择上传与进度展示
// 方案：多文件并行调用 /images，并在成功后给出复制链接
// 任务：支持剪贴板图片粘贴上传，满足 Ctrl+V 快速导入
// 方案：监听全局 paste 事件，筛选 image/* Blob 转为 File，复用已有 handleFiles 与上传流程

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Card, CardContent, LinearProgress, Typography, Stack, Alert } from '@mui/material';

import api from '../api/client';

type UploadItem = {
  id: string;
  file: File;
  progress: number;
  status: 'waiting' | 'uploading' | 'success' | 'error';
  message?: string;
  publicUrl?: string;
};

const UploadPage: React.FC = () => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [notice, setNotice] = useState('');

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const uploadFile = useCallback(
    async (item: UploadItem) => {
      updateItem(item.id, { status: 'uploading', progress: 0 });
      const formData = new FormData();
      formData.append('file', item.file);

      try {
        const response = await api.post('/images', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (event) => {
            if (!event.total) return;
            const percent = Math.round((event.loaded / event.total) * 100);
            updateItem(item.id, { progress: percent });
          },
        });
        updateItem(item.id, {
          status: 'success',
          progress: 100,
          publicUrl: response.data.public_url,
        });
      } catch (err: any) {
        updateItem(item.id, { status: 'error', message: err?.response?.data?.error?.message || '上传失败' });
      }
    },
    [updateItem]
  );

  const handleFiles = useCallback(
    (files: FileList | File[] | null) => {
      const fileArray = files instanceof FileList ? Array.from(files) : files;
      if (!fileArray || fileArray.length === 0) return;
      const newItems = fileArray.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        progress: 0,
        status: 'waiting' as const,
      }));
      setItems((prev) => [...newItems, ...prev]);
      newItems.forEach(uploadFile);
    },
    [uploadFile]
  );

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  };

  const copyLink = async (url?: string) => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setNotice('已复制链接到剪贴板');
    setTimeout(() => setNotice(''), 1500);
  };

  // 任务：为上传页添加 Ctrl+V 粘贴图片上传
  // 方案：监听 window paste，过滤 image/* 项，转换为 File 后复用 handleFiles 与现有上传提示
  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const clipboardItems = event.clipboardData?.items;
      if (!clipboardItems || clipboardItems.length === 0) return;
      const imageItems = Array.from(clipboardItems).filter((item) => item.type.startsWith('image/'));
      if (imageItems.length === 0) return;

      event.preventDefault();
      const now = Date.now();
      const pastedFiles = imageItems
        .map((item, index) => {
          const file = item.getAsFile();
          if (!file) return null;
          const fallbackExt = item.type.split('/')[1] || 'png';
          const name = file.name?.trim() ? file.name : `pasted-${now}-${index}.${fallbackExt}`;
          return new File([file], name, { type: item.type || 'image/png', lastModified: now });
        })
        .filter(Boolean) as File[];

      if (pastedFiles.length === 0) return;
      setNotice('检测到剪贴板图片，已加入上传');
      setTimeout(() => setNotice(''), 1500);
      handleFiles(pastedFiles);
    },
    [handleFiles]
  );

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  return (
    <Stack spacing={3}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        上传图片
      </Typography>
      {notice && <Alert severity="success">{notice}</Alert>}
      <Card
        sx={{
          border: '2px dashed #9b8c7d',
          backgroundColor: 'rgba(255,255,255,0.7)',
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
      >
        <CardContent sx={{ textAlign: 'center' }}>
          <Box sx={{ py: 12 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              拖拽图片到这里或点击选择文件
            </Typography>
            <Button variant="contained" onClick={() => inputRef.current?.click()}>
              选择文件
            </Button>
            <input ref={inputRef} type="file" multiple hidden accept="image/*" onChange={(event) => handleFiles(event.target.files)} />
          </Box>
        </CardContent>
      </Card>

      <Stack spacing={2}>
        {items.map((item) => (
          <Card key={item.id} sx={{ backgroundColor: 'rgba(255,255,255,0.9)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontWeight: 600 }}>{item.file.name}</Typography>
                {item.status === 'success' && (
                  <Button size="small" onClick={() => copyLink(item.publicUrl)}>
                    复制链接
                  </Button>
                )}
              </Box>
              <LinearProgress variant="determinate" value={item.progress} sx={{ mt: 1 }} />
              {item.status === 'error' && (
                <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                  {item.message}
                </Typography>
              )}
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
};

export default UploadPage;
