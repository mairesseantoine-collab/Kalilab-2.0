.PHONY: up down dev seed test lint-back lint-front build logs reset-db migrate

# Compatibilité docker compose v2 (sans tiret)
DC = docker compose

up:
	$(DC) up -d

down:
	$(DC) down

dev:
	$(DC) -f docker-compose.dev.yml up

seed:
	$(DC) -f docker-compose.dev.yml exec backend python seed.py

test:
	$(DC) -f docker-compose.dev.yml exec backend pytest tests/ -v

lint-back:
	cd backend && ruff check . && mypy .

lint-front:
	cd frontend && npm run lint

build:
	$(DC) build

logs:
	$(DC) -f docker-compose.dev.yml logs -f

reset-db:
	$(DC) -f docker-compose.dev.yml exec backend alembic downgrade base
	$(DC) -f docker-compose.dev.yml exec backend alembic upgrade head
	$(DC) -f docker-compose.dev.yml exec backend python seed.py

migrate:
	$(DC) -f docker-compose.dev.yml exec backend alembic revision --autogenerate -m "$(msg)"
	$(DC) -f docker-compose.dev.yml exec backend alembic upgrade head
