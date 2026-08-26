"""应用装配：后端接口与前端界面挂在同一个 app 上。"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from funflix_web.app import WEB_PREFIX, create_app


@pytest.fixture
async def client():
    app = create_app()
    transport = ASGITransport(app=app)
    # 绕过 lifespan：它会去连真实数据库，这里只关心路由装配
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
class TestComposition:
    async def test_root_redirects_to_web(self, client) -> None:
        resp = await client.get("/")
        assert resp.status_code in (307, 308)
        assert resp.headers["location"] == f"{WEB_PREFIX}/"

    async def test_backend_routes_are_mounted(self, client) -> None:
        """funflix 自己的路由要原样保留 —— 这里复用的是它的 create_app()。"""
        paths = create_app().openapi()["paths"]
        for path in ("/api/v1/media", "/api/v1/sources", "/api/v1/raw", "/api/v1/stats"):
            assert path in paths

    async def test_openapi_is_served(self, client) -> None:
        resp = await client.get("/openapi.json")
        assert resp.status_code == 200
        assert resp.json()["info"]["title"] == "funflix-web"
