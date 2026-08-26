"""funflix-web 命令行入口。"""

from __future__ import annotations

from typing import Annotated

import typer

app = typer.Typer(help="funflix Web 界面", no_args_is_help=True)

#: 固定端口。前后端同进程，前端构建时也按这个端口配代理，两边必须一致。
DEFAULT_PORT = 8810


@app.command()
def serve(
    host: Annotated[str, typer.Option(help="监听地址；对外提供服务用 0.0.0.0")] = "127.0.0.1",
    port: Annotated[int, typer.Option(help="监听端口")] = DEFAULT_PORT,
    reload: Annotated[bool, typer.Option("--reload", help="代码变更自动重启（开发用）")] = False,
    workers: Annotated[int, typer.Option(help="uvicorn 进程数；--reload 时忽略")] = 1,
) -> None:
    """启动服务：/api 后端接口 + /web 前端界面。"""
    import uvicorn

    from funflix_web.spa import BUILD_HINT, frontend_ready

    if not frontend_ready():
        typer.secho(BUILD_HINT, fg=typer.colors.YELLOW, err=True)
        typer.secho("后端接口仍可用，继续启动。\n", fg=typer.colors.YELLOW, err=True)

    typer.secho(f"接口  http://{host}:{port}/api/v1", fg=typer.colors.CYAN)
    typer.secho(f"文档  http://{host}:{port}/docs", fg=typer.colors.CYAN)
    typer.secho(f"界面  http://{host}:{port}/web", fg=typer.colors.CYAN)

    uvicorn.run(
        "funflix_web.app:app",
        host=host,
        port=port,
        reload=reload,
        # reload 与多进程互斥，uvicorn 在两者同时给出时行为不确定，这里显式择一
        workers=None if reload else (workers if workers > 1 else None),
    )


@app.command()
def routes() -> None:
    """打印全部接口路由，排查 404 时用。

    读 OpenAPI schema 而不是遍历 `app.routes` —— FastAPI 会把 include 进来的
    子路由包成内部对象，直接遍历只能看到一个不可读的包装器。
    """
    from funflix_web.app import app as web_app

    paths = web_app.openapi().get("paths", {})
    for path in sorted(paths):
        methods = ",".join(sorted(m.upper() for m in paths[path]))
        typer.echo(f"{methods:<20} {path}")


if __name__ == "__main__":
    app()
