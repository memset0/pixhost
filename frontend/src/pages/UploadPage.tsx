// 任务：提供拖拽/选择上传与进度展示
// 方案：多文件并行调用 /images，并在成功后给出复制链接

import React, { useCallback, useRef, useState } from 'react';
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
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const newItems = Array.from(files).map((file) => ({
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
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            拖拽图片到这里或点击选择文件
          </Typography>
          <Button variant="contained" onClick={() => inputRef.current?.click()}>
            选择文件
          </Button>
          <input ref={inputRef} type="file" multiple hidden accept="image/*" onChange={(event) => handleFiles(event.target.files)} />
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
