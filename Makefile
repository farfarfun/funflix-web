# 服务生命周期的唯一入口是 scripts/setup.sh。
# 这里只保留装依赖、测试、构建这类非生命周期任务，外加几个常用转发，
# 避免同一件事出现两套互相漂移的实现。
.PHONY: install build test lint dev serve status stop clean

PY := .venv/bin
FUNFLIX := ../funflix
SETUP := scripts/setup.sh

install:
	uv venv
	uv pip install -e ".[dev]"
	cd frontend && pnpm install

build:
	cd frontend && pnpm build

test:
	$(PY)/python -m pytest -q
	cd $(FUNFLIX) && .venv/bin/python -m pytest -q

lint:
	$(PY)/python -m ruff check src tests
	$(PY)/python -m ruff format --check src tests
	cd frontend && pnpm exec vue-tsc --noEmit
	bash -n $(SETUP) scripts/release.sh scripts/lib/service.sh scripts/services/*.sh

# --- 生命周期：一律转发给 setup.sh ---

# 前台起 web（带热重载）。前端 HMR 另开一个终端：cd frontend && pnpm dev
dev:
	bash $(SETUP) run web dev

serve: build
	bash $(SETUP) start web dev

status:
	bash $(SETUP) status

stop:
	bash $(SETUP) stop web dev

clean:
	rm -rf src/funflix_web/static .run
