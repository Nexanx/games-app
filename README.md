# Games Tracker

Prywatna aplikacja webowa do prowadzenia historii ukończonych gier, osobnej listy „Do ogrania”, postaci Path of Exile 1/2, statystyk dropów oraz chatbota do pytań o zapisane dane.

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
DATABASE_URL=postgresql+psycopg://games:games@localhost:5433/games_app
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

`RAWG_API_KEY` jest wymagany do wyszukiwania gier. `OPENAI_API_KEY` i `OPENAI_MODEL` są wymagane do odpowiedzi chatbota. Jeśli konfiguracji brakuje albo zewnętrzne API zwróci błąd, backend zwróci jawny kod błędu 503/502 zamiast używać mocków. Frontend sprawdza `GET /api/chat/status` i wyświetla czytelny komunikat, gdy chatbot nie jest gotowy.

Przy ręcznym dodawaniu gry możesz wpisać sam tytuł. Jeśli `cover_url` jest puste, backend spróbuje pobrać okładkę i brakujące metadane z RAWG. Gdy RAWG nie jest skonfigurowany albo nie zwróci okładki, API zwróci jawny błąd zamiast zapisać rekord z danymi zastępczymi.

Backend ładuje konfigurację z rootowego `.env.production`, rootowego `.env` oraz `backend/.env`. Po zmianie kluczy API zrestartuj lokalny `uvicorn` albo odtwórz kontener backendu, żeby proces dostał nowe zmienne.

`POE_API_TOKEN` jest opcjonalny, ale wymagany do automatycznej synchronizacji lig z oficjalnego API Path of Exile. Token musi mieć scope `service:leagues`. Import postaci z poe.ninja może utworzyć brakującą ligę automatycznie z samego linku, jeśli link zawiera nazwę ligi.

Gemini działa przez OpenAI-compatible endpoint:

```env
OPENAI_API_KEY=twoj_klucz_gemini
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
OPENAI_MODEL=gemini-3.5-flash
```

## Uruchomienie

Najprościej uruchomić całą aplikację jednym skryptem PowerShell z katalogu głównego projektu:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start_app.ps1
```

Skrypt sprawdza wymagane narzędzia, przygotowuje brakujące pliki konfiguracyjne, instaluje zależności, uruchamia PostgreSQL, wykonuje migracje i seed, a następnie uruchamia backend oraz frontend w jednym terminalu. `Ctrl+C` zatrzymuje oba procesy aplikacji (kontener bazy pozostaje uruchomiony).

Przy kolejnych uruchomieniach można pominąć ponowną instalację zależności:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start_app.ps1 -SkipInstall
```

Jeśli po poprzednim uruchomieniu porty `3000` albo `8000` nadal są zajęte, można zatrzymać stare procesy tej aplikacji podczas startu:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start_app.ps1 -SkipInstall -StopExisting
```

Odpowiednik wykonywany ręcznie:

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
make backend-clear-sample-data
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

- Android/Chrome: przycisk instalacji w menu przeglądarki, jeżeli aplikacja spełnia wymagania PWA.
- iPhone/Safari: `Udostępnij` -> `Do ekranu początkowego`.

Service worker cache'uje shell aplikacji i zasoby statyczne. Endpointy `/api` są zawsze pobierane z sieci, żeby nie pokazywać nieaktualnych danych.

## Troubleshooting

### `DATABASE_UNAVAILABLE` albo błąd hasła PostgreSQL

Jeśli backend pokazuje błąd podobny do `password authentication failed for user "games"`, to `DATABASE_URL` nie pasuje do hasła zapisanej bazy PostgreSQL albo backend trafia w inną lokalną instancję PostgreSQL. Najczęstsze przyczyny:

- kontener PostgreSQL używa starego wolumenu utworzonego z innym `POSTGRES_PASSWORD`,
- `backend/.env` ma inne hasło niż `docker-compose.yml` albo `.env.production`,
- lokalnie działa inny PostgreSQL na porcie `5432`.

Devowy `docker-compose.yml` wystawia PostgreSQL na porcie hosta `5433`, żeby ominąć typowy konflikt z lokalnym Postgresem na Windowsie:

```env
DATABASE_URL=postgresql+psycopg://games:games@localhost:5433/games_app
```

Po zmianie portu odtwórz kontener bez usuwania wolumenu:

```powershell
docker compose up -d --force-recreate postgres
```

Rozwiązanie bez kasowania danych: ustaw `DATABASE_URL` dokładnie pod istniejące hasło i port bazy. Rozwiązanie tylko dla pustej/dev bazy: zatrzymaj kontener i usuń wolumen PostgreSQL, a potem utwórz bazę od nowa.

## Seed danych

Seed nie dodaje przykładowych gier, postaci ani statystyk PoE. Obecnie jest neutralnym krokiem startowym, który można bezpiecznie uruchamiać po migracjach.

```powershell
cd backend
.\.venv\Scripts\python -m app.database.seed
```

Jeśli masz lokalną bazę utworzoną starszą wersją projektu, możesz usunąć dawne przykładowe rekordy seedowe:

```powershell
cd backend
.\.venv\Scripts\python -m app.database.clear_sample_data
```

## Najważniejsze endpointy

- `GET /api/dashboard/summary`
- `GET /api/games/search?query=`
- `GET /api/games`, `POST /api/games`, `GET/PATCH/DELETE /api/games/{id}`
- `GET /api/backlog`, `POST /api/backlog`, `PATCH/DELETE /api/backlog/{id}`
- `POST /api/backlog/reorder`
- `GET /api/completed-games/years`
- `GET /api/completed-games?year=2026`
- `GET/POST /api/completed-games`, `GET/PATCH/DELETE /api/completed-games/{id}`
- `GET/POST /api/completed-games/{id}/statistics`
- `PATCH/DELETE /api/completed-games/statistics/{id}`
- `GET/POST/PATCH/DELETE /api/poe/leagues`
- `POST /api/poe/leagues/sync`
- `GET/POST/PATCH/DELETE /api/poe/characters`
- `POST /api/poe/import-from-ninja`
- `GET/POST /api/poe/characters/{id}/stats`
- `PATCH/DELETE /api/poe/stats/{id}`
- `POST /api/poe/characters/{id}/stats/reorder`
- `POST /api/chat`
- `GET /api/chat/status`
- `GET /api/chat/sessions`

## Testy

Backend:

```powershell
cd backend
.\.venv\Scripts\pytest
```

Frontend:

```powershell
cd frontend
npm test
npm run lint
npm run typecheck
npm run build
```

## Bezpieczeństwo i prywatność

Aplikacja jest jednoosobowa i prywatna. Mimo braku logowania backend waliduje wejście przez Pydantic, chatbot nie wykonuje raw SQL z prompta, a klucze API są czytane wyłącznie ze środowiska.
