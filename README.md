# funflix-web

[funflix](https://github.com/farfarfun/funflix) 的 Web 界面。**一个进程同时提供前后端**，固定监听 `8810`：

| 路径 | 内容 |
| --- | --- |
| `/web` | 前端界面（Vue 3 单页应用）|
| `/api/v1` | 后端接口 |
| `/docs` | OpenAPI 文档 |
| `/healthz` | 健康检查 |
| `/` | 重定向到 `/web` |

后端不是重写的：直接复用 funflix 的 `create_app()`，在它之上叠一层前端静态托管。
所以 funflix 的路由、启动探库、进程内 worker 全部原样保留。

## 界面

**发现** —— 面向使用者

- **作品检索**：按剧名搜索（支持别名与简繁），按类型 / 年份筛选，可只看有可用资源的作品
- **作品详情**：别名、归一键、全部网盘链接及其画质、大小、校验状态，一键复制链接与提取码
- **网盘资源**：按网盘、校验状态翻页排查链接

**运维** —— 面向维护者

- **流水线大盘**：采集 → 抽取 → 作品/资源 → 校验各环节的记录数与分布，网盘有效率
- **采集源**：登记、启停、删除、立即采集一次
- **原始文本**：按解析状态 / 来源翻页，查看全文与解析错误

## 快速开始

```bash
# 1. 装后端（会以可编辑方式装上同级目录的 funflix）
uv venv && uv pip install -e ".[dev]"

# 2. 建库（在 funflix 仓库里执行）
cd ../funflix && alembic upgrade head && cd -

# 3. 构建前端
cd frontend && pnpm install && pnpm build && cd -

# 4. 起服务
funflix-web serve
# → http://127.0.0.1:8810/web
```

没构建前端也能起：后端接口照常可用，`/web` 会返回构建提示而不是一个没头没脑的 404。

## 开发

前端改动频繁时用 vite 的 HMR，接口交给真实后端：

```bash
make dev          # 并行起下面两个
# funflix-web serve --reload   → 8810，提供 /api
# cd frontend && pnpm dev      → 5173，/api 代理到 8810
```

开发时访问 `http://127.0.0.1:5173`（不是 8810）。`vite.config.ts` 里把 `/api`
与 `/healthz` 都代理到了 8810，所以不会有跨域问题。

```bash
make build        # 构建前端到 src/funflix_web/static
make test         # 两个仓库的测试
make lint         # ruff + vue-tsc
```

## 管理密钥

浏览与搜索**不需要**任何密钥。写操作（登记 / 修改 / 删除采集源、触发采集）
走 funflix 的 `AdminDep`，要求 `X-API-Key` 头，值是服务端的 `FUNFLIX_ADMIN_API_KEY`：

```bash
FUNFLIX_ADMIN_API_KEY=你的密钥 funflix-web serve
```

在界面左下角「管理密钥」里填入同一个值即可解锁写操作。没填时相关按钮会置灰
并给出说明，而不是等你点下去再吃一个 403。

密钥存在浏览器的 localStorage 里 —— 这是个自部署的本地工具，没有登录体系可挂靠。
**因此不要把这个界面直接暴露到公网。**

## 配置

所有后端配置继承自 funflix，走 `FUNFLIX_` 前缀的环境变量或 `.env`：

| 变量 | 说明 |
| --- | --- |
| `FUNFLIX_DATABASE_URL` | 数据库地址，默认本地 SQLite |
| `FUNFLIX_ADMIN_API_KEY` | 写接口的密钥，不配则写接口全部 403 |
| `FUNFLIX_WORKER_ENABLED` | 是否在本进程内跑后台 worker，默认 `false` |

## 为什么端口固定 8810

前端构建产物里的资源路径以 `/web/` 为前缀（`vite.config.ts` 的 `base`），
前端路由的 history base 也是 `/web/`，开发态的代理目标同样写死 8810。
这三处必须一致，所以端口不是随手可改的运行时参数。真要改，
`serve --port` 能改监听端口，但开发态代理需要同步改 `vite.config.ts`。

## 技术选型

- **后端**：复用 funflix 的 FastAPI 应用，只加静态托管与 `/` 重定向
- **前端**：Vue 3 + TypeScript + Vite + Naive UI，组件按需引入（全量引入会多打进 1.2MB）
- **SPA 回退**：`/web/**` 找不到文件时回退 `index.html` 交给前端路由，
  但 `assets/**` 与带扩展名的路径照常 404 —— 否则缺个 JS 会返回 HTML，
  浏览器报的错会跟真实原因（文件不存在）完全对不上
