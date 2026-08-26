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

**发现** —— 面向使用者，不需要密钥

- **作品检索**：按剧名搜索（支持别名与简繁），按类型 / 年份筛选，可只看有可用资源的作品。
  筛选条件与页码都同步在地址栏里，刷新、前进后退、把链接发给别人都能还原同一个结果
- **作品详情**：别名、归一键、全部网盘链接及其画质、大小、校验状态，一键复制链接与提取码

**运维** —— 面向维护者，写操作与整表查询需要管理密钥

- **流水线大盘**：采集 → 抽取 → 作品/资源 → 校验各环节的记录数与分布，网盘有效率
- **采集源**：登记、启停、删除、立即采集一次
- **原始文本**：按解析状态 / 来源翻页，查看全文与解析错误
- **网盘资源**：按链接维度的全量清单，用于排查「某个网盘是不是大面积失效了」。
  它是整个资源库的平铺导出，后端要求管理密钥；使用者浏览内容走「作品检索」

## 快速开始

本仓库**不依赖 funflix 的源码检出**，funflix 按版本号从 PyPI 安装（见
`pyproject.toml` 的 `funflix>=0.1.4`，低于这个版本没有查询接口）。

```bash
scripts/setup.sh bootstrap        # 装 Python 与前端依赖
scripts/setup.sh build            # 构建前端
scripts/setup.sh start web dev    # → http://127.0.0.1:8810/web
```

没构建前端也能起：后端接口照常可用，`/web` 会返回构建提示而不是一个没头没脑的 404。

> **建库目前还需要 funflix 的源码仓库。** funflix 的 wheel 里不含 `migrations/`
> 与 `alembic.ini`（打包只收了 `src/funflix`），且 `funflix db upgrade` 用的是
> 相对路径 `Config("alembic.ini")`，在包安装场景下会报
> `No 'script_location' key found in configuration`。在上游把迁移一并打进包之前，
> 初始化数据库仍需在 funflix 仓库里执行 `alembic upgrade head`。
> 这是唯一还没解开的耦合，且只影响初始化，日常运行不需要 funflix 源码。

## 统一入口

对外只有 `scripts/setup.sh` 一个入口，服务级动作按 `动作 → 服务 → 环境` 解析。
参数给全就直接执行，缺哪个才问哪个。

```bash
# 开发
scripts/setup.sh bootstrap                # 装依赖
scripts/setup.sh build                    # 构建前端到 src/funflix_web/static
scripts/setup.sh test                     # 跑测试
scripts/setup.sh lint                     # ruff + vue-tsc + shell 语法
scripts/setup.sh clean                    # 清掉构建产物与 .run/

# 服务
scripts/setup.sh <start|stop|restart|run> <web|worker> <dev|prod>
scripts/setup.sh status [web|worker]      # 不交互，一次报全部环境

# 发布
scripts/setup.sh publish                  # 构建前端 + nltbuild 发布正式包
scripts/setup.sh install [版本号]          # 按精确版本装到 .run/prod-venv
```

脚本分工：`setup.sh` 只做解析与分发，`dev.sh` 管本地任务，`release.sh` 管发布与安装，
`services/*.sh` 各自持有端口与启动命令，`lib/service.sh` 放共享的 PID / 锁 / 优雅停止。

两个长期运行的服务：

| 服务 | 内容 | 端口 |
| --- | --- | --- |
| `web` | uvicorn，同时提供 `/api` 与 `/web` | 8810 |
| `worker` | `funflix worker`，采集 / 解析 / 校验 | 无 |

worker 独立成进程而不是打开 `FUNFLIX_WORKER_ENABLED`，理由在 funflix 的配置注释里：
进程内 worker 在 uvicorn 多进程部署下每个进程都会起一份，租约虽能防重复处理，
但会多出几倍空转轮询。

`start` 后台运行，PID、日志、锁都在 `.run/` 下，按「服务.环境」命名；
`run` 前台运行，Ctrl-C 直接停止。`web` 的 `run dev` 带热重载，`start dev` 不带 ——
`--reload` 会派生出 reloader 父子进程，后台启动时 PID 文件只认得父进程，停止会不可靠。

## 开发

前端改动频繁时用 vite 的 HMR，接口交给真实后端：

```bash
scripts/setup.sh run web dev      # 终端 A：8810，提供 /api，带热重载
cd frontend && pnpm dev           # 终端 B：5173，/api 代理到 8810
```

开发时访问 `http://127.0.0.1:5173`（不是 8810）。`vite.config.ts` 里把 `/api`
与 `/healthz` 都代理到了 8810，所以不会有跨域问题。

## 生产发布

开发可以直接跑工作树，生产只跑「已发布到仓库、再按精确版本装回来」的正式包 ——
`start prod` 找不到 `.run/prod-venv` 里的正式包时直接失败，不会回落到源码。

```bash
scripts/setup.sh publish            # 构建前端 → nltbuild 打包上传
scripts/setup.sh install 0.1.1      # 建干净 venv，精确版本装回来并校验
scripts/setup.sh start web prod
scripts/setup.sh start worker prod
```

`install` 装完会逐条校验：版本是否精确匹配、代码是否来自 site-packages 而非源码检出、
有没有可编辑安装残留、**前端产物是否随包装进来**、装回来的 funflix 是否带查询接口，
最后跑一次冒烟把路由列出来。任何一条不过就直接失败。

前端产物那条尤其重要：`src/funflix_web/static/` 在 `.gitignore` 里，而 hatchling 默认
跟随 VCS 忽略规则，`pyproject.toml` 里不显式声明 `artifacts` 的话，打出来的 wheel 里
一个静态文件都没有 —— 接口全正常，只有 `/web` 是空的，很难往打包上想。

> 注意：`funflix` 的 PyPI 版本必须先带上查询接口（M6），`funflix-web` 的正式包才能真正跑起来。
> 顺序是先发 funflix，再发 funflix-web。

`nltbuild build` 在构建后会把打出来的 wheel 装进当前环境做校验，这会顶掉开发用的可编辑安装 ——
之后改 `src/` 下的代码不再生效，服务照常起、跑的却是发布那一刻的快照，且没有任何提示。
`publish` 结束时会自动把可编辑安装装回去。

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

- **后端**：复用 funflix 的 FastAPI 应用，只加静态托管、压缩与 `/` 重定向
- **前端**：Vue 3 + TypeScript + Vite + Naive UI，组件按需引入（全量引入会多打进 1.2MB）
- **传输**：开了 gzip，并按文件类型给缓存策略 —— 首屏从 525KB 降到 163KB。
  `assets/` 下的文件名带内容 hash，给 `immutable` 永久缓存；`index.html` 给 `no-cache`，
  它是唯一记录「该加载哪些 hash 资源」的地方，缓存住的话重新部署永远不生效
- **SPA 回退**：`/web/**` 找不到文件时回退 `index.html` 交给前端路由，
  但 `assets/**` 与带扩展名的路径照常 404 —— 否则缺个 JS 会返回 HTML，
  浏览器报的错会跟真实原因（文件不存在）完全对不上
