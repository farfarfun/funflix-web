#!/usr/bin/env bash
# funflix-web 生命周期统一入口。
#
#   scripts/setup.sh <action> [service] [env]
#
# 服务级动作按 action -> service -> env 解析；包级动作（publish / install）
# 不带服务。参数给全就直接执行，只有缺失的部分才会交互补齐。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_DIR="${ROOT}/scripts/services"
RELEASE_SCRIPT="${ROOT}/scripts/release.sh"
DEV_SCRIPT="${ROOT}/scripts/dev.sh"
readonly ROOT SERVICE_DIR RELEASE_SCRIPT DEV_SCRIPT

# 服务级动作需要 service；仓库级动作不需要
readonly -a SERVICE_ACTIONS=(start stop restart run status)
readonly -a RELEASE_ACTIONS=(publish install)
readonly -a DEV_ACTIONS=(bootstrap build migrate test lint clean)
readonly -a SERVICES=(web worker)

# 刻意不提供 all：目前没有必须批量操作的场景，而一个语义含糊的 all
# （顺序？失败了继续还是中止？）比没有它更糟。真需要时再显式加。

usage() {
  cat >&2 <<'EOF'
funflix-web 统一入口。

开发：
  scripts/setup.sh bootstrap            装 Python 与前端依赖
  scripts/setup.sh build                构建前端到 src/funflix_web/static
  scripts/setup.sh migrate [dev|prod]   建库 / 执行数据库迁移
  scripts/setup.sh test                 跑测试
  scripts/setup.sh lint                 ruff + vue-tsc + shell 语法
  scripts/setup.sh clean                清掉构建产物与 .run/

服务：
  scripts/setup.sh <start|stop|restart|run> <web|worker> <dev|prod>
  scripts/setup.sh status [web|worker]

发布：
  scripts/setup.sh publish              构建前端 + funbuild 发布正式包
  scripts/setup.sh install [版本号]      按精确版本装到 .run/prod-venv

说明：
  start    后台启动，PID 与日志写在 .run/
  run      前台运行，Ctrl-C 直接停止；web 的 run dev 带热重载
  status   不交互，一次报告全部环境
  prod     只运行装好的正式包，缺包时直接失败，不会回落到源码
EOF
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 2
}

contains() {
  local needle="$1" item
  shift
  for item in "$@"; do
    [[ "${item}" == "${needle}" ]] && return 0
  done
  return 1
}

needs_env() {
  case "$1" in
  start | stop | restart | run) return 0 ;;
  *) return 1 ;;
  esac
}

# 只在参数缺失时才用。gum 不在就报错让用户补全参数 ——
# 生命周期脚本不该自己去装交互依赖。
choose() {
  command -v gum >/dev/null 2>&1 ||
    die "缺少参数，且未安装 gum；请用完整参数调用，见 scripts/setup.sh --help"
  gum choose "$@"
}

service_script_for() {
  case "$1" in
  web) printf '%s\n' "${SERVICE_DIR}/web.sh" ;;
  worker) printf '%s\n' "${SERVICE_DIR}/worker.sh" ;;
  *) return 1 ;;
  esac
}

resolve_service_script() {
  local script
  script="$(service_script_for "$1")" || die "未知服务：$1"
  [[ -f "${script}" ]] || die "缺少服务脚本：${script}"
  printf '%s\n' "${script}"
}

# 普通子进程调用，只用于需要连续跑多个服务的场景（status）
run_service() {
  local service="$1" script
  shift
  script="$(resolve_service_script "${service}")"
  bash "${script}" "$@"
}

# 单服务动作一律 exec 过去，不在中间留一层 shell。
# 留着的话 run 就成了「setup.sh 派生服务」：TERM 打到 setup.sh 上只会
# 杀掉这层壳，服务被丢成孤儿继续占着端口，而调用方看到的是已经退出。
exec_service() {
  local service="$1" script
  shift
  script="$(resolve_service_script "${service}")"
  exec bash "${script}" "$@"
}

# status 不带服务时报告全部服务，且不弹菜单
status_all() {
  local service rc=0
  for service in "${SERVICES[@]}"; do
    run_service "${service}" status || rc=1
  done
  return "${rc}"
}

main() {
  case "${1:-}" in
  -h | --help | help)
    usage
    exit 0
    ;;
  esac

  (($# <= 3)) || {
    usage
    die "参数过多"
  }

  local action="${1:-}"
  [[ -n "${action}" ]] ||
    action="$(choose "${SERVICE_ACTIONS[@]}" "${DEV_ACTIONS[@]}" "${RELEASE_ACTIONS[@]}")"

  # --- 仓库级动作：不带服务，原样转交对应脚本 ---
  if contains "${action}" "${RELEASE_ACTIONS[@]}"; then
    shift || true
    exec bash "${RELEASE_SCRIPT}" "${action}" "$@"
  fi
  if contains "${action}" "${DEV_ACTIONS[@]}"; then
    shift || true
    exec bash "${DEV_SCRIPT}" "${action}" "$@"
  fi

  contains "${action}" "${SERVICE_ACTIONS[@]}" || {
    usage
    die "未知动作：${action}"
  }

  local service="${2:-}" env="${3:-}"

  # status 是唯一允许省略服务的服务级动作：省略就是「全都报一遍」
  if [[ "${action}" == "status" ]]; then
    [[ -z "${env}" ]] || {
      usage
      die "status 不接受环境参数"
    }
    if [[ -z "${service}" ]]; then
      status_all
      return
    fi
    contains "${service}" "${SERVICES[@]}" || {
      usage
      die "未知服务：${service}"
    }
    exec_service "${service}" status
  fi

  [[ -n "${service}" ]] || service="$(choose "${SERVICES[@]}")"
  contains "${service}" "${SERVICES[@]}" || {
    usage
    die "未知服务：${service}"
  }

  if needs_env "${action}"; then
    [[ -n "${env}" ]] || env="$(choose dev prod)"
    [[ "${env}" == "dev" || "${env}" == "prod" ]] || {
      usage
      die "未知环境：${env}"
    }
  elif [[ -n "${env}" ]]; then
    usage
    die "${action} 不接受环境参数"
  fi

  exec_service "${service}" "${action}" "${env}"
}

main "$@"
