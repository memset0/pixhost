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
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py  # 内部使用 uvicorn 跑 ASGI，路由才会生效
```

- 默认端口来自 `config.yaml`（默认 6007）
- 首次启动会自动创建管理员账号 `admin / 123456`

### 2. 前端（React）

```bash
cd frontend
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

## 使用 docker-compose 启动

> 任务：一键启动前后端容器并共享配置/数据；方案：直接使用仓库根目录的 `docker-compose.yml`，后端跑 Python 3.10、前端跑 Node 22 + pnpm，容器网络互通，暴露 6007（后端）和 5173（前端）。

1. 先确保本机安装了 Docker 与 docker-compose。
2. 在项目根目录执行：

```bash
docker-compose up
```

- 后端容器使用 `python:3.10`，启动前自动 `pip install -r backend/requirements.txt`，挂载 `./config.yaml`、`./openapi.yaml`、`./data`，服务监听 `0.0.0.0:6007`。
- 前端容器使用 `node:22` + `pnpm`，启动前 `pnpm install`，`pnpm run dev -- --host 0.0.0.0 --port 5173`，通过环境变量 `VITE_BACKEND_ORIGIN=http://backend:6007` 代理 API。
- 前后端容器在同一 `pixhost_net` 网络，确保互通。需要重新拉取镜像或清理缓存时，可改用 `docker-compose up --build`.
