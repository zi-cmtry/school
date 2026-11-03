.PHONY: help run test seed
.DEFAULT_GOAL := run

PYTHON ?= python3
export PYTHONPATH := backend

help:
	@echo "make run    启动接口，地址 http://127.0.0.1:8000"
	@echo "make seed   写入演示数据（可重复执行）"
	@echo "make test   运行 pytest"

run:
	$(PYTHON) -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir backend

test:
	$(PYTHON) -m pytest -q

seed:
	$(PYTHON) backend/scripts/seed.py
