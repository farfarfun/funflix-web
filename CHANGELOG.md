# Changelog

本文件记录 `funflix-web` 各版本的变更，按版本倒序排列。

> 说明：早期（0.1.6 ~ 0.1.28 区间部分版本）存在纯版本号递增、无实质代码变更的发布，
> 已在对应条目中如实标注，不编造内容。

## [Unreleased]

### 变更
- **整站需要登录，「运维」区在此之上再要求管理员角色**。原先作品检索/详情是公开的，
  现在未登录打开任何页面都跳 `/login`（`meta.public` 只给登录页 —— 白名单而不是
  黑名单，新页面漏标 meta 时落在「要登录」那一侧）。`meta.requiresAuth` 随之改名
  `meta.requiresAdmin`：它的含义从「要登录」变成了「要管理员」，留着旧名字就是假的。
  guest 手敲运维 URL 会被弹回 `/media` 而不是跳登录页 —— 他已经登录了，再登一次
  也还是 guest。`User` 多一个 `role` 字段，顶栏「运维」下拉和移动端抽屉的「运维」
  分组按它过滤。**这层过滤只是省掉一次必然失败的点击**，真正的拦截在 FastAPI
  （`CurrentUserDep` / `AdminUserDep`）—— `funflix-web/server/` 只是静态文件 +
  反向代理，没有任何鉴权，光靠前端守卫挡不住直接 curl 接口
- **顶栏「运维」下拉拆开平铺**。收进下拉原本是为了不让普通访问者面对一排后台入口；
  现在运维入口只对 admin 渲染，看得到它们的人就是唯一的受众，再多点一次下拉没有意义。
  分组边界用一道竖线交代，免得六个入口读成地位相同的一排。移动端抽屉照旧按分组摊开
- **登录页只有一个登录入口：登录（默认） / 注册**。原先是「访客登录 / 注册 /
  管理登录」三个 tab，但访客和管理那两个打的是同一个 `POST /auth/login`、字段一模
  一样，差别只在文案和落地页 —— 后端从不按 tab 发角色，角色由账号本身决定，guest
  在「管理登录」里输对密码也只是正常进站。分成两个 tab 唯一的效果是让人以为「选错
  tab 会登不上」。现在落地页按**登录后拿到的角色**定：admin 进大盘，其余进作品检索
  （守卫带来的 `redirect` 仍然优先）。
  注册要邀请码，`registration_enabled` 为假时连 tab 都不渲染；拉不到配置时按**不
  开放**处理，渲染一个必然 403 的表单比少一个 tab 更难解释。注册成功即已登录，
  不用再登一次
- **npm 包名加上 `@farfarfun` scope：`funflix-web` → `@farfarfun/funflix-web`**。
  CLI 的命令名不变，还是 `funflix-web`（`bin` 字段与包名无关）。两处连带改动：
  `bin/cli.js` 的 `npmGlobal` 给 npm 显式带上 `--@farfarfun:registry=<私有仓库>`
  —— 加了 scope 之后裸跑 `npm install -g` 会去默认 registry 找，报 404，
  而 `upgrade` / `rollback` 不该依赖目标机器上配好了 `.npmrc`；用
  `--@scope:registry=` 而不是 `--registry=` 是为了不把依赖也一起改道。
  首次安装仍需先 `npm config set @farfarfun:registry ...`（README 已写）。
  另外带 scope 的包 `npm pack` 出来的文件名变成 `farfarfun-funflix-web-*.tgz`，
  README 里本地装包那条命令的通配符跟着改了。
- **列表与详情的主体从 media 改成 work（一部剧）**，季降为子层：`MediaListView.vue`
  / `MediaListRow.vue` / `PosterCard.vue` 改打 `GET /works`，搜「大主宰」从几百条
  同名行变成一条；`MediaDetailView.vue` 的资源按季折叠展示（`n-collapse accordion`，
  一次只展开一季 —— 多季各带几十条资源，全展开要渲染几百行表格），单季作品
  不套季的壳，季号 0 渲染成「正片」而不是「第 0 季」。后端每季最多返回 50 条，
  被截断时显式提示真实总数，不让人以为这就是全部
- 筛选栏新增 `book` / `comic` / `other` 三个非影视类型，淡一档虚线显示以区分 ——
  它们默认不进搜索结果，必须显式选中才看得到；原来的「全部」胶囊因此改叫
  「全部影视」。路由路径 `/media/:id` 保持不变（`:id` 现在是 work.id），
  只为不废掉已经发出去的链接
- 配置与状态目录从 `~/farfarfun/funflix/web/` 改为 `~/.farfarfun/funflix/web/`，
  与组织统一的 `~/.farfarfun/<包名>/` 约定对齐（`server/config.js`、
  `server/lifecycle.js`、`scripts/lib/db.sh` 里的本地库路径同步改为
  `~/.farfarfun/funflix/funflix.db`）

### 修复
- README「管理密钥」一节改为准确描述当前的用户名/密码登录 + httpOnly cookie
  会话（`src/api/auth.ts`、`src/api/client.ts` 的实际实现），不再声称写操作依赖
  `FUNFLIX_ADMIN_API_KEY` 且密钥存在浏览器 `localStorage`——那是改造前的旧模型，
  当前前端代码既不读取也不发送这个头；同步修正 `src/components/AppShell.vue`
  里引用旧模型的注释
- `fetchMe()` 不再把所有失败一律当成「未登录」：只有明确的 401 才清空登录态，
  网络故障 / 后端 500 保留到新增的 `authError`，由 `AppShell.vue` 用 toast 提示
  「登录状态检查失败」，不静默吞掉也不误判成未登录（组织规范 §8.2）
- `.gitignore` 补充 `*.rar`、`.idea/`、`.vscode/`（组织规范 §10）

### 新增
- 新增 `server/proxy.js`、`server/static.js`、`server/lifecycle.js` 的测试覆盖：
  代理层连接失败时的 502、静态文件路径穿越防护与 assets/index 回退规则、
  重复启动检测、陈旧 PID 文件清理、空闲时 `stop()`、真实进程的优雅停止、
  `status()` 的 running/stale/stopped 三态
- 新增 `src/api/auth.test.ts`，覆盖 `fetchMe()` 的 401 / 网络故障两种错误分类

## [1.0.2] - 2026-09-21

### 新增
- 补充组织规范要求的 `pnpm test`（vitest）/ `pnpm lint`（eslint）脚本与初始测试用例
  （`server/config.js`、`bin/cli.js` 的配置优先级、`src/utils/display.ts`）
- `package.json` 声明 `engines.node >= 20`
- 新增本文件 `CHANGELOG.md`
- README 补充组织统一的「关于 farfarfun」区块

### 修复
- 配置优先级修正为 CLI 参数 > 环境变量 > 配置文件 > 默认值——此前配置文件里的
  `backend` 字段会意外盖过 `FUNFLIX_API_BASE_URL` 环境变量
- `scripts/lib/service.sh` 打开锁文件描述符不再使用 `eval` 拼接命令，改用字面量
  描述符重定向（`exec 9>"${lock_file}"`）
- `scripts/services/sync.sh` 的 `sync pull`/`sync push` 失败不再 `|| true` 静默吞掉，
  改为记录上下文日志并以非 0 退出码结束进程，让失败对 supervisor / 调用方可见
- 两处捕获异常后重新抛出的地方补上 `cause`，保留原始错误链（`bin/cli.js` 的
  `uninstall`、`server/lifecycle.js` 的 `restart`）

### 变更
- 仅版本号从 `0.1.31` 跳到 `1.0.2`，标记为稳定版发布，无额外代码改动

## [0.1.31] - 2026-09-16

### 变更
- 仅版本号递增，无功能变更（对应发布未产生新的代码提交）

## [0.1.30] - 2026-09-16

### 新增
- 运维区新增「Provider 管理」页面

### 变更
- 文档：后端启动方式的引用从 `funflix server start` 更新为 `funflix-api start`

## [0.1.28] - 2026-09-08

### 变更
- 仅版本号递增，无功能变更

## [0.1.27] - 2026-09-08

### 变更
- 仅版本号递增，无功能变更

## [0.1.26] - 2026-09-08

### 修复
- 修复采集源队列操作的刷新与取消逻辑

## [0.1.25] - 2026-09-08

### 新增
- 采集源页支持排队执行多个操作

## [0.1.24] - 2026-09-08

### 变更
- 仅版本号递增，无功能变更

## [0.1.23] - 2026-09-08

### 修复
- 修复导航时的焦点管理问题，改进作品列表与登录页的无障碍支持与布局

## [0.1.22] - 2026-09-08

### 变更
- 全组件无障碍、响应式布局与视觉细节打磨

## [0.1.21] - 2026-09-07

### 新增
- 作品检索支持列表 / 小图卡片 / 大图卡片三种展示格式
- 补全采集源类型枚举

### 变更
- 依赖管理与 CLI 工具链改进

## [0.1.19] - 2026-09-07

### 变更
- 仅版本号递增，无功能变更

## [0.1.18] - 2026-09-07

### 变更
- 运维区登录方式从管理密钥直传改为 cookie 会话登录

## [0.1.17] - 2026-09-07

### 变更
- 检索页海报网格优化：加宽卡片最小宽度，每页条数可切换并同步到地址栏

## [0.1.16] - 2026-09-07

### 修复
- 修复采集源列表排序只在当前页内生效的问题

## [0.1.15] - 2026-09-07

### 变更
- 采集源页优化：已解析列改为百分比进度条，删除按钮收进下拉菜单，失败源高亮显示

## [0.1.14] - 2026-09-07

### 新增
- 采集源页操作列新增「解析」按钮

## [0.1.13] - 2026-09-06

### 新增
- 采集源页展示按来源维度的原始文本 / 解析 / 资源计数

## [0.1.12] - 2026-09-06

### 新增
- 流水线大盘新增按网盘细分的校验状态统计
- 作品检索新增按网盘筛选

## [0.1.11] - 2026-09-05

### 变更
- 仅版本号递增，无功能变更

## [0.1.10] - 2026-09-01

### 变更
- 仅版本号递增，无功能变更

## [0.1.9] - 2026-08-31

### 变更
- 仅版本号递增，无功能变更

## [0.1.8] - 2026-08-31

### 变更
- 仅版本号递增，无功能变更

## [0.1.7] - 2026-08-31

### 新增
- README 补充本地安装验证（不走私有仓库）的操作说明

## [0.1.6] - 2026-08-31

### 变更
- 包管理器统一切换为 pnpm

## [0.1.5] - 2026-08-31

### 变更
- 前端源码目录由 `frontend/src` 移动到仓库根下的 `src`，与 §1.1「源码目录名与仓库名对齐」的目标结构一致

### 新增
- 新增本地库同步模式（可选）

## [0.0.2] - 2026-08-31

### 变更 — 破坏性变更：架构重做
- **前端从「打进 Python wheel 的静态资源」重做为独立发布的 npm 包**，新增 `server` 子命令 CLI
  （`funflix-web server start/stop/restart/status/run`），后端改为直连独立的 `funflix-api` 服务
- 这也是 [#401](https://github.com/farfarfun/todo-list/issues/401) 里
  「PyPI 上 funflix-web 0.1.6 已过时」问题的成因：架构重做后不再发布 Python 包，
  仅发布 npm 包，PyPI 上的旧版本已停止更新

## [0.1.4] - 2026-08-30

### 新增
- 界面从后台管理风格重做为媒体站风格
- 移动端布局优化，作品列表 / 资源表新增筛选与排序
- 封面缺失时使用作品类型图标兜底
- 新增 GitHub Sponsors 资助链接

### 修复
- 适配 funflix 0.1.31 的 UUIDv7 主键迁移（不兼容旧版自增整数 id）
- 补充 `py.typed` 标记以满足 PEP 561（彼时仍是 Python 包阶段）

### 变更
- 未设置 `FUNFLIX_ADMIN_API_KEY` 时默认使用 `admin123`（仅开发默认值，生产必须显式配置）

## [0.1.2] - 2026-08-28

### 新增
- `scripts/setup.sh` 新增 `migrate` 动作，建库不再需要 funflix 源码检出
- 筛选条件同步到地址栏；网盘资源页适配上游鉴权

### 修复
- 构建脚本改用回迁后的 `funbuild` CLI
- 补全生命周期脚本里的 `exec` 链；`publish` 后恢复可编辑安装

### 变更
- 重新设计前端界面：靛紫主题 + 图标导航
- 解除对 funflix 源码检出的依赖，`setup.sh` 收敛为唯一入口
- 开启 gzip 并按文件类型设置缓存策略
- 补充 MIT LICENSE

## [0.1.1] - 2026-08-26

### 新增
- 首个可用版本：基于 FastAPI + Vue 的 Web 服务，媒体管理大盘、资源展示，
  以及生产发布工具链

[1.0.2]: https://github.com/farfarfun/funflix-web/releases/tag/v1.0.2
[0.1.31]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.31
[0.1.30]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.30
[0.1.28]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.28
[0.1.27]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.27
[0.1.26]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.26
[0.1.25]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.25
[0.1.24]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.24
[0.1.23]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.23
[0.1.22]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.22
[0.1.21]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.21
[0.1.19]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.19
[0.1.18]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.18
[0.1.17]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.17
[0.1.16]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.16
[0.1.15]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.15
[0.1.14]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.14
[0.1.13]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.13
[0.1.12]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.12
[0.1.11]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.11
[0.1.10]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.10
[0.1.9]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.9
[0.1.8]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.8
[0.1.7]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.7
[0.1.6]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.6
[0.1.5]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.5
[0.0.2]: https://github.com/farfarfun/funflix-web/releases/tag/v0.0.2
[0.1.4]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.4
[0.1.2]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.2
[0.1.1]: https://github.com/farfarfun/funflix-web/releases/tag/v0.1.1
