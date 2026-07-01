# Games & Path of Exile Tracker

Prywatna aplikacja webowa do zarządzania backlogiem gier, postaciami Path of Exile 1/2, statystykami dropów oraz chatbotem do pytań o zapisane dane.

Nie ma logowania, rejestracji, ról ani systemu kont. Next.js jest wyłącznie frontendem, a cała logika API, integracje, baza i chatbot są w backendzie FastAPI.

## Stack

- Frontend: Next.js, TypeScript, Tailwind CSS, komponenty w stylu shadcn/ui, dnd-kit, react-hook-form, Zod, PWA manifest.
- Backend: Python, FastAPI, SQLAlchemy 2.0, Pydantic, Alembic, Uvicorn.
- Baza: PostgreSQL przez Docker Compose.
- Integracje: RAWG bez danych testowych, konserwatywny importer poe.ninja, chatbot przez OpenAI-compatible API, np. Gemini.

## Struktura

```text
frontend/
  app/
  components/
  lib/
  services/
  styles/
  types/
backend/
  app/
    api/
    core/
    models/
    schemas/
    services/
    database/
    integrations/
    chatbot/
  alembic/
  tests/
docker-compose.yml
Makefile
.env.example
```

## Wymagania

- Python 3.11+
- Node.js 20+
- Docker Desktop
- opcjonalnie `make`

## Konfiguracja

Skopiuj `.env.example` do `.env` w katalogu głównym oraz do `backend/.env` i `frontend/.env.local`, jeśli uruchamiasz procesy z ich podkatalogów.

Minimalne wartości:

```env
DATABASE_URL=postgresql+psycopg://games:games@localhost:5432/games_app
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

`RAWG_API_KEY` jest wymagany do wyszukiwania gier. `OPENAI_API_KEY` i `OPENAI_MODEL` są wymagane do odpowiedzi chatbota. Jeśli konfiguracji brakuje albo zewnętrzne API zwróci błąd, backend zwróci jawny kod błędu 503/502 zamiast używać mocków.

Gemini działa przez OpenAI-compatible endpoint:

```env
OPENAI_API_KEY=twoj_klucz_gemini
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
OPENAI_MODEL=gemini-3.5-flash
```

## Uruchomienie

```powershell
docker compose up -d postgres
cd backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\alembic upgrade head
.\.venv\Scripts\python -m app.database.seed
.\.venv\Scripts\uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

W drugim terminalu:

```powershell
cd frontend
npm install
npm run dev
```

Aplikacja:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- OpenAPI: http://localhost:8000/docs

## Komendy Makefile

```powershell
make db-up
make backend-install
make backend-migrate
make backend-seed
make backend-dev
make frontend-install
make frontend-dev
```

## Tryb produkcyjny

Projekt zawiera produkcyjny Compose:

- `backend/Dockerfile` dla FastAPI,
- `frontend/Dockerfile` dla Next.js,
- `docker-compose.prod.yml` z PostgreSQL, backendem, frontendem i Caddy,
- `Caddyfile` jako reverse proxy pod jedną domeną,
- `.env.production.example` jako wzór konfiguracji,
- skrypty backup/restore bazy w `scripts/`.

Przykład lokalny:

```powershell
Copy-Item .env.production.example .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Na VPS ustaw w `.env.production`:

```env
APP_DOMAIN=games.twojadomena.pl
PUBLIC_APP_URL=https://games.twojadomena.pl
POSTGRES_PASSWORD=dlugie-losowe-haslo
```

Caddy automatycznie obsłuży HTTPS dla prawdziwej domeny wskazującej na serwer. Frontend używa wtedy `/api`, więc telefon widzi jedną aplikację pod jednym adresem.

Backup bazy:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup_database.ps1
```

Restore bazy:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/restore_database.ps1 -BackupPath backups/games-app-YYYYMMDD-HHMMSS.sql
```

Przywracanie nadpisuje dane w bazie, więc uruchamiaj je tylko świadomie.

## PWA

Aplikacja ma manifest, service worker i stronę offline. W produkcji po HTTPS można ją dodać do ekranu głównego telefonu.

- Android/Chrome: przycisk instalacji w `Ustawienia` albo menu przeglądarki.
- iPhone/Safari: `Udostępnij` -> `Do ekranu początkowego`.

Service worker cache'uje shell aplikacji i zasoby statyczne. Endpointy `/api` są zawsze pobierane z sieci, żeby nie pokazywać nieaktualnych danych.

## Troubleshooting

### `DATABASE_UNAVAILABLE` albo błąd hasła PostgreSQL

Jeśli backend pokazuje błąd podobny do `password authentication failed for user "games"`, to `DATABASE_URL` nie pasuje do hasła zapisanej bazy PostgreSQL. Najczęstsze przyczyny:

- kontener PostgreSQL używa starego wolumenu utworzonego z innym `POSTGRES_PASSWORD`,
- `backend/.env` ma inne hasło niż `docker-compose.yml` albo `.env.production`,
- lokalnie działa inny PostgreSQL na porcie `5432`.

Rozwiązanie bez kasowania danych: ustaw `DATABASE_URL` dokładnie pod istniejące hasło bazy. Rozwiązanie tylko dla pustej/dev bazy: zatrzymaj kontener i usuń wolumen PostgreSQL, a potem utwórz bazę od nowa.

## Seed danych

Seed dodaje przykładowe gry, backlog, ligi PoE, postacie i statystyki walut. Skrypt nie dopisuje drugi raz danych, jeśli tabela `games` nie jest pusta.

```powershell
cd backend
.\.venv\Scripts\python -m app.database.seed
```

## Najważniejsze endpointy

- `GET /api/dashboard/summary`
- `GET /api/games/search?query=`
- `GET /api/games`, `POST /api/games`, `GET/PATCH/DELETE /api/games/{id}`
- `GET /api/backlog`, `POST /api/backlog`, `PATCH/DELETE /api/backlog/{id}`
- `POST /api/backlog/reorder`
- `POST /api/backlog/{id}/mark-completed`
- `POST /api/backlog/{id}/mark-playing`
- `POST /api/backlog/{id}/mark-abandoned`
- `GET/POST/PATCH/DELETE /api/poe/leagues`
- `GET/POST/PATCH/DELETE /api/poe/characters`
- `POST /api/poe/import-from-ninja`
- `GET/POST /api/poe/characters/{id}/stats`
- `PATCH/DELETE /api/poe/stats/{id}`
- `POST /api/poe/characters/{id}/stats/reorder`
- `POST /api/chat`
- `GET /api/chat/sessions`

## Testy

Backend:

```powershell
cd backend
.\.venv\Scripts\pytest
```

Frontend ma przygotowany katalog `frontend/tests` pod przyszłe testy komponentów i e2e.

## Bezpieczeństwo i prywatność

Aplikacja jest jednoosobowa i prywatna. Mimo braku logowania backend waliduje wejście przez Pydantic, chatbot nie wykonuje raw SQL z prompta, a klucze API są czytane wyłącznie ze środowiska.
