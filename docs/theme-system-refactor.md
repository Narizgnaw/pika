# Pika 可安装主题系统

Pika 的「主题」是一套可安装的公开页面 SPA。它可以替换公开首页、服务器详情、监控列表和监控详情，但**不能**替换登录页、OAuth/OIDC 回调或管理后台。

本文描述当前已落地的实现形态，是代码改动的验收基线。

## 1. 设计取舍与安全定位

### 1.1 当前形态：单 origin，无主题市场

Pika 公开主题和管理后台运行在**同一 origin**，由单个 Pika 进程通过路由前缀区分：

```text
/api/*、/ws/*           → Pika Go API / WebSocket
/admin/*                → 官方管理 SPA（web/dist/admin），不允许主题覆盖
/admin/assets/*         → 官方管理静态资源
/theme-assets/*         → 当前公开主题静态资源
其他公开 GET 路径        → 当前公开主题入口（运行时渲染注入）
```

主题来源**只有一种**：管理员本地上传 ZIP。Pika 不从远程地址下载主题，也不提供主题市场。

**没有主题市场、没有远程下载、没有自动更新**。曾考虑过可配置的远程主题索引（市场）和 URL/GitHub Release 安装，但由于下面的安全约束，这些能力在单 origin 模型下会引入不可接受的攻击面，因此全部移除。

### 1.2 同源执行风险（必须理解的前提）

第三方主题包含 JavaScript，并在 Pika 公开站点的**同一 origin** 执行。它本质上是「受信任插件」，不是无权限皮肤，也不是安全沙箱：

- 主题可以读取浏览器同源存储（包括 localStorage 中的登录 token）；
- 主题可以带着浏览器自动附加的凭证发起同源 API 请求；
- 即使把登录态从 localStorage 换成 HttpOnly Cookie，HttpOnly 只阻止「JS 读取 Cookie 值」，**不阻止**「JS 发起带凭证的认证请求」。

Pika 是单用户系统，登录 token 即全站最高权限。因此**恶意主题 = 管理后台被完全接管**，进而等于所有被监控服务器的信息暴露。

正因如此，当前的安全策略是：

1. **不提供公开主题市场，不做远程下载**，避免「任何人都能投毒主题」的入口；
2. 主题来源限于「管理员本地上传 ZIP」，安全责任收敛到「管理员是否信任该来源」；
3. 安装、启用时强制展示「主题是同源可信代码、非沙箱」的警告并二次确认；
4. 管理后台、登录页、认证回调**始终**从官方 `/admin/assets/*` 加载，第三方主题只从 `/theme-assets/*` 加载。

### 1.3 未来若要开放无审核市场的前置条件

如果未来确实需要开放「任何人可提交」的主题市场，**必须先完成 origin 隔离**，例如：

```text
status.example.com   # 公开主题（低信任）
admin.example.com    # 管理后台 + 认证（高信任）
```

不同 origin 后，公开主题的 JS 物理上无法读取 admin origin 的存储或发起带凭证的 admin API 请求。

实现方式推荐「单进程 + Host 分流」（仍是单个 Pika 二进制，按 Host 头选择返回 admin SPA 还是公开主题），而非双进程。当前代码的主题管理逻辑（安装/ZIP 安全/清单校验/渲染缓存/文件系统回滚）完全不关心 origin，origin 隔离只需要调整路由层，绝大多数代码可原样复用。

**在完成 origin 隔离之前，不应重新引入主题市场。**

## 2. 目录结构

### 2.1 源码目录

```text
web/
├── admin/          # 独立的官方管理 React/Vite 项目（base: /admin/）
├── portal/         # 独立的官方默认主题 React/Vite 项目（生产 base: /theme-assets/）
├── theme-sdk/      # 第三方主题开发契约和 TypeScript 类型
└── scripts/        # 组装并校验服务端 Web 产物
```

`admin`、`portal`、`theme-sdk` 分别维护依赖、锁文件和构建产物，根 `web` 不是 npm workspace。admin 与 portal 不共享源码，也不能相互 import；admin 不依赖 theme-sdk，portal 通过 `file:../theme-sdk` 依赖 theme-sdk。第三方主题只能依赖 `theme-sdk`。

### 2.2 构建产物

```text
web/dist/
├── admin/
│   ├── index.html
│   └── assets/
└── default-theme/
    ├── pika-theme.json
    ├── preview.png（或 dist/logo.png）
    └── dist/
        ├── index.html
        └── assets/
```

`web/scripts/assemble-web.mjs` 把 admin 和 portal 各自的构建产物组装到上述结构；`web/scripts/verify-dist.mjs` 校验 admin 的 HTML 含 `/admin/assets/` 且不含 `/theme-assets/`，portal 的 HTML 含 `/theme-assets/` 且不含 `/admin/assets/`——这是防止主题与后台资源前缀串台的硬护栏。

### 2.3 运行时安装目录

```text
data/themes/
├── pika-minimal/
│   ├── pika-theme.json
│   ├── preview.png
│   └── dist/
└── ...
```

`default` 主题不复制到 `data/themes`，始终从 `web/dist/default-theme` 读取，且不可删除或覆盖。

## 3. 后端模块结构

主题后端逻辑按职责拆分在 `internal/service/` 下，共享状态集中在 `ThemeService` 结构体：

```text
internal/service/
├── theme_service.go        # 常量/错误/正则、ThemeService 结构体、构造函数
├── theme_manager.go        # 列表/安装/启用/删除/活动主题回退
├── theme_manifest.go       # 清单解析与字段校验
├── theme_archive.go        # ZIP 安全解压
├── theme_filesystem.go     # 默认主题访问、路径校验、启动恢复
├── theme_renderer.go       # 入口 HTML 运行时注入与缓存
└── theme_service_test.go   # 上述能力的单元测试

internal/models/theme.go                    # 清单与外观的数据模型
internal/handler/theme_handler.go           # 主题管理 HTTP handler
internal/handler/web_handler.go             # 公开配置 / 静态资源 / SPA fallback
```

主题数据全部存放在文件系统，**不经过数据库**。`ThemeService` 不持有 `*gorm.DB`，所有操作（列表/安装/启用/删除）都是对 `data/themes` 目录的扫描与文件操作。唯一需要持久化的运行时状态是「当前启用哪个主题」，通过 `appearance_config` Property 存储。

## 4. 主题包协议

### 4.1 ZIP 结构

ZIP 根目录必须直接包含清单，不允许额外套一层目录：

```text
pika-minimal.zip
├── pika-theme.json
├── preview.png
└── dist/
    ├── index.html
    └── assets/
```

### 4.2 `pika-theme.json`

```json
{
  "schemaVersion": 1,
  "id": "pika-minimal",
  "name": "Pika Minimal",
  "description": "简约服务器状态主题",
  "version": "1.2.0",
  "author": "example",
  "homepage": "https://github.com/example/pika-minimal",
  "license": "MIT",
  "preview": "preview.png",
  "entry": "dist/index.html",
  "apiVersion": "v1",
  "capabilities": ["server-list", "server-detail", "monitor-list", "monitor-detail"]
}
```

### 4.3 字段约束

- `schemaVersion`：必须为 `1`。
- `id`：正则 `^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$`，保留名 `default`/`admin`/`official`/`system`/`api`/`assets`/`theme-assets`，大小写不敏感。
- `version`：主题版本号，仅作展示。
- `entry`：必须是 `dist/index.html`。
- `apiVersion`：必须为 `v1`。
- `capabilities`：四项核心能力 `server-list`/`server-detail`/`monitor-list`/`monitor-detail` 缺一不可。
- `preview`：包内相对路径，最大 5 MiB。

## 5. 数据模型

主题数据全部存放在文件系统，不使用数据库表。`pika-theme.json` 是主题元数据的唯一事实来源，运行时直接扫描目录读取。唯一需要持久化的是「当前启用哪个主题」：

```go
const PropertyIDAppearanceConfig = "appearance_config"

type AppearanceConfig struct {
    ActiveTheme      string `json:"activeTheme"`      // 默认 "default"
    DefaultColorMode string `json:"defaultColorMode"` // 默认 "system"
}
```

浏览器用户的个人明暗偏好保存在浏览器本地；`defaultColorMode` 只在用户没有个人偏好时生效。

## 6. HTTP API

### 6.1 公开配置

```http
GET /api/config
```

只返回公开字段（系统名称、Logo 路径、ICP、版本、默认视图、默认明暗模式、当前主题 id/version、功能开关）。不返回 Logo Base64 原文、customJS/customCSS 原文、JWT/OAuth Secret、API Key、通知渠道、DNS 凭据。

### 6.2 管理接口（均在 `/api/admin/themes` 下，需管理员认证）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | 列出所有主题（含默认） |
| POST | `/upload` | 上传 ZIP 安装（multipart `file`） |
| PUT | `/:id/activate` | 启用主题（重新校验清单/入口/兼容性） |
| DELETE | `/:id` | 删除主题（default 和当前启用主题不可删） |
| GET | `/:id/preview` | 读取预览图 |

上传新主题时 id 已存在返回 `409`；当前启用主题不可删除返回 `409`；默认主题不可删除/修改返回 `400`。

## 7. 静态资源与 SPA 路由

路由优先级（由具体前缀到通配）：

1. `/api/*`、`/ws/*`：API 与 WebSocket。
2. `/admin/assets/*`：官方管理静态资源，禁止目录浏览/穿越/HTML5 fallback。
3. `/theme-assets/*`：当前主题 `dist/*`，缺失文件返回 404，不逐文件回退默认主题。
4. `/admin`、`/admin/*`：官方管理 SPA，返回管理 `index.html`（含登录与认证回调）。
5. 公开 GET 请求：路径对应主题真实文件则返回文件；带扩展名但文件不存在返回 404；其余返回渲染后的当前主题 `index.html`；当前主题入口损坏则整体回退默认主题。
6. 非 GET 或未知 `/api/*`：JSON 404，绝不返回 SPA HTML。

全局静态中间件已删除，改为显式 handler。官方和主题静态文件统一设置 `X-Content-Type-Options: nosniff` 和 `Referrer-Policy: strict-origin-when-cross-origin`；HTML 入口 `Cache-Control: no-cache`，hash 资源 `immutable`。

## 8. 入口 HTML 运行时渲染

服务端读取主题 `index.html`，在内存注入 `window.PikaRuntime`（只含公开配置），并设置 `<title>`、`<meta description>`、`<link icon>`。主题可在 HTML 中放 `<!-- pika:head -->`/`<!-- pika:body -->` 标记控制注入点，否则注入到 `</head>`/`</body>` 前。`customCSS`/`customJS` 单独注入到公开入口（不注入管理入口）。渲染结果按 `theme id + version + index 内容 + SystemConfig/Appearance UpdatedAt + pika version` 缓存，主题切换后主动清缓存。

HTML 转义使用 `html/template` 和 `encoding/json`，禁止字符串拼接生成 `<script>` 内 JSON。

## 9. 安装、更新与回滚

### 9.1 安装流程

```text
接收 ZIP → 写入 staging → 校验大小/文件数 → 安全解压 → 校验清单/入口/预览 → 检查 id 冲突 → rename 到正式目录 → 健康检查 → 清理 staging
```

任一步失败删除 staging，不触碰已安装主题。

### 9.2 覆盖安装

上传的 ZIP 与已安装主题 id 相同时，走覆盖安装（`installArchiveLocked` 的 replace 模式）：

```text
取写锁 → 校验且新包 id 与目标一致 → 原目录 rename 为 .backup-* → 新目录 rename 为正式 → 健康检查 → 删 backup
```

健康检查失败时移走新目录、backup rename 回正式、继续用旧主题、记录日志。

### 9.3 启动恢复

进程可能在原子替换期间被杀，启动时执行：清理 24h 以上的 staging；唯一有效 `.backup-*` 恢复；正式与备份并存时以校验通过的正式为准；状态不明则保留全部并告警，活动主题回退默认。

### 9.4 活动主题回退

`appearance_config.activeTheme` 为空、目录缺失、清单损坏、入口缺失时，自动回退默认主题并修正配置（用 `fallbackMu` 串行化，避免每个请求都写库）。

## 10. ZIP 安全

### 10.1 硬上限（代码内固定，不可配置关闭）

```text
压缩包最大 64 MiB | 最大文件数 5000 | 单文件最大 64 MiB | 解压总大小 256 MiB | 清单 1 MiB | 预览图 5 MiB
```

### 10.2 路径与文件类型防御

ZIP Slip（`../`）、绝对路径、Windows 盘符、反斜杠、符号链接、硬链接、设备文件、命名管道、大小写重复、Unicode 归一化重复、清单路径越界、文件数/总大小溢出。只解压普通文件和目录，权限归一化为目录 0755 / 文件 0644。

## 11. 前端构建

- `web/admin`：`base: '/admin/'`，独立 React + antd 项目，自带 HTTP 客户端和 `ColorModeContext`，不依赖 theme-sdk。
- `web/portal`：`base: 生产 '/theme-assets/' / 开发 '/'`，默认主题，所有数据访问经 `@pika-monitor/theme-sdk` 的 `pika` 客户端。
- `web/theme-sdk`：导出 `pika` 客户端、`PikaRuntimeConfig`/`PikaThemeManifest` 等类型、`getRuntimeConfig`/`resolveColorMode` 工具。源码即产物（`tsc --noEmit` 仅类型检查）。

`make build-web` 依次构建 theme-sdk（类型检查）→ admin → portal，再 assemble + verify。

## 12. 管理后台交互

「系统设置 → 主题管理」包含：

- 当前主题信息、已安装主题卡片（预览图、名称、版本、作者、兼容状态）；
- 启用、删除；
- 上传 ZIP；
- 所有安装/启用统一经「主题是同源可信代码、非沙箱」的红色二次确认 Modal；
- 页面顶部常驻安全提示。

按钮约束：当前主题不显示删除；默认主题不显示删除；不兼容主题可查看可删除但不能启用；操作期间禁止重复提交；启用成功不刷新管理 SPA，只提示公开页面已切换。

## 13. 配置

```yaml
App:
  Theme:
    Dir: "./data/themes"
```

- `PIKA_THEME_DIR` 非空时覆盖 `Dir`；
- SQLite 与 PostgreSQL Docker 部署都必须持久化 `/app/data`。

## 14. 测试覆盖

Go 单元测试覆盖：ZIP 安全（slip/绝对路径/盘符/symlink/大小写·Unicode 重复/文件数超限）、清单校验（保留 id/非法 schema·api/缺 capability）、HTML 元数据转义、文件系统恢复、完整安装/启用/删除生命周期。

## 15. 不做的事（明确边界）

- 不提供主题市场、不做远程下载、不做自动更新（见 §1.1）；
- 不做 origin 隔离（当前单进程单 origin；未来开放市场的前置条件，见 §1.3）；
- 不改前端 admin/portal/theme-sdk 的项目结构和构建。
