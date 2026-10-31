.PHONY: help up down migrate seed dev-backend dev-frontend api worker lint typecheck test-unit test-integration test e2e types firmware-test clean

help:
	@echo "Available make targets:"
	@echo "  up                - Start Docker Compose services (Postgres, Redis)"
	@echo "  down              - Stop Docker Compose services"
	@echo "  migrate           - Apply Alembic migrations to the database"
	@echo "  seed              - Run database seed script with demo data"
	@echo "  api / dev-backend - Start the FastAPI development server"
	@echo "  worker            - Start the arq background worker process"
	@echo "  dev-frontend      - Start the Next.js frontend development server"
	@echo "  lint              - Run linters on backend and frontend"
	@echo "  typecheck         - Run typecheckers (mypy on backend, tsc on frontend)"
	@echo "  test-unit         - Run backend unit tests"
	@echo "  test-integration  - Run backend integration tests"
	@echo "  test              - Run all backend tests"
	@echo "  e2e               - Run simulator acceptance scenarios (S1-S10)"
	@echo "  types             - Export OpenAPI spec and regenerate frontend types"
	@echo "  firmware-test     - Run native firmware tests"
	@echo "  clean             - Clean cache directories and build artifacts"

up:
	docker compose up -d postgres redis

down:
	docker compose down

migrate:
	cd backend && uv run alembic upgrade head

seed:
	cd backend && uv run python ../scripts/seed_demo.py

api: dev-backend

dev-backend:
	cd backend && uv run uvicorn app.main:app --port 8000

worker:
	cd backend && uv run arq app.workers.settings.WorkerSettings

dev-frontend:
	cd frontend && npm run dev

lint:
	cd backend && uv run ruff check app tests
	cd backend && uv run ruff format --check app tests

typecheck:
	cd backend && uv run mypy --strict app

test-unit:
	cd backend && uv run pytest tests/unit

test-integration:
	cd backend && uv run pytest tests/integration

test: test-unit test-integration

e2e:
	cd backend && uv run python ../simulator/run_scenario.py

types:
	cd backend && uv run python ../scripts/export_openapi.py
	cd frontend && npm run generate-types

firmware-test:
	g++ -std=c++17 -I firmware/include -I firmware/src -I firmware/test/test_native firmware/test/test_native/test_main.cpp firmware/src/fft_analyzer.cpp firmware/src/baseline.cpp firmware/src/detector.cpp firmware/src/telemetry_client.cpp -o firmware/test_runner.exe && ./firmware/test_runner.exe

clean:
	rm -rf backend/.pytest_cache backend/.mypy_cache backend/.ruff_cache frontend/.next
