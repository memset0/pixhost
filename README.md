# pixhost

图片管理网站（前后端分离，OpenAPI 驱动）。

## 目录结构

- `openapi.yaml`：前后端共用接口契约
- `config.yaml`：运行时配置（不入库）
- `backend/`：Python + Connexion 后端
- `frontend/`：React + MUI 前端

## 运行与调试

### 1. 后端（Python）

```bash
cd /mnt/shared-storage-user/p1-shared/wuyulun/project/homework/pixhost/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py  # 内部使用 uvicorn 跑 ASGI，路由才会生效
```

- 默认端口来自 `config.yaml`（默认 6007）
- 首次启动会自动创建管理员账号 `admin / 123456`

### 2. 前端（React）

```bash
cd /mnt/shared-storage-user/p1-shared/wuyulun/project/homework/pixhost/frontend
pnpm install
pnpm run dev
```

- 默认开发端口 5173
- 已配置 `/api` 代理到 `http://localhost:6007`

### 3. 调试要点

- 修改 `config.yaml` 后会按 mtime 热加载
- 图片原图保存于 `config.yaml -> storage.root_dir`
- 缩略图存于数据库（base64），最大 100KB，最大边 100px
- 编辑图片会先备份到 `storage.backup_dir`
