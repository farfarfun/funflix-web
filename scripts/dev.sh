#!/usr/bin/env bash
# 仓库级开发任务：装依赖、构建前端、测试、检查。
#
# 与 release.sh 的分工：那边管「发出去和装回来」，这边管「在本地把东西做出来」。
# 两边都不属于任何单个服务，所以都不放在 scripts/services/ 下。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRONTEND_DIR="${ROOT}/frontend"
STATIC_DIR="${ROOT}/src/funflix_web/static"
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

  info "创建虚拟环境并安装 Python 依赖"
  (cd "${ROOT}" && uv venv && uv pip install -e ".[dev]")

  info "安装前端依赖"
  (cd "${FRONTEND_DIR}" && pnpm install)

  cat <<EOF

开发环境就绪。接下来：
    scripts/setup.sh build           构建前端
    scripts/setup.sh start web dev   起服务

funflix 现在从 PyPI 按版本安装，不需要同级目录下的 funflix 检出。
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

# --- test / lint ------------------------------------------------------------

do_test() {
  [[ -x "${VENV}/bin/python" ]] || die "缺少虚拟环境，先执行 scripts/setup.sh bootstrap"
  info "Python 测试"
  (cd "${ROOT}" && "${VENV}/bin/python" -m pytest -q)
}

do_lint() {
  [[ -x "${VENV}/bin/python" ]] || die "缺少虚拟环境，先执行 scripts/setup.sh bootstrap"

  info "ruff"
  (cd "${ROOT}" && "${VENV}/bin/python" -m ruff check src tests)
  (cd "${ROOT}" && "${VENV}/bin/python" -m ruff format --check src tests)

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

main() {
  local action="${1:-}"
  (($# == 1)) || die "${action:-<空>} 不接受额外参数"
  case "${action}" in
  bootstrap | build | test | lint | clean) "do_${action}" ;;
  *) die "未知动作：${action:-<空>}" ;;
  esac
}

main "$@"
