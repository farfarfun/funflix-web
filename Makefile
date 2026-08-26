.PHONY: install build dev serve test lint clean

PY := .venv/bin
FUNFLIX := ../funflix

install:
	uv venv
	uv pip install -e ".[dev]"
	cd frontend && pnpm install

build:
	cd frontend && pnpm build

serve: build
	$(PY)/funflix-web serve

# 前后端并行起：8810 提供接口，5173 提供带 HMR 的界面。
# trap 保证 Ctrl-C 时两个都退，不会留一个后台进程占着 8810。
dev:
	@echo "接口 http://127.0.0.1:8810  界面 http://127.0.0.1:5173"
	@trap 'kill 0' EXIT INT TERM; \
	$(PY)/funflix-web serve --reload & \
	(cd frontend && pnpm dev) & \
	wait

test:
	$(PY)/python -m pytest -q
	cd $(FUNFLIX) && .venv/bin/python -m pytest -q

lint:
	$(PY)/python -m ruff check src tests
	$(PY)/python -m ruff format --check src tests
	cd frontend && pnpm exec vue-tsc --noEmit

clean:
	rm -rf src/funflix_web/static
