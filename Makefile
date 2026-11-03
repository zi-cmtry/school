.PHONY: run test seed

PYTHON ?= python3
export PYTHONPATH := backend

run:
	$(PYTHON) -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir backend

test:
	$(PYTHON) -m pytest -q

seed:
	$(PYTHON) backend/scripts/seed.py
