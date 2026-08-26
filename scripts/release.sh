#!/usr/bin/env bash
# 发布与安装 —— 包级动作，不属于任何单个服务。
#
# web 和 worker 来自同一个 funflix-web 包，所以 publish / install 各自只有一份，
# 放在服务脚本里会变成两份互相漂移的复制品。
#
# 遵循 service-release-governance：开发可以直接跑工作树，生产必须跑
# 「已发布到仓库、再从仓库按精确版本装回来」的正式包。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUN_DIR="${ROOT}/.run"
PROD_VENV="${RUN_DIR}/prod-venv"
FRONTEND_DIR="${ROOT}/frontend"
STATIC_DIR="${ROOT}/src/funflix_web/static"
PACKAGE_NAME="funflix-web"
IMPORT_NAME="funflix_web"

readonly SCRIPT_DIR ROOT RUN_DIR PROD_VENV FRONTEND_DIR STATIC_DIR
readonly PACKAGE_NAME IMPORT_NAME

die() {
  printf 'error: %s\n' "$*" >&2
  exit 2
}

info() { printf '==> %s\n' "$*"; }

# 声明版本以 pyproject 为准。这里只读版本号这一项元数据，
# 不是让生产从工作树取代码 —— 取代码的是下面的 pip install。
declared_version() {
  python3 - "$@" <<'PY'
import pathlib, sys, tomllib
root = pathlib.Path(sys.argv[1])
data = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
print(data["project"]["version"])
PY
}

# --- 前端产物 ---------------------------------------------------------------

# 复用 dev.sh 的构建，不在这里再写一遍 —— 两份构建命令迟早会漂
build_frontend() {
  bash "${SCRIPT_DIR}/dev.sh" build
}

# --- publish ----------------------------------------------------------------

do_publish() {
  local version
  version="$(declared_version "${ROOT}")"

  command -v nltbuild >/dev/null 2>&1 || die "未找到 nltbuild，它是本项目约定的构建发布工具"

  # 前端必须先构建：静态产物被 .gitignore 忽略，不显式产出的话打出来的 wheel
  # 里没有 static/，装完之后 /web 会返回「前端尚未构建」而不是界面。
  build_frontend

  info "发布 ${PACKAGE_NAME} ${version}"
  (cd "${ROOT}" && nltbuild build)

  restore_editable_install

  cat <<EOF

已发布 ${PACKAGE_NAME} ${version}。
下一步在生产机上：
    scripts/setup.sh install ${version}
    scripts/setup.sh start web prod
EOF
}

# nltbuild 在构建后会把打出来的 wheel 装进当前环境做校验，这会顶掉开发用的
# 可编辑安装 —— 之后改 src/ 下的代码不再生效，而且完全没有提示：服务照常起，
# 跑的却是发布那一刻的快照。这里把它装回去。
restore_editable_install() {
  local dev_venv="${ROOT}/.venv"
  [[ -d "${dev_venv}" ]] || return 0

  local location
  location="$("${dev_venv}/bin/python" -c \
    'import funflix_web,pathlib;print(pathlib.Path(funflix_web.__file__).resolve().parent)' \
    2>/dev/null)" || return 0

  # 已经指向工作树就不用动
  [[ "${location}" == "${ROOT}/src/funflix_web" ]] && return 0

  info "恢复开发用的可编辑安装（nltbuild 装入的 wheel 覆盖了它）"
  if command -v uv >/dev/null 2>&1; then
    (cd "${ROOT}" && uv pip install -e ".[dev]" >/dev/null)
  else
    "${dev_venv}/bin/pip" install -q -e "${ROOT}[dev]"
  fi
}

# --- install ----------------------------------------------------------------

do_install() {
  local version="${1:-}"
  local -a index_args=()

  [[ -n "${version}" ]] || version="$(declared_version "${ROOT}")"
  [[ -n "${FUNFLIX_WEB_INDEX_URL:-}" ]] && index_args+=(--index-url "${FUNFLIX_WEB_INDEX_URL}")

  # 每次重建，避免上一次残留的版本或可编辑安装留在环境里
  info "重建生产虚拟环境 ${PROD_VENV}"
  mkdir -p "${RUN_DIR}"
  rm -rf "${PROD_VENV}"

  # 优先用 uv：本项目本来就用它，而且部分系统上 python3 -m venv
  # 因为缺 ensurepip 会建出一个没有 pip 的环境，报错还很隐晦。
  if command -v uv >/dev/null 2>&1; then
    uv venv "${PROD_VENV}" >/dev/null
    info "从仓库安装 ${PACKAGE_NAME}==${version}"
    uv pip install --python "${PROD_VENV}/bin/python" --no-cache \
      "${index_args[@]}" "${PACKAGE_NAME}==${version}" >/dev/null
  else
    command -v python3 >/dev/null 2>&1 || die "既没有 uv 也没有 python3"
    python3 -m venv "${PROD_VENV}"
    [[ -x "${PROD_VENV}/bin/pip" ]] ||
      die "建出的虚拟环境里没有 pip（系统可能缺 ensurepip / python3-venv），请安装 uv 后重试"
    info "从仓库安装 ${PACKAGE_NAME}==${version}"
    "${PROD_VENV}/bin/pip" install --no-cache-dir \
      "${index_args[@]}" "${PACKAGE_NAME}==${version}" >/dev/null
  fi

  verify_install "${version}"
}

# governance 要求证明装回来的确实是仓库里的正式包，而不是悄悄解析到了
# 本地路径或可编辑安装。下面逐条验，任何一条不过就直接失败。
verify_install() {
  local version="$1"
  info "校验安装结果"

  ROOT="${ROOT}" IMPORT_NAME="${IMPORT_NAME}" PACKAGE_NAME="${PACKAGE_NAME}" \
    EXPECTED_VERSION="${version}" \
    "${PROD_VENV}/bin/python" <<'PY'
import importlib.metadata as md
import os
import pathlib
import sys

root = pathlib.Path(os.environ["ROOT"]).resolve()
import_name = os.environ["IMPORT_NAME"]
package_name = os.environ["PACKAGE_NAME"]
expected = os.environ["EXPECTED_VERSION"]

failures = []

installed = md.version(package_name)
if installed != expected:
    failures.append(f"版本不符：期望 {expected}，实际 {installed}")

mod = __import__(import_name)
location = pathlib.Path(mod.__file__).resolve().parent
if root in location.parents or location == root:
    failures.append(f"代码来自源码检出而不是安装包：{location}")

# 可编辑安装会留下 __editable__ 的 finder 或 .pth
site = pathlib.Path(mod.__file__).resolve().parent.parent
for pth in site.glob("__editable__*"):
    failures.append(f"存在可编辑安装痕迹：{pth}")

# 前端静态产物必须随包一起装进来，否则 /web 是空的
index = location / "static" / "index.html"
if not index.is_file():
    failures.append(f"安装包内缺少前端产物：{index}")

# funflix 也必须来自这个生产环境，且带查询接口。
# 判断依据是「和 funflix_web 装在同一个 site-packages 下」而不是「不在某个
# 兄弟目录里」—— 后者假设了仓库的摆放位置，换台机器就不成立。
import funflix
fl = pathlib.Path(funflix.__file__).resolve().parent
if fl.parent != location.parent:
    failures.append(f"funflix 不在生产环境里：{fl}")
if fl == root or root in fl.parents:
    failures.append(f"funflix 来自源码检出：{fl}")
try:
    __import__("funflix.services.stats")
except ImportError:
    failures.append("装回来的 funflix 缺少 M6 查询接口（services.stats），请先发布新版 funflix")

if failures:
    for f in failures:
        print(f"  ✗ {f}", file=sys.stderr)
    sys.exit(1)

print(f"  ✓ {package_name} {installed}")
print(f"  ✓ 代码位置 {location}")
print(f"  ✓ funflix {md.version('funflix')} @ {fl}")
print(f"  ✓ 前端产物随包安装")
PY

  # 冒烟：能把路由列出来就说明装好的包真的能起
  info "冒烟检查"
  if "${PROD_VENV}/bin/funflix-web" routes 2>/dev/null | grep -q '/api/v1/media'; then
    printf '  ✓ 路由可枚举，含 /api/v1/media\n'
  else
    die "冒烟检查失败：装好的包无法列出预期路由"
  fi

  printf '\n%s==%s 已就绪，可执行 scripts/setup.sh start web prod\n' "${PACKAGE_NAME}" "$1"
}

main() {
  local action="${1:-}"
  case "${action}" in
  publish)
    (($# == 1)) || die "publish 不接受额外参数"
    do_publish
    ;;
  install)
    (($# <= 2)) || die "install 最多接受一个版本号"
    do_install "${2:-}"
    ;;
  *) die "未知动作：${action:-<空>}" ;;
  esac
}

main "$@"
