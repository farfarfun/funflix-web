# funflix-web

[funflix](https://github.com/farfarfun/funflix) 的 Web 界面。前后端是**两个独立部署的进程**：

| 组件 | 是什么 | 默认端口 |
| --- | --- | --- |
| `funflix-web`（本仓库，npm 包） | 静态托管前端 + 反代后端接口 | `8810` |
| `funflix server start`（funflix 自带命令） | 纯后端接口 | `18810` |

`funflix-web` 对外暴露的路径：

| 路径 | 内容 |
| --- | --- |
| `/web` | 前端界面（Vue 3 单页应用），本机静态文件 |
| `/api/v1`、`/healthz` | 反向代理到 `funflix server start` |
| `/` | 重定向到 `/web` |

`funflix server start` 是 funflix 自带的独立命令，不需要任何包装就能跑；本仓库不碰它的源码，
也不再有一个把前后端粘进同一个进程的 Python 包。之所以不直接在浏览器里跨域访问后端，
是因为 funflix 没有 CORS 中间件——`funflix-web` 内置的反代把 `/api`、`/healthz` 转发到
后端，浏览器眼里全程只有一个源，不用改 funflix 一行代码。

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

```bash
npm i -g funflix-web                                          # 装前端（私有 npm 仓库）
uv pip install funflix                                        # 装后端（PyPI）
funflix server start --host 127.0.0.1 --port 18810 &                  # 起后端
FUNFLIX_ADMIN_API_KEY=你的密钥 funflix-web server start --backend http://127.0.0.1:18810
```

打开 `http://127.0.0.1:8810/web`。

没构建前端也能装：`funflix-web` 会检测到 `dist/` 缺失并返回明确的构建提示，
而不是一个没头没脑的 404（发布到 npm 的包本身已带构建产物，这条只影响从源码跑的场景）。

## 开发

前端改动频繁时用 vite 的 HMR，接口交给真实后端：

```bash
funflix server start --host 127.0.0.1 --port 18810    # 终端 A：后端
pnpm dev                                               # 终端 B：5173，/api 代理到 18810
```

开发时访问 `http://127.0.0.1:5173`（不是 8810）。`vite.config.ts` 把 `/api`
与 `/healthz` 代理到 `FUNFLIX_API_BASE_URL`（默认 `http://127.0.0.1:18810`），
所以不会有跨域问题。

worker / sync 这两个长期运行的后台任务继续由本仓库的 bash 脚本管理（历史遗留，
与前端拆分无关）：

```bash
scripts/setup.sh bootstrap                # 装 funflix（worker/sync 开发态用）+ 前端依赖
scripts/setup.sh migrate [dev|prod]       # 建库 / 执行数据库迁移
scripts/setup.sh <start|stop|restart|run> <worker|sync> <dev|prod>
scripts/setup.sh status [worker|sync]
scripts/setup.sh lint                     # vue-tsc + shell 语法
scripts/setup.sh clean                    # 清掉构建产物与 .run/
```

worker 独立成进程而不是打开 `FUNFLIX_WORKER_ENABLED`，理由在 funflix 的配置注释里：
进程内 worker 在 uvicorn 多进程部署下每个进程都会起一份，租约虽能防重复处理，
但会多出几倍空转轮询。

## funflix-web 命令

命令分两组：`server` 管运行时生命周期，顶层命令管 CLI 自身的包版本。

```bash
funflix-web server start    [选项]   # 后台运行，PID/日志见 ~/.cache/farfarfun/funflix-web/run/
funflix-web server stop              # 优雅停止（SIGTERM，等待超时不会自动 SIGKILL）
funflix-web server restart  [选项]   # stop + start
funflix-web server status            # 查看运行状态与已安装版本
funflix-web server run      [选项]   # 前台运行，Ctrl-C 停止

funflix-web upgrade [版本号]   # 装最新版或指定版本（npm install -g）
funflix-web rollback <版本号>  # 回退到指定的旧版本
funflix-web uninstall          # 先停止正在运行的 server，再卸载
```

`server start/restart/run` 支持的选项：

| 选项 | 默认值 |
| --- | --- |
| `--config <path>` | `${XDG_CONFIG_HOME:-~/.config}/farfarfun/funflix-web/config.toml`（`.json`/`.toml`/`.env` 按扩展名选解析器） |
| `--host` | `127.0.0.1`（或配置文件里的 `host`） |
| `--port` | `8810`（或配置文件里的 `port`） |
| `--backend` | `$FUNFLIX_API_BASE_URL`、配置文件里的 `backend`，或 `http://127.0.0.1:18810` |
| `--static-dir` | 包内自带的 `dist/`，或配置文件里的 `static_dir` |

显式 flag 会覆盖配置文件里的同名字段；配置文件缺省的字段用命令内置默认值。
显式传 `--config` 而文件不存在会直接报错；不传时用默认路径，文件不存在则视为「没配置」，
不会报错。

`server start` 把 PID、日志写在 `~/.cache/farfarfun/funflix-web/run/` 下；`server stop` 发
`SIGTERM` 后轮询到超时（默认 10s，`FUNFLIX_WEB_STOP_TIMEOUT_MS` 可调），**不会自动升级成
SIGKILL**——强杀是调用方的策略决定，命令本身不替你做这个决定。`server restart` 等价于
`server stop` + `server start`。`server status` 除了 PID/端口，还会报告当前安装的
`funflix-web` 版本。

## 生产发布

```bash
scripts/setup.sh publish              # 构建前端 → 发布 npm 包到私有仓库
npm i -g funflix-web                  # 生产机上装（或指定版本 funflix-web@x.y.z）
scripts/setup.sh install 0.1.34       # worker/sync 用：把 funflix 精确版本装到 .run/prod-venv
scripts/setup.sh start worker prod
scripts/setup.sh start sync prod
funflix server start --host 127.0.0.1 --port 18810 &
funflix-web server start --backend http://127.0.0.1:18810
```

`funflix-web` 发布到私有 npm 仓库（`package.json` 的 `publishConfig.registry`），
不再发布到公开 PyPI——之前发布过的 0.1.4~0.1.6 是历史遗留的 Python 包，仍留在公开 PyPI
上不动，只是不会再有新版本。

## 管理密钥

浏览与搜索**不需要**任何密钥。写操作（登记 / 修改 / 删除采集源、触发采集）
走 funflix 的 `AdminDep`，要求 `X-API-Key` 头，值是服务端的 `FUNFLIX_ADMIN_API_KEY`：

```bash
FUNFLIX_ADMIN_API_KEY=你的密钥 funflix server start
```

在界面左下角「管理密钥」里填入同一个值即可解锁写操作。没填时相关按钮会置灰
并给出说明，而不是等你点下去再吃一个 403。

密钥存在浏览器的 localStorage 里 —— 这是个自部署的本地工具，没有登录体系可挂靠。
**因此不要把这个界面直接暴露到公网。**

## 配置

后端（`funflix server start`）配置继承自 funflix，走 `FUNFLIX_` 前缀的环境变量或 `.env`：

| 变量 | 说明 |
| --- | --- |
| `FUNFLIX_DATABASE_URL` | 数据库地址；不设时直连云端（funflix 落回 funsecret 拿到远端地址）。显式设成本地 SQLite 路径可切到「本地库模式」，见下 |
| `FUNFLIX_REMOTE_DATABASE_URL` | `sync` 同步的远端地址；不设时落回 funsecret 拿到真实远端库 |
| `FUNFLIX_SYNC_INTERVAL_SECONDS` | `sync` 服务两轮 pull+push 之间的间隔，默认 `300` |
| `FUNFLIX_ADMIN_API_KEY` | 写接口的密钥，不配则写接口全部 403 |
| `FUNFLIX_WORKER_ENABLED` | 是否在本进程内跑后台 worker，默认 `false` |

前端（`funflix-web`）自己的环境变量：

| 变量 | 说明 |
| --- | --- |
| `FUNFLIX_API_BASE_URL` | `--backend` 的默认值 |
| `FUNFLIX_WEB_STATE_DIR` | PID/日志目录，默认 `~/.cache/farfarfun/funflix-web/run` |
| `FUNFLIX_WEB_STARTUP_GRACE_MS` | `start` 起完后等多久再确认存活，默认 `1000` |
| `FUNFLIX_WEB_STOP_TIMEOUT_MS` | `stop` 等待优雅退出的超时，默认 `10000` |

## 本地库模式（可选）

worker/sync 默认直连云端 Postgres，跟一直以来的行为一样。想改成查询一份
本地 SQLite 镜像（省掉每次请求跨网络打远端；`worker` 逐行读写的采集/解析/
校验 pipeline，是这个模式最该省的场景），需要显式给 `funflix server start`/`worker` 设置：

```bash
export FUNFLIX_DATABASE_URL="sqlite+aiosqlite:///${HOME}/.cache/farfarfun/funflix/funflix.db"
```

（这个路径也是 `scripts/lib/db.sh` 里 `LOCAL_DATABASE_URL` 的值，与 funflix
自身在 funsecret 未配置时的兜底路径一致。）再配合 `sync` 服务负责两边
同步（`funflix sync pull` 拉远端新数据覆盖本地，`funflix sync push` 把本地
写操作推回远端，冲突按最后写入为准），间隔由 `FUNFLIX_SYNC_INTERVAL_SECONDS`
控制：

```bash
scripts/setup.sh start sync dev
```

同步范围由 funflix 按表结构自动推导，**不含**破坏性/整表重写操作
（`db reset`、`db retag`、删除采集源等）——这些必须直接对远端执行，
分支合并式的同步没法安全覆盖它们，遵循 funflix 自己文档里的约束。

> funflix 0.1.33 的 `sync pull` 有个致命 bug：把非唯一键冲突的真实错误一律
> 误判成「业务唯一键冲突」并静默跳过整表（[issue #3](https://github.com/farfarfun/funflix/issues/3)），
> 0.1.34 修好。用本地库模式前确认 funflix 版本 ≥ 0.1.34。

## 技术选型

- **前端**：Vue 3 + TypeScript + Vite + Naive UI，组件按需引入（全量引入会多打进 1.2MB），
  产物随 npm 包发布，不再打进任何 Python wheel
- **前端服务进程**：Node 内置 `http`/`fs`/`zlib`，不加第三方依赖 —— 静态托管、gzip、
  反向代理、start/stop/restart 生命周期全部手写，端口不固定，`--port` 随时可改
- **后端**：funflix 自带的 `funflix server start`（FastAPI + uvicorn），本仓库不包装、不修改
- **传输**：开了 gzip，并按文件类型给缓存策略 —— 首屏从 525KB 降到 163KB。
  `assets/` 下的文件名带内容 hash，给 `immutable` 永久缓存；`index.html` 给 `no-cache`，
  它是唯一记录「该加载哪些 hash 资源」的地方，缓存住的话重新部署永远不生效
- **SPA 回退**：`/web/**` 找不到文件时回退 `index.html` 交给前端路由，
  但 `assets/**` 与带扩展名的路径照常 404 —— 否则缺个 JS 会返回 HTML，
  浏览器报的错会跟真实原因（文件不存在）完全对不上
- **同源反代**：`base: '/web/'` 是固定的 URL 前缀（写死在 `vite.config.ts`），
  跟监听端口无关；`funflix-web` 把 `/api`、`/healthz` 反代到后端，浏览器全程
  只看到一个源，绕开 funflix 没有 CORS 中间件这件事，不需要改 funflix 源码
