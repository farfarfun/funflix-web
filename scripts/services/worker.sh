#!/usr/bin/env bash
# worker 服务：常驻的采集 / 解析 / 校验后台进程（funflix worker）。
#
# 为什么单独成一个服务而不是打开 FUNFLIX_WORKER_ENABLED：funflix 自己的配置
# 注释说明了原因 —— 进程内 worker 在 uvicorn 多进程部署下每个进程都会起一份，
# 租约虽能防重复处理，但会多出几倍空转轮询。生产用独立进程。
set -euo pipefail

# --- 配置 -------------------------------------------------------------------
SERVICE_NAME="worker"

# worker 不监听端口。port_for 仍要实现 —— 共享库用它拼 status 输出，
# 返回空串表示「本服务无端口」。
STARTUP_GRACE_SECONDS=3
# worker 一轮可能正在调 LLM 或探网盘，给的时间要比 web 宽，
# 让它有机会把手上这条任务收尾，而不是留下一条 running 状态的记录等租约超时。
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
  local env="$1" mode="$2"
  # worker 前后台跑的是同一条命令：它没有热重载模式可言
  : "${mode}"

  case "${env}" in
  dev)
    [[ -x "${DEV_BIN}" ]] || die "缺少开发环境：${DEV_BIN} 不存在，先执行 uv pip install -e '.[dev]'"
    SERVICE_COMMAND=("${DEV_BIN}" worker)
    ;;
  prod)
    require_prod_artifact
    SERVICE_COMMAND=("${PROD_BIN}" worker)
    unset PYTHONPATH
    export PYTHONNOUSERSITE=1
    ;;
  esac
}

service_main "$@"
