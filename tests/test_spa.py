"""前端静态托管与 SPA 回退。"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from funflix_web.spa import SPAStaticFiles, _looks_like_file

INDEX_HTML = "<!doctype html><title>funflix</title>"


@pytest.fixture
def static_dir(tmp_path):
    """一个最小的构建产物：index.html + 一个带 hash 的 asset。"""
    (tmp_path / "index.html").write_text(INDEX_HTML, encoding="utf-8")
    assets = tmp_path / "assets"
    assets.mkdir()
    (assets / "index-abc123.js").write_text("console.log(1)", encoding="utf-8")
    (tmp_path / "favicon.ico").write_bytes(b"\x00")
    return tmp_path


@pytest.fixture
async def client(static_dir):
    app = FastAPI()
    app.mount("/web", SPAStaticFiles(directory=static_dir), name="web")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestLooksLikeFile:
    @pytest.mark.parametrize("path", ["index.html", "favicon.ico", "assets/a-1.js", "a/b/c.css"])
    def test_true_for_real_filenames(self, path: str) -> None:
        assert _looks_like_file(path) is True

    @pytest.mark.parametrize("path", ["", ".", "..", "media", "media/1", "dashboard"])
    def test_false_for_route_like_paths(self, path: str) -> None:
        """`.` 是关键用例：Starlette 把挂载点根路径规范化成它，
        误判成文件的话首页会 404，只有深链打得开。"""
        assert _looks_like_file(path) is False


@pytest.mark.asyncio
class TestSPAServing:
    async def test_serves_index_at_mount_root(self, client) -> None:
        resp = await client.get("/web/")
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]
        assert resp.text == INDEX_HTML

    async def test_serves_index_for_deep_link(self, client) -> None:
        """刷新 /web/media/12 时服务端没有对应文件，必须回退给前端路由。"""
        resp = await client.get("/web/media/12")
        assert resp.status_code == 200
        assert resp.text == INDEX_HTML

    async def test_serves_real_asset(self, client) -> None:
        resp = await client.get("/web/assets/index-abc123.js")
        assert resp.status_code == 200
        assert resp.text == "console.log(1)"

    async def test_missing_asset_404s_instead_of_falling_back(self, client) -> None:
        """回退成 HTML 的话，浏览器会把 index.html 当 JS 解析，
        报一个与真实原因（文件缺失）毫无关系的语法错误。"""
        resp = await client.get("/web/assets/missing-xyz.js")
        assert resp.status_code == 404

    async def test_missing_file_with_extension_404s(self, client) -> None:
        resp = await client.get("/web/robots.txt")
        assert resp.status_code == 404

    async def test_existing_non_asset_file_is_served(self, client) -> None:
        resp = await client.get("/web/favicon.ico")
        assert resp.status_code == 200
