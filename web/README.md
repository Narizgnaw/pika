# Pika Web

`web/` 是官方管理后台前端（React/Vite），发布到 `/admin/assets/*`。

官方默认公开主题在仓库根目录的 `portal/`，是一个独立的项目，可以搬迁到单独的仓库。

## 开发

```bash
cd web && npm ci && npm run dev      # 管理后台，http://localhost:5174/admin/
cd portal && npm ci && npm run dev   # 默认主题，http://localhost:5173/
```

两者都把 `/api/*` 代理到 `http://localhost:8080`，可以同时启动。

## 构建

`make build-web` 分别构建 `web/`（管理后台 → `web/dist/admin/`）和 `portal/`（默认主题 → `portal/dist/`）。后端直接从这两个目录读取，无需组装脚本。

## 运行路径

- 公开主题：`/`、`/servers/*`、`/monitors/*`；
- 管理后台：`/admin/*`，包括 `/admin/login` 和 OAuth/OIDC 回调；
- 管理后台资源：`/admin/assets/*`；
- 活动主题资源：`/theme-assets/*`。
