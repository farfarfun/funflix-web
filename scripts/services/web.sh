#!/usr/bin/env bash
# web 服务：一个进程同时提供 /api 后端接口与 /web 前端界面。
set -euo pipefail

# --- 配置 -------------------------------------------------------------------
SERVICE_NAME="web"

# dev 与 prod 端口刻意相同：前端构建产物里的资源路径以 /web/ 为前缀，
# vite 开发代理也写死了 8810，端口不是可以随手换的运行时参数。
# 两个环境因此无法同时运行 —— 这是取舍，不是疏漏。
WEB_DEV_PORT=8810
WEB_PROD_PORT=8810

# 默认只监听本地。这个界面没有登录体系，管理密钥存在浏览器里，
# 不该默认对外可达；要对外请显式设 FUNFLIX_WEB_HOST=0.0.0.0。
WEB_HOST="${FUNFLIX_WEB_HOST:-127.0.0.1}"

STARTUP_GRACE_SECONDS=3
STOP_TIMEOUT_SECONDS=10

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_SCRIPT_PATH="${SCRIPT_DIR}/${BASH_SOURCE[0]##*/}"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
RUN_DIR="${ROOT}/.run"
DEV_BIN="${ROOT}/.venv/bin/funflix-web"
PROD_VENV="${RUN_DIR}/prod-venv"
PROD_BIN="${PROD_VENV}/bin/funflix-web"

readonly SERVICE_NAME WEB_DEV_PORT WEB_PROD_PORT WEB_HOST
readonly SCRIPT_DIR SERVICE_SCRIPT_PATH ROOT RUN_DIR DEV_BIN PROD_VENV PROD_BIN

# shellcheck source=../lib/service.sh
source "${ROOT}/scripts/lib/service.sh"

# --- 服务定义 ---------------------------------------------------------------

port_for() {
  case "$1" in
  dev) printf '%s\n' "${WEB_DEV_PORT}" ;;
  prod) printf '%s\n' "${WEB_PROD_PORT}" ;;
  *) return 1 ;;
  esac
}

# prod 的工作目录必须在源码检出之外，否则 Python 会把 cwd 放进 sys.path，
# 一个 import funflix_web 就可能拿到工作树里的代码而不是装好的包。
working_dir_for() {
  case "$1" in
  dev) printf '%s\n' "${ROOT}" ;;
  prod) printf '%s\n' "${RUN_DIR}" ;;
  *) return 1 ;;
  esac
}

require_prod_artifact() {
  [[ -x "${PROD_BIN}" ]] || die \
    "缺少正式包：${PROD_BIN} 不存在。先执行 scripts/setup.sh install，${SERVICE_NAME} prod 不会回落到源码。"
}

service_command_for() {
  local env="$1" mode="$2" port
  port="$(port_for "${env}")"

  # 未显式设置时给个默认管理密钥，省得每次起服务都要记着导出。
  # 对外暴露（FUNFLIX_WEB_HOST=0.0.0.0）时务必自己覆盖这个值。
  export FUNFLIX_ADMIN_API_KEY="${FUNFLIX_ADMIN_API_KEY:-admin123}"

  case "${env}" in
  dev)
    [[ -x "${DEV_BIN}" ]] || die "缺少开发环境：${DEV_BIN} 不存在，先执行 uv pip install -e '.[dev]'"
    SERVICE_COMMAND=("${DEV_BIN}" serve --host "${WEB_HOST}" --port "${port}")
    # --reload 会派生出 reloader 父进程与工作子进程，后台启动时 PID 文件
    # 只认得父进程，停止行为不可靠。所以热重载只给前台的 run 用。
    #
    # 用 if 而不是 `[[ ... ]] && ...`：后者作为函数最后一条语句时，
    # 条件为假会让整个函数返回非 0，在 set -e 下直接把脚本静默带走。
    if [[ "${mode}" == "run" ]]; then
      SERVICE_COMMAND+=(--reload)
    fi
    ;;
  prod)
    require_prod_artifact
    SERVICE_COMMAND=("${PROD_BIN}" serve --host "${WEB_HOST}" --port "${port}")
    # 切断从工作树注入代码的两条路径
    unset PYTHONPATH
    export PYTHONNOUSERSITE=1
    ;;
  esac
}

service_main "$@"
