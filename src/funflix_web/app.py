"""应用装配：一个进程同时提供后端接口与前端界面。

后端直接复用 funflix 自己的 `create_app()`，而不是重新 include 一遍它的路由 ——
那样会丢掉它 lifespan 里的启动探库与进程内 worker。这里只往上叠前端托管：

    /            → 跳到 /web
    /api/v1/*    → funflix 的接口（前缀由 FUNFLIX_API_PREFIX 决定，默认 /api/v1）
    /docs        → OpenAPI 文档
    /healthz     → 健康检查
    /web/*       → Vue 单页应用
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import PlainTextResponse, RedirectResponse
from funflix.api.app import create_app as create_backend_app

from funflix_web.spa import BUILD_HINT, STATIC_DIR, SPAStaticFiles, frontend_ready

logger = logging.getLogger(__name__)

WEB_PREFIX = "/web"

#: 小于这个大小就不压缩 —— 压缩头本身有开销，小响应压完可能反而更大。
_GZIP_MIN_SIZE = 1024


def _mount_frontend(app: FastAPI) -> None:
    if frontend_ready():
        app.mount(WEB_PREFIX, SPAStaticFiles(directory=STATIC_DIR), name="web")
        logger.info("前端已挂载：%s（产物目录 %s）", WEB_PREFIX, STATIC_DIR)
        return

    # 没构建也要能起服务：后端接口照常可用，访问 /web 时给出明确的下一步，
    # 而不是一个没有上下文的 404。
    logger.warning("未找到前端构建产物（%s），%s 将返回构建提示", STATIC_DIR, WEB_PREFIX)

    @app.get(WEB_PREFIX, response_class=PlainTextResponse, include_in_schema=False)
    @app.get(
        WEB_PREFIX + "/{_path:path}", response_class=PlainTextResponse, include_in_schema=False
    )
    async def _frontend_missing(_path: str = "") -> PlainTextResponse:
        return PlainTextResponse(BUILD_HINT, status_code=503)


def create_app() -> FastAPI:
    app = create_backend_app()
    app.title = "funflix-web"
    app.description = "funflix 的 Web 界面：/api 为后端接口，/web 为前端界面"

    # 前端主包未压缩有 240KB，压完约 68KB。静态资源与接口响应都会走到这里 ——
    # 没有前置的 nginx 时，这是唯一的压缩点。
    app.add_middleware(GZipMiddleware, minimum_size=_GZIP_MIN_SIZE)

    @app.get("/", include_in_schema=False)
    async def _root() -> RedirectResponse:
        return RedirectResponse(WEB_PREFIX + "/")

    # 路由注册顺序无所谓（挂载点与上面的路径不重叠），但放在最后更贴近语义：
    # 先有接口，再有界面。
    _mount_frontend(app)
    return app


app = create_app()
