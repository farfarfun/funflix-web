#!/usr/bin/env bash
# 仓库级开发任务：装依赖、构建前端、检查。
#
# 与 release.sh 的分工：那边管「发出去和装回来」，这边管「在本地把东西做出来」。
# 两边都不属于任何单个服务，所以都不放在 scripts/services/ 下。
#
# 本仓库不再包含 Python 源码——前端（funflix-web）是独立 npm 包，后端直接用
# funflix 自己的命令。这里的 .venv 只服务于 worker/sync 两个仍由本仓库管理的
# bash 生命周期服务，装的是 funflix 本身，不是本仓库的代码。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRONTEND_DIR="${ROOT}/frontend"
STATIC_DIR="${FRONTEND_DIR}/dist"
VENV="${ROOT}/.venv"

readonly SCRIPT_DIR ROOT FRONTEND_DIR STATIC_DIR VENV

die() {
  printf 'error: %s\n' "$*" >&2
  exit 2
}

info() { printf '==> %s\n' "$*"; }

require() {
  command -v "$1" >/dev/null 2>&1 || die "未找到 $1，$2"
}

# --- bootstrap --------------------------------------------------------------

do_bootstrap() {
  require uv "安装见 https://github.com/astral-sh/uv"
  require pnpm "安装：npm i -g pnpm"

  info "创建虚拟环境并安装 funflix（worker/sync 开发态用）"
  (cd "${ROOT}" && uv venv && uv pip install funflix)

  info "安装前端依赖"
  (cd "${FRONTEND_DIR}" && pnpm install)

  cat <<EOF

开发环境就绪。接下来：
    scripts/setup.sh build              构建前端
    scripts/setup.sh start worker dev   起 worker
    cd frontend && pnpm dev             起前端（热重载，代理到本地 funflix server start）

funflix 从 PyPI 按版本安装，不需要同级目录下的 funflix 检出。
EOF
}

# --- build ------------------------------------------------------------------

do_build() {
  require pnpm "安装：npm i -g pnpm"
  info "构建前端"
  # 用 --frozen-lockfile：构建产物要可复现，锁文件与 package.json 不一致时
  # 应该报错让人去解决，而不是悄悄改依赖再构建
  (cd "${FRONTEND_DIR}" && pnpm install --frozen-lockfile && pnpm build)
  [[ -f "${STATIC_DIR}/index.html" ]] ||
    die "构建结束但没有产出 ${STATIC_DIR}/index.html"
  info "产物已写入 ${STATIC_DIR}"
}

# --- lint ---------------------------------------------------------------

do_lint() {
  info "前端类型检查"
  (cd "${FRONTEND_DIR}" && pnpm exec vue-tsc --noEmit)

  info "shell 语法"
  local f
  for f in "${ROOT}"/scripts/*.sh "${ROOT}"/scripts/lib/*.sh "${ROOT}"/scripts/services/*.sh; do
    bash -n "${f}" || die "语法错误：${f}"
  done
}

do_clean() {
  info "清理构建产物与运行时状态"
  rm -rf "${STATIC_DIR}" "${ROOT}/.run"
}

# --- migrate ----------------------------------------------------------------

# funflix 0.1.6 起把 migrations 与 alembic.ini 打进了包，所以建库可以直接用
# 装好的 funflix，不再需要它的源码检出。dev 用开发环境，prod 用装了正式包的
# 那个环境 —— 两边的库地址与包版本都可能不同，不能混着来。
do_migrate() {
  local env="${1:-dev}" bin
  case "${env}" in
  dev) bin="${VENV}/bin/funflix" ;;
  prod) bin="${ROOT}/.run/prod-venv/bin/funflix" ;;
  *) die "未知环境：${env}（只接受 dev 或 prod）" ;;
  esac

  [[ -x "${bin}" ]] || die "找不到 ${bin}，先执行 scripts/setup.sh $([[ ${env} == prod ]] && echo install || echo bootstrap)"

  info "对 ${env} 环境执行数据库迁移"
  "${bin}" db upgrade
}

main() {
  local action="${1:-}"
  case "${action}" in
  migrate)
    (($# <= 2)) || die "migrate 最多接受一个环境参数"
    do_migrate "${2:-dev}"
    ;;
  bootstrap | build | lint | clean)
    (($# == 1)) || die "${action} 不接受额外参数"
    "do_${action}"
    ;;
  *) die "未知动作：${action:-<空>}" ;;
  esac
}

main "$@"
