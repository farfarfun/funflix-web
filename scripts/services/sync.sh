#!/usr/bin/env bash
# sync 服务：周期性把本地库与远端互相同步（funflix sync pull / sync push）。
#
# funflix 本身只提供 CLI 命令，不带任何调度——web/worker 切到本地库模式后，
# 这个服务是本仓库自己补上的"谁来定期喊一声 sync"。
set -euo pipefail

# --- 配置 -------------------------------------------------------------------
SERVICE_NAME="sync"

# 不监听端口，port_for 返回空串表示「本服务无端口」，与 worker.sh 一致。
STARTUP_GRACE_SECONDS=3
# 一轮 pull+push 可能要搬不少行，给的时间比 web 宽，接近 worker 的量级。
STOP_TIMEOUT_SECONDS=30

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_SCRIPT_PATH="${SCRIPT_DIR}/${BASH_SOURCE[0]##*/}"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
RUN_DIR="${ROOT}/.run"
DEV_BIN="${ROOT}/.venv/bin/funflix"
PROD_VENV="${RUN_DIR}/prod-venv"
PROD_BIN="${PROD_VENV}/bin/funflix"

readonly SERVICE_NAME SCRIPT_DIR SERVICE_SCRIPT_PATH ROOT RUN_DIR
readonly DEV_BIN PROD_VENV PROD_BIN

# shellcheck source=../lib/service.sh
source "${ROOT}/scripts/lib/service.sh"
# shellcheck source=../lib/db.sh
source "${ROOT}/scripts/lib/db.sh"

# --- 服务定义 ---------------------------------------------------------------

port_for() { :; }

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
  local env="$1" mode="$2" bin
  : "${mode}"

  export FUNFLIX_DATABASE_URL="${FUNFLIX_DATABASE_URL:-${LOCAL_DATABASE_URL}}"

  case "${env}" in
  dev)
    [[ -x "${DEV_BIN}" ]] || die "缺少开发环境：${DEV_BIN} 不存在，先执行 uv pip install -e '.[dev]'"
    bin="${DEV_BIN}"
    ;;
  prod)
    require_prod_artifact
    bin="${PROD_BIN}"
    unset PYTHONPATH
    export PYTHONNOUSERSITE=1
    ;;
  esac

  # 先 pull 后 push：一轮里先拿远端可能存在的新数据，再把本地这段时间的
  # 管理员写操作推回去，缩小（不能完全消除，这是上游自己的设计取舍）互相
  # 覆盖的窗口。单条命令失败不影响循环继续，下一轮自然会重试。
  SERVICE_COMMAND=(bash -c '
    bin="$1"
    interval="${FUNFLIX_SYNC_INTERVAL_SECONDS:-300}"
    while true; do
      "${bin}" sync pull || true
      "${bin}" sync push || true
      sleep "${interval}"
    done
  ' _ "${bin}")
}

service_main "$@"
