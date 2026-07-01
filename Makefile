.PHONY: db-up db-down backend-install backend-migrate backend-seed backend-clear-sample-data backend-dev backend-test frontend-install frontend-dev frontend-build prod-build prod-up prod-down backup-db

db-up:
	docker compose up -d postgres

db-down:
	docker compose down

backend-install:
	cd backend && python -m venv .venv && .venv\Scripts\python -m pip install -r requirements.txt

backend-migrate:
	cd backend && .venv\Scripts\alembic upgrade head

backend-seed:
	cd backend && .venv\Scripts\python -m app.database.seed

backend-clear-sample-data:
	cd backend && .venv\Scripts\python -m app.database.clear_sample_data

backend-dev:
	cd backend && .venv\Scripts\uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

backend-test:
	cd backend && .venv\Scripts\pytest

frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

prod-build:
	docker compose -f docker-compose.prod.yml build

prod-up:
	docker compose -f docker-compose.prod.yml up -d

prod-down:
	docker compose -f docker-compose.prod.yml down

backup-db:
	powershell -ExecutionPolicy Bypass -File scripts/backup_database.ps1
