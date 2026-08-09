# Pika Web

Web 前端由两个相互隔离的 React/Vite 应用和一个主题 SDK 组成：

- `admin/`：官方管理后台、登录和 OAuth/OIDC 回调，只发布到 `/admin/assets/*`；
- `portal/`：官方默认公开主题，只发布到 `/theme-assets/*`，构建后封装为不可删除的 `default-theme`；
- `theme-sdk/`：第三方主题可依赖的稳定公开 API 与 TypeScript 契约；
- 三个目录分别维护自己的 `package.json` 和 `package-lock.json`，根 `web` 不再是 npm workspace。

两个 React 项目没有跨目录源码 import。第三方主题也不能引用 `admin` 或 `portal` 源码。

`portal/src/components` 只放跨页面共享的 UI；服务器和监控页面的私有卡片、区块及图表分别与页面放在 `portal/src/pages/servers` 和 `portal/src/pages/monitors`，避免把所有页面片段都提升为全局组件。

分别开发和构建：

```bash
cd web/admin && npm ci && npm run dev
cd web/portal && npm ci && npm run dev
cd web/theme-sdk && npm ci && npm run build
```

默认开发地址分别为 portal `http://localhost:5173/`、admin `http://localhost:5174/admin/`，两者都把 `/api/*` 代理到 `http://localhost:8080`，可以同时启动。portal 只在生产构建时使用 `/theme-assets/` 资源前缀。

`admin` 和 `portal` 都只向各自目录的 `dist/` 输出。仓库发布构建使用 `make build-web` 独立安装和编译三个项目，再组装、校验以下服务端产物：

```text
dist/admin/index.html
dist/admin/assets/*
dist/default-theme/pika-theme.json
dist/default-theme/dist/index.html
dist/default-theme/dist/assets/*
```

运行路径固定为：

- portal：`/`、`/servers/*`、`/monitors/*`；
- admin：`/admin/*`，包括 `/admin/login` 和 OAuth/OIDC 回调；
- admin 资源：`/admin/assets/*`；
- 活动主题资源：`/theme-assets/*`。
