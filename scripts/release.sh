#!/usr/bin/env bash
# 发布与安装 —— 包级动作，不属于任何单个服务。
#
# 两件不相关的事，放在一起只是因为都不属于任何单个服务：
#   publish  构建前端并发布 funflix-web 这个 npm 包到私有仓库
#   install  给 worker/sync 两个 bash 生命周期服务装 funflix 本身（精确版本）
#
# 前端（funflix-web）已经不是本仓库的产出物之一了——本仓库根目录本身就是它的
# npm 包源码；用户自己 `npm i -g funflix-web` 装、`funflix-web server start`
# 起，不走这里的 install。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUN_DIR="${ROOT}/.run"
PROD_VENV="${RUN_DIR}/prod-venv"
FUNFLIX_PACKAGE_NAME="funflix"

readonly SCRIPT_DIR ROOT RUN_DIR PROD_VENV FUNFLIX_PACKAGE_NAME

die() {
  printf 'error: %s\n' "$*" >&2
  exit 2
}

info() { printf '==> %s\n' "$*"; }

require() {
  command -v "$1" >/dev/null 2>&1 || die "未找到 $1，$2"
}

frontend_version() {
  node -p "require('${ROOT}/package.json').version"
}

# --- publish（前端 npm 包）---------------------------------------------------

do_publish() {
  require funbuild "安装：uv tool install funbuild 或 pip install funbuild"

  # funbuild build：清理旧产物 -> 装依赖 -> 构建 -> 本地装一份自检 -> npm publish
  # -> 清理 -> commit+push -> tag，一条命令走完，不再手写 pnpm/npm 那一串。
  (cd "${ROOT}" && funbuild build)

  local version
  version="$(frontend_version)"

  cat <<EOF

已发布 funflix-web ${version}。
下一步：
    npm i -g funflix-web
    funflix server start --host 127.0.0.1 --port 18810 &
    funflix-web server start --backend http://127.0.0.1:18810
EOF
}

# --- install（funflix，供 worker/sync 生产态使用）---------------------------

do_install() {
  local version="${1:-}"
  local -a index_args=()

  [[ -n "${version}" ]] || die "install 需要一个明确的 funflix 版本号，例如：scripts/setup.sh install 0.1.34"
  [[ -n "${FUNFLIX_INDEX_URL:-}" ]] && index_args+=(--index-url "${FUNFLIX_INDEX_URL}")

  # 每次重建，避免上一次残留的版本留在环境里
  info "重建生产虚拟环境 ${PROD_VENV}"
  mkdir -p "${RUN_DIR}"
  rm -rf "${PROD_VENV}"

  # 优先用 uv：本项目本来就用它，而且部分系统上 python3 -m venv
  # 因为缺 ensurepip 会建出一个没有 pip 的环境，报错还很隐晦。
  if command -v uv >/dev/null 2>&1; then
    uv venv "${PROD_VENV}" >/dev/null
    info "安装 ${FUNFLIX_PACKAGE_NAME}==${version}"
    uv pip install --python "${PROD_VENV}/bin/python" --no-cache \
      "${index_args[@]}" "${FUNFLIX_PACKAGE_NAME}==${version}" >/dev/null
  else
    command -v python3 >/dev/null 2>&1 || die "既没有 uv 也没有 python3"
    python3 -m venv "${PROD_VENV}"
    [[ -x "${PROD_VENV}/bin/pip" ]] ||
      die "建出的虚拟环境里没有 pip（系统可能缺 ensurepip / python3-venv），请安装 uv 后重试"
    info "安装 ${FUNFLIX_PACKAGE_NAME}==${version}"
    "${PROD_VENV}/bin/pip" install --no-cache-dir \
      "${index_args[@]}" "${FUNFLIX_PACKAGE_NAME}==${version}" >/dev/null
  fi

  verify_install "${version}"
}

# 证明装回来的确实是仓库按版本号解析到的正式包。
verify_install() {
  local version="$1"
  info "校验安装结果"

  FUNFLIX_PACKAGE_NAME="${FUNFLIX_PACKAGE_NAME}" EXPECTED_VERSION="${version}" \
    "${PROD_VENV}/bin/python" <<'PY'
import importlib.metadata as md
import os
import pathlib
import sys

package_name = os.environ["FUNFLIX_PACKAGE_NAME"]
expected = os.environ["EXPECTED_VERSION"]

failures = []

installed = md.version(package_name)
if installed != expected:
    failures.append(f"版本不符：期望 {expected}，实际 {installed}")

mod = __import__(package_name)
location = pathlib.Path(mod.__file__).resolve().parent

try:
    __import__("funflix.services.stats")
except ImportError:
    failures.append("装回来的 funflix 缺少 M6 查询接口（services.stats）")

if failures:
    for f in failures:
        print(f"  ✗ {f}", file=sys.stderr)
    sys.exit(1)

print(f"  ✓ {package_name} {installed}")
print(f"  ✓ 代码位置 {location}")
PY

  info "冒烟检查"
  "${PROD_VENV}/bin/funflix" --help >/dev/null 2>&1 ||
    die "冒烟检查失败：装好的 funflix 无法运行 --help"
  printf '  ✓ funflix 可执行\n'

  printf '\n%s==%s 已就绪，可执行 scripts/setup.sh start worker prod / start sync prod\n' \
    "${FUNFLIX_PACKAGE_NAME}" "${version}"
}

main() {
  local action="${1:-}"
  case "${action}" in
  publish)
    (($# == 1)) || die "publish 不接受额外参数"
    do_publish
    ;;
  install)
    (($# == 2)) || die "install 需要且只需要一个版本号"
    do_install "${2:-}"
    ;;
  *) die "未知动作：${action:-<空>}" ;;
  esac
}

main "$@"
