# MakeContents

基于 RSSHub 的 AI 资讯聚合与内容创作工具。

订阅 RSS/RSSHub 信源 → 自动拉取资讯 → AI 翻译 / 筛选 → 一键推送微信 / 同步飞书 → 图文内容创作与渲染。

---

## 功能概览

| 模块 | 功能 |
|---|---|
| **资讯聚合** | 支持 RSSHub 路由和标准 RSS 链接，按信源分组展示，正向/黑名单关键词双重过滤 |
| **AI 翻译** | 对指定信源自动调用大模型翻译为中文，标题和摘要分别翻译 |
| **AINews** | 大模型结构化提炼标题与摘要，并行推送微信（私信/群聊）并写入飞书每日知识库文档 |
| **内容创作** | 图片上传 + 大模型生成封面文案，渲染 1080×1440 封面图与详情图，小红书风格实时预览 |
| **信源管理** | 可视化增删改信源，支持开关、拉取条数、翻译开关 |
| **系统配置** | 翻译/编辑/创作三套大模型独立配置，飞书、微信推送参数，关键词过滤 |

---

## 技术栈

- **后端**：Node.js + Express 5 + SQLite（better-sqlite3）
- **前端**：React 18 + React Router 6
- **渲染**：Puppeteer（Headless Chrome）截图，支持彩色 Emoji 和中文字体
- **信源**：RSSHub + rss-parser

---

## 本地开发

### 前置要求

- Node.js 20+
- 本地运行中的 RSSHub（默认 `http://localhost:1200`）
- macOS 需安装 Google Chrome（渲染图片用）

### 启动

```bash
git clone https://github.com/your-name/MakeContents.git
cd MakeContents

# 复制环境变量模板
cp backend/.env.example backend/.env

# 一键启动（自动安装依赖）
./start.sh
```

启动后访问：
- 前端：`http://localhost:3711`
- 后端 API：`http://localhost:3710/api`

### 仅启动后端（生产模式）

```bash
cd frontend && npm run build   # 构建前端
cd ../backend && node index.js # 启动，访问 http://localhost:3710
```

---

## Docker 部署

项目已包含完整的 Docker Compose 配置，内含 MakeContents 主服务 + RSSHub + Redis。

```bash
# 克隆项目
git clone https://github.com/your-name/MakeContents.git
cd MakeContents

# 构建并启动
docker compose up -d --build

# 查看日志
docker compose logs -f makecontents
```

访问 `http://服务器IP:3710`。

> **注意**：若服务器已运行独立 RSSHub，可删除 `docker-compose.yml` 中的 `rsshub` 和 `redis` 服务，并修改 `RSSHUB_URL` 指向现有实例。

### 数据持久化

Docker Compose 自动创建两个 named volume：

| Volume | 内容 |
|---|---|
| `makecontents-data` | SQLite 数据库 |
| `makecontents-uploads` | 上传图片与渲染产物 |

---

## 系统配置说明

首次运行后进入「系统配置」页面完成以下配置：

### 大模型

翻译、编辑（AINews）、创作（MakeContent）三个场景可使用不同模型。兼容所有 OpenAI 接口格式（DeepSeek、通义、Kimi 等）。

| 字段 | 说明 |
|---|---|
| 模型名称 | 如 `deepseek-chat`、`gpt-4o` |
| Base URL | 如 `https://api.deepseek.com`（末尾无需加 `/v1`） |
| API Key | 对应平台的密钥 |
| 系统提示词 | 留空使用内置默认值 |

### 飞书

在[飞书开放平台](https://open.feishu.cn/)创建自建应用，开通文档读写权限。

| 字段 | 说明 |
|---|---|
| App ID / App Secret | 应用凭证 |
| Space ID | 知识库 ID |
| 父节点 Token | AINews 文档存放的父节点 |

### 微信推送

使用 [aibotk](https://api-bot.aibotk.com) 微信机器人 API。支持配置多个 wxid 和群聊，发送间隔随机 5-10 秒。

### 关键词过滤

- **正向关键词**：只有命中列表中任意关键词的资讯才显示（留空则全部显示），默认仅匹配标题
- **屏蔽关键词**：包含关键词的资讯直接过滤，不进入数据库

---

## 目录结构

```
MakeContents/
├── backend/
│   ├── db/            # SQLite 初始化
│   ├── routes/        # API 路由（sources / news / config / content）
│   ├── services/      # 业务逻辑（RSS拉取、LLM、微信、飞书、渲染）
│   ├── .env.example   # 环境变量模板
│   └── index.js       # 服务入口（端口 3710）
├── frontend/
│   └── src/
│       ├── pages/     # 四个页面（首页、信源、配置、内容创作）
│       ├── components/
│       └── services/  # API 封装
├── style_demos/       # 封面/详情图样式参考
├── Dockerfile
├── docker-compose.yml
└── start.sh           # 本地一键启动脚本
```

---

## License

MIT
