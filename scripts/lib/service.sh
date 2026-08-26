#!/usr/bin/env bash
# 服务生命周期的共享机制：PID、日志、锁、优雅停止。
#
# 这里只放与具体服务无关的东西。端口、启动命令、包名、工作目录一律留在
# scripts/services/<service>.sh 里 —— 共享库一旦知道某个服务的细节，
# 它就会慢慢长成第二个巨型脚本。
#
# 调用方需要在 source 之前定义：
#   SERVICE_NAME            服务名，用于运行文件命名与输出
#   RUN_DIR                 运行文件目录
# 并实现这三个函数：
#   service_command_for <env> <mode>   设置 SERVICE_COMMAND 数组；mode 为 start|run
#   working_dir_for <env>              打印该环境下的工作目录
#   port_for <env>                     打印端口；无端口的服务打印空串

set -euo pipefail

STARTUP_GRACE_SECONDS="${STARTUP_GRACE_SECONDS:-2}"
STOP_TIMEOUT_SECONDS="${STOP_TIMEOUT_SECONDS:-10}"

SERVICE_COMMAND=()

die() {
  printf 'error: %s\n' "$*" >&2
  exit 2
}

validate_env() {
  [[ "$1" == "dev" || "$1" == "prod" ]]
}

# --- 运行文件 ---------------------------------------------------------------
# 同一个 .run/ 下会有多个服务、多个环境的文件，名字必须同时带上两者，
# 否则 web 的 dev 和 worker 的 dev 会互相覆盖 PID。

pid_file_for() { printf '%s/%s.%s.pid\n' "${RUN_DIR}" "${SERVICE_NAME}" "$1"; }
log_file_for() { printf '%s/%s.%s.log\n' "${RUN_DIR}" "${SERVICE_NAME}" "$1"; }
lock_file_for() { printf '%s/%s.%s.lock\n' "${RUN_DIR}" "${SERVICE_NAME}" "$1"; }

read_pid() {
  local pid_file="$1" pid
  [[ -f "${pid_file}" ]] || return 1
  IFS= read -r pid <"${pid_file}" || return 1
  # 只认纯数字且大于 1：空文件、写了一半的文件、以及 PID 1 都不是我们能管的
  [[ "${pid}" =~ ^[0-9]+$ ]] && ((pid > 1)) || return 1
  printf '%s\n' "${pid}"
}

pid_is_live() { kill -0 "$1" 2>/dev/null; }

write_pid() {
  local pid="$1" pid_file="$2" tmp
  tmp="${pid_file}.tmp.$$"
  printf '%s\n' "${pid}" >"${tmp}"
  mv -f "${tmp}" "${pid_file}"
}

# 锁用固定的 9 号描述符，而不是 {var} 动态分配。
# 动态分配拿到的号只存在变量里，后台启动时没法在子进程里精确关掉它，
# 而这个描述符一旦被 nohup 出去的服务进程继承，flock 就会被那个
# 长期存活的进程一直占着 —— 后续的 stop / restart 全部会卡住。
readonly LOCK_FD=9

# 串行化同一「服务+环境」的生命周期操作。没有 flock 就直接跑 ——
# 缺个锁只是并发时可能打架，不该让单次正常操作失败。
with_lock() {
  local env="$1"
  shift
  local lock_file
  lock_file="$(lock_file_for "${env}")"
  mkdir -p "${RUN_DIR}"
  command -v flock >/dev/null 2>&1 || {
    "$@"
    return
  }
  eval "exec ${LOCK_FD}>\"\${lock_file}\""
  flock -w 10 "${LOCK_FD}" || die "${SERVICE_NAME} ${env}: 另一个生命周期操作正在进行"
  "$@"
}

# --- 生命周期 ---------------------------------------------------------------

# 真正把进程换成服务的地方。mode 决定命令形态（例如 dev 下只有前台
# run 才加热重载），必须一路传到这里 —— 后台启动是靠再次调用本脚本
# 实现的，如果这里写死 run，start 会悄悄启动一个带热重载的进程。
do_exec() {
  local env="$1" mode="$2" working_dir
  service_command_for "${env}" "${mode}"
  working_dir="$(working_dir_for "${env}")"
  mkdir -p "${working_dir}"
  cd "${working_dir}"
  # exec 让信号与退出码直达服务本身，中间不留一层 shell
  exec "${SERVICE_COMMAND[@]}"
}

do_run() { do_exec "$1" run; }

do_start() {
  local env="$1" log_file pid_file pid
  log_file="$(log_file_for "${env}")"
  pid_file="$(pid_file_for "${env}")"
  mkdir -p "${RUN_DIR}"

  if pid="$(read_pid "${pid_file}")" && pid_is_live "${pid}"; then
    die "${SERVICE_NAME} ${env} 已在运行（pid ${pid}）"
  fi
  if [[ -e "${pid_file}" ]]; then
    printf 'warning: 清理陈旧 PID 文件 %s\n' "${pid_file}" >&2
    rm -f "${pid_file}"
  fi

  # 先在前台把命令解析一遍。缺正式包、缺开发环境这类问题在这里就会报出来，
  # 否则要等进程后台起来又立刻死掉，用户看到的是「启动失败，去翻日志」，
  # 而不是「缺少正式包，先 install」。
  service_command_for "${env}" start

  # 后台走脚本自身的内部动作，前台实现里的 exec 保证这里拿到的
  # 是服务进程本身的 PID，而不是一层包装 shell 的 PID。
  #
  # 末尾的 9>&- 显式关掉锁描述符，否则服务进程会继承它并一直占着 flock，
  # 之后所有 stop / restart 都会卡满超时再失败。这里必须写字面量 9：
  # bash 不会在重定向的描述符位置做变量展开，${LOCK_FD}>&- 是无效语法。
  nohup bash "${SERVICE_SCRIPT_PATH}" __exec "${env}" start \
    </dev/null >>"${log_file}" 2>&1 9>&- &
  pid=$!
  write_pid "${pid}" "${pid_file}"

  # 起不来的进程往往在一秒内就退了。不等这一下的话，start 会对着一个
  # 已经死掉的 PID 报成功，问题要等到 status 或用户访问时才暴露。
  sleep "${STARTUP_GRACE_SECONDS}"
  if ! pid_is_live "${pid}"; then
    rm -f "${pid_file}"
    printf 'error: %s %s 启动失败，日志见 %s\n' "${SERVICE_NAME}" "${env}" "${log_file}" >&2
    printf -- '--- 日志末尾 ---\n' >&2
    tail -n 20 "${log_file}" >&2 || true
    return 1
  fi

  printf '%s %s 已启动（pid %s，日志 %s）\n' "${SERVICE_NAME}" "${env}" "${pid}" "${log_file}"
}

do_stop() {
  local env="$1" pid_file pid deadline
  pid_file="$(pid_file_for "${env}")"

  if ! pid="$(read_pid "${pid_file}")"; then
    rm -f "${pid_file}"
    printf '%s %s 未在运行\n' "${SERVICE_NAME}" "${env}"
    return 0
  fi
  if ! pid_is_live "${pid}"; then
    rm -f "${pid_file}"
    printf '%s %s 的 PID 文件已陈旧，已清理\n' "${SERVICE_NAME}" "${env}"
    return 0
  fi

  kill -TERM "${pid}"
  deadline=$((SECONDS + STOP_TIMEOUT_SECONDS))
  while pid_is_live "${pid}"; do
    if ((SECONDS >= deadline)); then
      # 不自动升级到 KILL：强杀由仓库策略决定，脚本不替使用者做这个决定
      printf 'error: %s %s 在 %ss 内没有退出（pid %s），未强制杀死\n' \
        "${SERVICE_NAME}" "${env}" "${STOP_TIMEOUT_SECONDS}" "${pid}" >&2
      return 1
    fi
    sleep 0.2
  done

  rm -f "${pid_file}"
  printf '%s %s 已停止\n' "${SERVICE_NAME}" "${env}"
}

do_restart() {
  local env="$1"
  do_stop "${env}"
  do_start "${env}"
}

status_one() {
  local env="$1" pid_file pid port detail
  pid_file="$(pid_file_for "${env}")"
  # worker 这类服务没有端口，port_for 返回空串，输出里就不该出现空括号
  port="$(port_for "${env}")"

  if pid="$(read_pid "${pid_file}")" && pid_is_live "${pid}"; then
    detail="pid ${pid}"
    [[ -n "${port}" ]] && detail+="，端口 ${port}"
    printf '%-8s %-4s 运行中（%s）\n' "${SERVICE_NAME}" "${env}" "${detail}"
  elif [[ -e "${pid_file}" ]]; then
    printf '%-8s %-4s PID 文件陈旧（%s）\n' "${SERVICE_NAME}" "${env}" "${pid_file}"
  elif [[ -n "${port}" ]]; then
    printf '%-8s %-4s 已停止（端口 %s）\n' "${SERVICE_NAME}" "${env}" "${port}"
  else
    printf '%-8s %-4s 已停止\n' "${SERVICE_NAME}" "${env}"
  fi
}

# status 不接受环境参数，一次报全部 —— 它是用来「看一眼现在什么情况」的，
# 再问一次环境只会拖慢排查
do_status() {
  status_one dev
  status_one prod
}

# --- 通用入口 ---------------------------------------------------------------
# 每个服务脚本的 main 都长一样，放这里避免两份复制品慢慢分叉。

service_main() {
  local action="${1:-}" env="${2:-}"

  case "${action}" in
  __exec)
    # 内部动作：由 do_start 后台调用，不对外暴露
    (($# == 3)) || die "内部调用参数不合法"
    validate_env "${env}" || die "未知环境：${env}"
    do_exec "${env}" "$3"
    ;;
  start | stop | restart | run)
    (($# == 2)) || die "${action} 需要且只需要一个环境参数（dev|prod）"
    validate_env "${env}" || die "未知环境：${env}"
    if [[ "${action}" == "run" ]]; then
      do_run "${env}" # 前台不加锁：它就该能被 Ctrl-C 直接管
    else
      with_lock "${env}" "do_${action}" "${env}"
    fi
    ;;
  status)
    (($# == 1)) || die "status 不接受环境参数"
    do_status
    ;;
  *)
    die "未知动作：${action:-<空>}"
    ;;
  esac
}
