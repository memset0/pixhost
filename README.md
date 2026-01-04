# pixhost

图片管理网站（前后端分离，OpenAPI 驱动）。

## 目录结构

- `openapi.yaml`：前后端共用接口契约
- `config.yaml`：运行时配置（不入库）
- `backend/`：Python + Connexion 后端
- `frontend/`：React + MUI 前端

## 运行

### 1. 后端（Python + Flask）

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py  # 内部使用 uvicorn 跑 ASGI，路由才会生效
```

- 默认端口来自 `config.yaml`（默认 6007）
- 首次启动会自动创建管理员账号 `admin / 123456`

### 2. 前端（React + Material UI）

```bash
cd frontend
pnpm install
pnpm run dev
```

- 默认开发端口 5173
- 已配置 `/api` 代理到 `http://localhost:6007`

## 通过 docker compose 启动

1. 先确保本机安装了 Docker 与 docker-compose。
2. 在项目根目录执行：

```bash
docker-compose up
```

- 后端容器使用 `python:3.10`，启动前自动 `pip install -r backend/requirements.txt`，挂载 `./config.yaml`、`./openapi.yaml`、`./data`，服务监听 `0.0.0.0:6007`。
- 前端容器使用 `node:22` + `pnpm`，启动前 `pnpm install`，`pnpm run dev -- --host 0.0.0.0 --port 5173`，通过环境变量 `VITE_BACKEND_ORIGIN=http://backend:6007` 代理 API。
- 前后端容器在同一 `pixhost_net` 网络，确保互通。需要重新拉取镜像或清理缓存时，可改用 `docker-compose up --build`.
