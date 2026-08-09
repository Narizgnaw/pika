# Pika 主题使用与开发指南

Pika 的第三方主题是一个完整的公开页面 SPA。它可以替换服务器列表、服务器详情、监控列表和监控详情，但不能替换登录页、OAuth/OIDC 回调或管理后台。

## 管理员使用

进入“管理后台 → 系统设置 → 主题管理”后，可以：

- 上传本地 ZIP 安装主题；
- 查看预览、兼容状态、作者和版本；
- 启用、配置或删除主题。

默认主题 `default` 随 Pika 构建发布，不允许覆盖或删除。当前主题目录、清单或入口损坏时，Pika 会整体回退到默认主题并修正活动主题配置。当前启用的第三方主题必须先切换到其他主题才能删除。

主题切换不会刷新管理后台。打开或刷新公开页面即可看到新主题。系统名称、自定义 CSS/JS 等公开配置保存后同样在公开页面刷新时生效。

### 服务端配置

```yaml
App:
  Theme:
    Dir: "./data/themes"
```

- `PIKA_THEME_DIR` 非空时覆盖 `Dir`；
- SQLite 与 PostgreSQL Docker 部署都必须持久化 `/app/data`。

## 安全边界

第三方主题包含 JavaScript，并与 Pika 在同一 origin 执行。它是“受信任插件”，不是 CSS 皮肤，也不是安全沙箱。主题可以读取浏览器同源存储并访问同源 API，因此只应安装完全信任、能审查源码和发布流程的主题。

Pika 会校验 ZIP 路径、符号链接、文件数量、解压大小、清单、入口和预览图，但这些检查不能证明主题 JavaScript 没有恶意行为。

登录页和管理后台始终从官方 `/admin/assets/*` 加载；第三方主题只从 `/theme-assets/*` 加载。管理员设置的 `customCSS` 和 `customJS` 也只注入公开主题入口。

## 主题包格式

ZIP 根目录必须直接包含以下内容，不能额外套一层目录：

```text
pika-theme.json
preview.png
dist/
├── index.html
└── assets/
    ├── index-<content-hash>.js
    └── index-<content-hash>.css
```

`dist/index.html` 是固定入口。所有构建资源必须使用 `/theme-assets/` 绝对前缀，并建议使用内容 hash 文件名。

Vite 示例：

```ts
import {defineConfig} from 'vite';

export default defineConfig(({command}) => ({
  base: command === 'serve' ? '/' : '/theme-assets/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
}));
```

入口 HTML 建议保留注入点：

```html
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- pika:head -->
</head>
<body>
  <div id="root"></div>
  <!-- pika:body -->
</body>
```

服务端会在响应入口时注入 `window.PikaRuntime`，并设置站点标题、description 和 `/api/logo` favicon。没有注入标记时，会在 `</head>` 和 `</body>` 前注入。

## 清单示例

```json
{
  "schemaVersion": 1,
  "id": "pika-minimal",
  "name": "Pika Minimal",
  "description": "简洁状态页",
  "version": "1.2.0",
  "author": "example",
  "homepage": "https://github.com/example/pika-minimal",
  "license": "MIT",
  "preview": "preview.png",
  "entry": "dist/index.html",
  "apiVersion": "v1",
  "capabilities": [
    "server-list",
    "server-detail",
    "monitor-list",
    "monitor-detail"
  ]
}
```

`id` 只能包含字母、数字、下划线和连字符，最长 64 字符；`default`、`admin`、`official`、`system`、`api`、`assets` 和 `theme-assets` 是保留名称。四项核心 capability 缺一时主题不可启用。

## 公开 API 与 SDK

主题启动时可读取：

```ts
window.PikaRuntime
```

也可以请求：

```http
GET /api/config
```

该接口只返回公开字段，不返回 Logo Base64、自定义 CSS/JS 原文、JWT/OAuth Secret、API Key、通知或 DNS 凭据。

稳定 TypeScript 契约位于 `web/theme-sdk`。官方默认主题 `web/portal` 也使用同一个 SDK，通过 `pika` 客户端取得公开数据，通过 `getRuntimeConfig()` 读取注入配置。第三方主题不得引用 `web/admin` 或 `web/portal` 源码，也不应复制管理 API 或自行维护第二套请求封装。站内链接使用以 `/` 开头的绝对路径，以保证直接刷新 SPA 路由时仍由 Pika 正确回退到主题入口。

## 打包前检查

发布 ZIP 前至少确认：

1. `pika-theme.json` 位于 ZIP 根目录，ID 与主题一致；
2. `dist/index.html` 和预览图片存在；
3. JS/CSS 引用 `/theme-assets/` 且文件名包含内容 hash；
4. `/`、`/servers/:id`、`/monitors`、`/monitors/:id` 可直接刷新；
5. 不依赖管理后台源码或未公开 API；
6. 在 light、dark、system 和移动宽度下测试。
