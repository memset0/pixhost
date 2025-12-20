// 任务：提供用户设置与全站设置页面
// 方案：改密接口 + 管理员配置接口（站点名称/图标）

import React, { useState } from 'react';
import { Stack, Typography, Card, CardContent, TextField, Button, Alert, Divider, List, ListItem, ListItemText } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import api from '../api/client';
import { useAuth } from './auth/AuthProvider';
import { fileToBase64 } from '../utils/fileToBase64';

const SettingsPage: React.FC = () => {
  const { user, role } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [siteName, setSiteName] = useState('');
  const [allowedExts, setAllowedExts] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);

  const configQuery = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const response = await api.get('/admin/config');
      return response.data;
    },
    enabled: role === 'admin',
    onSuccess: (data) => {
      setSiteName(data.site_name || '');
      setAllowedExts(data.upload_allowed_exts || '');
      setPageSize(data.pagination_page_size || 20);
    },
  });

  const pendingQuery = useQuery({
    queryKey: ['admin', 'pending'],
    queryFn: async () => {
      const response = await api.get('/admin/users', { params: { role: 'pending', page: 1, page_size: 50 } });
      return response.data;
    },
    enabled: role === 'admin',
  });

  const userListQuery = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const response = await api.get('/admin/users', { params: { page: 1, page_size: 200 } });
      return response.data;
    },
    enabled: role === 'admin',
  });

  const updatePassword = async () => {
    setNotice('');
    setError('');
    if (newPassword.length < 6) {
      setError('新密码长度至少 6 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    try {
      await api.patch('/users/me/password', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setNotice('密码已更新');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || '更新失败');
    }
  };

  const updateConfig = async () => {
    setNotice('');
    setError('');
    try {
      const payload: Record<string, string | number> = {};
      if (siteName) payload.site_name = siteName;
      if (allowedExts) payload.upload_allowed_exts = allowedExts;
      if (pageSize) payload.pagination_page_size = pageSize;
      if (faviconFile) {
        payload.favicon_base64 = await fileToBase64(faviconFile);
      }
      await api.put('/admin/config', payload);
      setNotice('配置已保存');
      setFaviconFile(null);
      configQuery.refetch();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || '保存失败');
    }
  };

  const approveUser = async (userId: number) => {
    await api.post(`/admin/users/${userId}/approve`);
    pendingQuery.refetch();
    userListQuery.refetch();
  };

  const changeRole = async (userId: number, nextRole: string) => {
    await api.post(`/admin/users/${userId}/role`, { role: nextRole });
    userListQuery.refetch();
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        设置
      </Typography>
      {notice && <Alert severity="success">{notice}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            用户信息
          </Typography>
          <Stack spacing={1}>
            <Typography>用户名：{user?.username}</Typography>
            <Typography>邮箱：{user?.email}</Typography>
            <Typography>角色：{user?.role}</Typography>
            {role === 'pending' && <Alert severity="warning">账号正在等待管理员审批，暂无法上传或浏览图片。</Alert>}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            修改密码
          </Typography>
          <Stack spacing={2}>
            <TextField label="旧密码" type="password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} />
            <TextField label="新密码" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            <TextField label="确认新密码" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            <Button variant="contained" onClick={updatePassword}>
              保存密码
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {role === 'admin' && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              全站设置
            </Typography>
            <Stack spacing={2}>
              <TextField label="站点名称" value={siteName} onChange={(event) => setSiteName(event.target.value)} />
              <TextField label="允许上传后缀 (逗号分隔)" value={allowedExts} onChange={(event) => setAllowedExts(event.target.value)} />
              <TextField label="分页大小" type="number" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} />
              <Button variant="outlined" component="label">
                上传 Favicon
                <input type="file" hidden accept="image/*" onChange={(event) => setFaviconFile(event.target.files?.[0] || null)} />
              </Button>
              <Divider />
              <Button variant="contained" onClick={updateConfig}>
                保存全站设置
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {role === 'admin' && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              用户审批
            </Typography>
            <List>
              {pendingQuery.data?.items?.length === 0 && (
                <ListItem>
                  <ListItemText primary="暂无待审批用户" />
                </ListItem>
              )}
              {pendingQuery.data?.items?.map((item: any) => (
                <ListItem
                  key={item.id}
                  secondaryAction={
                    <Button variant="contained" onClick={() => approveUser(item.id)}>
                      批准
                    </Button>
                  }
                >
                  <ListItemText primary={item.username} secondary={item.email} />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {role === 'admin' && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              角色管理
            </Typography>
            <List>
              {userListQuery.data?.items
                ?.filter((item: any) => item.role !== 'pending')
                .map((item: any) => (
                  <ListItem
                    key={item.id}
                    secondaryAction={
                      item.role === 'user' ? (
                        <Button variant="outlined" onClick={() => changeRole(item.id, 'admin')}>
                          设为管理员
                        </Button>
                      ) : (
                        <Button variant="outlined" onClick={() => changeRole(item.id, 'user')}>
                          降级为用户
                        </Button>
                      )
                    }
                  >
                    <ListItemText primary={`${item.username} (${item.role})`} secondary={item.email} />
                  </ListItem>
                ))}
            </List>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
};

export default SettingsPage;
