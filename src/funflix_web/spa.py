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


def _looks_like_file(path: str) -> bool:
    """路径最后一段带扩展名就当它是文件。

    `.` 和 `..` 要排除掉：Starlette 把挂载点根路径（`/web/`）规范化成 `.`，
    单纯判断「含点」会把首页误判成文件，结果整个站点只有深链打得开。
    """
    name = path.rsplit("/", 1)[-1]
    return name not in {"", ".", ".."} and "." in name


class SPAStaticFiles(StaticFiles):
    """带 index.html 回退的静态目录。"""

    async def get_response(self, path: str, scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404:
                raise
            # 只有「看起来像前端路由」的路径才回退。assets/ 下取不到的文件
            # 说明构建产物不完整，这时返回 index.html 会让浏览器把 HTML
            # 当成 JS 解析，报一个与真实原因（文件缺失）毫无关系的错。
            if path.startswith(_ASSETS_PREFIX) or _looks_like_file(path):
                raise
            return await super().get_response("index.html", scope)


def frontend_ready() -> bool:
    """构建产物是否就位。"""
    return (STATIC_DIR / "index.html").is_file()


BUILD_HINT = (
    "前端尚未构建。请先执行：\n"
    "    cd frontend && pnpm install && pnpm build\n"
    "构建产物会写入 src/funflix_web/static/，之后重启服务即可。"
)
