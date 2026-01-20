# AutoTemu

全栈应用开发框架 | FastAPI 后端 + Next.js 前端 + 浏览器扩展

## 项目概述

AutoTemu 是一个完整的全栈项目根基，提供了现代化的前后端分离架构。项目包含：

- **后端服务** - 基于 FastAPI 的高性能 RESTful API
- **管理系统** - Next.js 构建的现代化前端应用
- **浏览器扩展** - Plasmo 框架的跨浏览器扩展

适用于快速搭建企业级应用、学习现代全栈开发、或作为新项目的技术基础。

## 核心特性

- 🚀 **一键启动** - Docker Compose 快速启动完整开发环境
- 🔐 **生产就绪** - 内置 JWT 认证、数据库迁移、API 文档
- 🎨 **现代化 UI** - Shadcn/UI 组件库 + Tailwind CSS
- 🛠️ **开发友好** - Pre-commit hooks、代码检查、自动格式化
- 📦 **完整技术栈** - 后端 API + 前端应用 + 浏览器扩展
- 🐳 **生产部署** - Docker + Traefik + 自动 HTTPS
- 🧩 **通用模块** - 统一异常处理、API 响应格式、共享类型库
- 📋 **团队协作** - 完整的开发规范、API 标准、贡献指南

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                     用户界面层                                │
├─────────────────────────────────────────────────────────────┤
│  Next.js 前端     │  浏览器扩展 (Plasmo)  │  移动应用 (未来)  │
│  (localhost:3000) │  (Chrome/Firefox)    │                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     反向代理层                                │
├─────────────────────────────────────────────────────────────┤
│  Traefik (生产)  │  直连 (开发)                              │
│  自动 HTTPS      │  localhost:8000                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     应用层                                    │
├─────────────────────────────────────────────────────────────┤
│  FastAPI Backend                                            │
│  • RESTful API (OpenAPI 文档)                               │
│  • JWT 认证与授权                                            │
│  • SQLModel ORM                                             │
│  • Alembic 数据库迁移                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     数据层                                    │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL 17                                              │
│  • 关系型数据存储                                            │
│  • Adminer Web管理界面                                       │
└─────────────────────────────────────────────────────────────┘
```

详见 [架构设计](docs/architecture.md)

## 项目结构

```
AutoTemu/
├── shared/              # 🆕 共享类型库（前后端通用）
│   ├── types/           # 类型定义
│   │   ├── api.ts       # API 响应格式、状态码
│   │   ├── errors.ts    # 错误类型定义
│   │   └── common.ts    # 通用类型
│   └── package.json     # npm 包配置
├── backend/             # FastAPI 后端
│   ├── app/             # 应用核心代码
│   │   ├── api/         # API 路由模块
│   │   ├── common/      # 🆕 通用模块
│   │   │   ├── exceptions.py  # 统一异常处理
│   │   │   ├── responses.py   # 统一响应格式
│   │   │   ├── schemas.py     # 通用 Schema
│   │   │   └── handlers.py    # 异常处理器
│   │   ├── core/        # 核心配置（认证、数据库）
│   │   ├── models.py    # SQLModel 数据模型
│   │   └── crud.py      # CRUD 操作
│   ├── tests/           # 后端单元测试
│   ├── alembic/         # 数据库迁移脚本
│   ├── pyproject.toml   # Python 依赖
│   └── README.md        # 后端文档
├── frontend/            # Next.js 前端
│   ├── src/
│   │   ├── app/         # App Router 页面和路由
│   │   ├── components/  # React 组件库
│   │   └── lib/         # 工具函数和 API 客户端
│   ├── package.json     # 前端依赖
│   └── README.md        # 前端文档
├── extension/           # Plasmo 浏览器扩展
│   ├── src/
│   │   ├── popup/       # 扩展弹窗界面
│   │   ├── pages/       # 扩展独立页面
│   │   └── components/  # 扩展组件库
│   ├── package.json     # 扩展依赖
│   └── README.md        # 扩展文档
├── docs/                # 项目文档
├── scripts/             # 实用脚本（备份、恢复等）
├── docker-compose.yml   # 生产环境配置
├── docker-compose.dev.yml  # 开发环境配置
├── .env.example         # 环境变量示例
└── README.md            # 本文件
```

## 快速开始

### 前置要求

- [Docker Desktop](https://www.docker.com/products/docker-desktop) 20.10+
- [Node.js](https://nodejs.org/) 18+ （仅需前端开发）
- [Python](https://www.python.org/) 3.10+ （仅需后端开发）
- [pnpm](https://pnpm.io/) 或 npm （前端项目管理器）

### 5 分钟启动

1. **克隆项目**
```bash
git clone https://github.com/your-org/AutoTemu.git
cd AutoTemu
```

2. **配置环境变量**
```bash
cp .env.example .env
# 根据实际情况编辑 .env 文件
```

3. **安装后端依赖和 Git Hooks**
```bash
cd backend
uv sync
cd ..

# 激活虚拟环境
.\backend\.venv\Scripts\Activate.ps1  # Windows
# source backend/.venv/bin/activate    # macOS/Linux

# 安装 pre-commit hooks
python -m pre_commit install

# 手动运行不提交
pre-commit run --all-files
```

4. **启动开发环境**

**终端 1 - 启动后端和数据库：**
```bash
docker compose -f docker-compose.dev.yml up
```

等待输出显示 "Alembic initialized" 和 "Initial data created"

**终端 2 - 启动前端：**
```bash
cd frontend
pnpm install
pnpm dev
```

**终端 3 - 启动浏览器扩展：**
```bash
cd extension
pnpm install
pnpm dev
```


5. **访问应用**

- 前端: http://localhost:3000
- 后端 API 文档: http://localhost:8000/docs (Swagger UI)
- 数据库管理: http://localhost:8080 (Adminer)
  - Server: `db`
  - Username: `postgres`
  - Password: `.env` 中的 `POSTGRES_PASSWORD`

## 技术栈

### 后端
- **框架**: FastAPI 0.114+ - 高性能异步 Web 框架
- **ORM**: SQLModel - 类型安全的 SQL 工具包
- **数据库**: PostgreSQL 17
- **认证**: JWT Token
- **迁移**: Alembic
- **测试**: Pytest + Coverage

### 前端
- **框架**: Next.js 15 - React 全栈框架
- **UI**: Shadcn/UI + Tailwind CSS
- **状态管理**: TanStack Query (React Query)
- **表单**: React Hook Form + Zod
- **认证**: next-auth v5
- **API 客户端**: openapi-fetch (自动生成类型)
- **测试**: Vitest + Playwright

### 浏览器扩展
- **框架**: Plasmo - 现代化扩展开发框架
- **支持**: Chrome, Firefox, Edge
- **技术**: TypeScript + React

### 基础设施
- **容器化**: Docker + Docker Compose
- **反向代理**: Traefik（自动 HTTPS）
- **代码质量**: Pre-commit hooks, Ruff, ESLint
- **CI/CD**: GitHub Actions (可配置)

更多技术选型说明，详见 [架构设计](docs/architecture.md)

## 通用模块

项目提供了统一的通用模块，用于保持前后端代码风格一致性。

### 共享类型库 (shared/)

前后端共享的 TypeScript 类型定义：

```typescript
import { ApiResponse, BusinessCode, AppError } from "@autotemu/shared";

// 使用统一的 API 响应类型
const response: ApiResponse<User> = {
  code: BusinessCode.SUCCESS,
  message: "操作成功",
  data: user,
  timestamp: new Date().toISOString(),
};
```

### 后端通用模块 (backend/app/common/)

统一的异常处理和响应格式：

```python
from app.common import (
    AuthenticationException,
    ResourceException,
    BusinessCode,
    success_response,
    paginated_response,
)

# 抛出统一格式的异常
raise ResourceException(
    code=BusinessCode.RESOURCE_NOT_FOUND,
    message="用户不存在"
)

# 返回统一格式的响应
return success_response(data=user, message="获取用户成功")
```

### API 响应格式

所有 API 统一使用以下响应格式：

```json
{
  "code": 0,
  "message": "操作成功",
  "data": { ... },
  "timestamp": "2025-01-12T10:30:00.000Z",
  "request_id": "uuid"
}
```

详见 [API 标准文档](docs/API-STANDARDS.md)

## 文档导航

### 团队协作
- [开发规范](docs/DEVELOPMENT.md) - 编码规范、命名规范、Git 工作流
- [API 标准](docs/API-STANDARDS.md) - 响应格式、状态码、错误处理
- [贡献指南](docs/CONTRIBUTING.md) - 开发环境、提交流程、PR 规范

### 开发指南
- [架构设计](docs/architecture.md) - 系统架构、设计决策、技术选型
- [API 开发](docs/api-development.md) - 后端开发、数据库操作、测试
- [前端开发](docs/frontend-development.md) - 组件开发、状态管理、路由
- [浏览器扩展](docs/extension.md) - 扩展开发、打包、发布

### 部署和运维
- [生产部署](docs/deployment.md) - Docker 部署、Traefik 配置、监控

## Git 工作流

### Pre-commit Hooks

项目配置了自动代码检查，在每次提交时执行：

**后端检查：**
```bash
cd backend
uv run ruff check --fix      # 自动修复代码格式
uv run ruff format           # 格式化代码
```

**前端检查：**
```bash
cd frontend
pnpm lint:fix                # 自动修复 TypeScript 和 ESLint 问题
pnpm format                  # 格式化代码
```

**Git 提交流程：**
```bash
# 1. 修改代码后提交
git add .
git commit -m "feat: 添加新功能"

# 2. 如果 hooks 检查失败，会自动修复，显示 "Fixed by ..." 消息
# 3. 根据需要重新提交
git add .
git commit -m "feat: 添加新功能"

# 4. 跳过检查（仅在紧急情况）
git commit --no-verify -m "快速修复"
```

### 分支管理

- `main/master` - 生产版本（保护分支）
- `develop` - 开发主分支
- `feature/xxx` - 功能分支
- `fix/xxx` - 修复分支

## 数据库连接

### 使用数据库工具连接（Navicat / DBeaver）

- Host: `localhost`
- Port: `15432` (避免与本地 PostgreSQL 冲突)
- Username: `postgres`
- Password: `.env` 中的 `POSTGRES_PASSWORD`
- Database: `app`

## 故障排查

### 后端相关

**后端无法启动或数据库连接失败**
```bash
# 检查容器状态
docker compose -f docker-compose.dev.yml ps

# 查看后端日志
docker compose -f docker-compose.dev.yml logs backend

# 查看数据库日志
docker compose -f docker-compose.dev.yml logs db

# 重启服务
docker compose -f docker-compose.dev.yml restart backend
```

**代码格式问题**
```bash
cd backend
uv run ruff check --fix    # 自动修复
uv run ruff format
```

### 前端相关

**前端编译错误或类型错误**
```bash
cd frontend
pnpm install               # 重新安装依赖
pnpm lint:fix             # 自动修复
pnpm type-check           # 检查类型错误
```

**修改代码后前端不更新**
- 确保终端中的 `pnpm dev` 仍在运行
- 清除浏览器缓存（Ctrl+Shift+Delete）
- 尝试手动刷新浏览器

### Docker 相关

**数据库连接错误**
```bash
# 清除并重建容器
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml up --build
```

**找不到模块或端口被占用**
```bash
# 查看所有容器
docker ps -a

# 停止特定容器
docker stop container_name

# 释放端口
# Windows: netstat -ano | findstr :8000
# macOS/Linux: lsof -i :8000
```

更多故障排查说明，详见 [部署文档](docs/deployment.md)

## 常用命令

### 后端

```bash
cd backend

# 激活虚拟环境
.\\.venv\Scripts\Activate.ps1      # Windows
# source .venv/bin/activate         # macOS/Linux

# 运行迁移
alembic upgrade head

# 创建新迁移
alembic revision --autogenerate -m "描述"

# 运行测试
pytest

# 查看覆盖率
pytest --cov=app --cov-report=html
```

### 前端

```bash
cd frontend

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 检查类型
pnpm type-check

# 运行测试
pnpm test

# 运行 E2E 测试
pnpm test:e2e
```

### 浏览器扩展

```bash
cd extension

# 安装依赖
pnpm install

# 启动开发模式
pnpm dev

# 构建生产版本
pnpm build
```

## 需要帮助？

- 查看详细文档：[docs/](docs/)
- 检查 [常见问题](docs/deployment.md#故障排查)
- 查看源代码注释
- 提交 Issue（如果是内部项目）

---

**开发人员最后更新**: 2025-01-12
**项目技术栈**: FastAPI | Next.js | PostgreSQL | Docker
