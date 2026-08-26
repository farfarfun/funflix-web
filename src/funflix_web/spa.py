"""前端静态资源托管。

Vue Router 用 history 模式，`/web/media/12` 这类深链在服务端并没有对应文件，
刷新页面时必须回退到 `index.html` 交给前端路由，否则直接 404。
"""

from __future__ import annotations

import logging
from pathlib import Path

from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import Response
from starlette.staticfiles import StaticFiles

logger = logging.getLogger(__name__)

#: 构建产物目录。由 `pnpm build` 写入（见 frontend/vite.config.ts 的 outDir）。
STATIC_DIR = Path(__file__).parent / "static"

#: Vite 把带 hash 的资源全部放在这个子目录下。
_ASSETS_PREFIX = "assets/"

#: 带内容 hash 的资源可以永久缓存：内容一变文件名就变，不存在缓存到旧版本的可能。
_IMMUTABLE_CACHE = "public, max-age=31536000, immutable"

#: index.html 必须每次回源校验。它是唯一记录「当前该加载哪些 hash 资源」的地方，
#: 一旦被缓存住，重新部署后用户会一直拿着旧的资源清单，新版本永远生效不了。
_NO_CACHE = "no-cache"


def _looks_like_file(path: str) -> bool:
    """路径最后一段带扩展名就当它是文件。

    `.` 和 `..` 要排除掉：Starlette 把挂载点根路径（`/web/`）规范化成 `.`，
    单纯判断「含点」会把首页误判成文件，结果整个站点只有深链打得开。
    """
    name = path.rsplit("/", 1)[-1]
    return name not in {"", ".", ".."} and "." in name


class SPAStaticFiles(StaticFiles):
    """带 index.html 回退与缓存策略的静态目录。"""

    async def get_response(self, path: str, scope) -> Response:
        served_from_assets = path.startswith(_ASSETS_PREFIX)
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404:
                raise
            # 只有「看起来像前端路由」的路径才回退。assets/ 下取不到的文件
            # 说明构建产物不完整，这时返回 index.html 会让浏览器把 HTML
            # 当成 JS 解析，报一个与真实原因（文件缺失）毫无关系的错。
            if served_from_assets or _looks_like_file(path):
                raise
            response = await super().get_response("index.html", scope)
            served_from_assets = False

        # 304 也要带上，否则重新校验成功后浏览器会丢掉原来的缓存指令
        if response.status_code in (200, 304):
            response.headers["Cache-Control"] = (
                _IMMUTABLE_CACHE if served_from_assets else _NO_CACHE
            )
        return response


def frontend_ready() -> bool:
    """构建产物是否就位。"""
    return (STATIC_DIR / "index.html").is_file()


BUILD_HINT = (
    "前端尚未构建。请先执行：\n"
    "    cd frontend && pnpm install && pnpm build\n"
    "构建产物会写入 src/funflix_web/static/，之后重启服务即可。"
)
