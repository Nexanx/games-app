# Games Tracker

Games Tracker to prywatna, jednoosobowa aplikacja webowa do prowadzenia listy „Do ogrania”, historii ukończeń i własnych analiz. Osobny moduł Path of Exile przechowuje ligi, postacie PoE 1/2 oraz ręczne liczniki dropów. Aplikacja zawiera również chatbota odpowiadającego na pytania o zapisane dane.

Projekt nie ma własnych kont ani ról. Next.js odpowiada za interfejs, a FastAPI za API, integracje i dostęp do PostgreSQL. Produkcyjny Caddy chroni całą aplikację podstawowym uwierzytelnianiem HTTP; przy wdrożeniu wieloużytkownikowym nadal potrzebny byłby właściwy model kont i autoryzacji.

## Główne funkcje

### Dashboard

- podsumowanie bieżącego roku: liczba ukończeń, czas gry, średnia ocen i najaktywniejszy miesiąc;
- ostatnie ukończenia i pierwsze pozycje z kolejki „Do ogrania”;
- kompaktowy skrót modułu PoE, którego błąd nie blokuje danych o grach;
- szybkie przejścia do dodania ukończenia, listy, Analizy i PoE;
- eksport oraz przywracanie kopii danych JSON.

### Do ogrania

- wyszukiwanie w RAWG z paginacją i wyborem wielu wyników;
- ręczne dodawanie gry, gdy RAWG nie jest potrzebny;
- wykrywanie duplikatów oraz atomowe dodawanie grupy wyników;
- własna kolejność drag-and-drop, preferowana platforma, notatka, filtrowanie i sortowanie;
- rekomendacje RAWG dopasowywane do ocen, gatunków, platform oraz trwałych reakcji „Pasuje do mnie” / „Nie dla mnie”; opinię można od razu cofnąć, a „Ukryj” działa neutralnie tylko w bieżącej przeglądarce;
- osobny widok premier RAWG z filtrowaniem po dacie, platformie, gatunku i tytule; terminy premier, zwłaszcza przyszłe i zależne od platformy, mogą się zmienić;
- lista pozostaje niezależna od historii ukończeń.

### Oceny zewnętrzne

- wyniki wyszukiwania, karty gier i szczegóły mogą pokazywać osobno `Moja ocena`, ocenę RAWG oraz wynik Metacritic, wyłącznie gdy RAWG zwraca odpowiednie pole;
- wartość, skala, liczba głosów i data odświeżenia są przechowywane jako migawka zewnętrzna i nie nadpisują oceny użytkownika;
- aplikacja nie scrapuje stron ocen. Uzupełnienie istniejącej biblioteki jest ręczną operacją administracyjną i wymaga `RAWG_API_KEY`:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.database.backfill_external_ratings
```

Dodaj `--refresh-existing`, aby odświeżyć również gry, które już mają zapisany wynik Metacritic. Polecenie raportuje gry bez wyniku i błędy, ale nie usuwa wpisów użytkownika.

### Ukończone gry

- osobna historia dla każdego roku, z rokiem zachowanym w URL;
- wielokrotne ukończenia tej samej gry jako oddzielne wpisy;
- data ukończenia, czas, opcjonalna ocena, platforma, recenzja i własne statystyki; przy braku czasu lub oceny formularz ostrzega i pozwala świadomie zapisać wpis;
- filtry platformy, gatunku, oceny, daty ukończenia i czasu gry zapisane w URL, licznik wyników oraz niezależnie zwijane grupy miesięczne;
- kompaktowa nawigacja między latami dostępnymi w bazie;
- szczegóły, edycja i usuwanie pojedynczego ukończenia.

### Analiza

Analiza działa dla wybranego roku i ma sześć sekcji:

1. **Podsumowanie** — karty roczne, filtry, platformy, gatunki, rankingi i porównanie lat.
2. **Trendy** — miesięczna liczba ukończeń, czas gry oraz średnia ocena.
3. **Heatmapa** — aktywność w dniach roku z możliwością przejścia do źródłowych ukończeń.
4. **Porównanie miesięcy** — proste porównanie dwóch miesięcy tego samego roku.
5. **Prognozy** — deterministyczna prognoza miesięcznej liczby ukończeń albo czasu gry oraz, dla czasu, osobna prognoza skumulowanego wyniku rocznego.
6. **Raport roczny** — tekstowe podsumowanie, wykresy i widok przygotowany do wydruku.

Tryb **Cała historia** jest osobnym widokiem, a nie dodatkowym rokiem na liście. Agreguje wszystkie lata, pokazuje podsumowanie, rekordy, wykresy ukończeń, czasu i ocen według roku oraz porównanie platform i gatunków; z każdego roku można przejść do jego analizy.

Brak oceny nie jest liczony jako zero. API wypełnia miesiące bez ukończeń wartościami zerowymi tam, gdzie jest to potrzebne do pokazania pełnego trendu. Prognoza jest szacunkiem: interfejs pokazuje wymagania dotyczące danych, MAE, RMSE i model bazowy.

### Chatbot

- korzysta z dostawcy zgodnego z API OpenAI, np. zgodnego endpointu Gemini;
- otrzymuje ograniczony, tekstowy kontekst z lokalnych gier, ukończeń, listy „Do ogrania” i PoE;
- zapisuje sesje rozmów w bazie;
- ma endpoint statusu oraz kontrolowane komunikaty dla braku konfiguracji, timeoutu, limitu i awarii dostawcy;
- nie wykonuje SQL wygenerowanego przez model i nie zwraca kluczy API ani surowych odpowiedzi dostawcy.

## Path of Exile

Moduł PoE jest prywatnym rejestrem postaci i własnych statystyk, a nie pełnym planerem buildów.

Aktualnie działają:

- ręczne tworzenie, edycja i usuwanie lig PoE 1 i PoE 2 na podstawie nazwy, gry i daty startu; usunięcie ligi nie kasuje postaci ani dropów;
- zapis końcowego stanu postaci z ligi przez wklejenie kodu PoB skopiowanego z profilu poe.ninja;
- bezpieczny, lokalny odczyt wersji gry, klasy, ascendancy, poziomu i aktualnie założonych przedmiotów bez wysyłania kodu do zewnętrznej usługi;
- ręczne tworzenie starszych lub nietypowych wpisów bez kodu PoB;
- filtrowanie postaci po wersji gry i lidze, wyszukiwanie po nazwie oraz sortowanie;
- szczegóły, edycja i usuwanie postaci;
- responsywny widok końcowego wyposażenia z podglądem pełnych statystyk po najechaniu, ustawieniu fokusu klawiaturą lub dotknięciu przedmiotu;
- linki do profilu oraz źródłowego widoku poe.ninja;
- ręcznie wpisywane i edytowane statystyki dropów z Ring MTX, np. waluty, mapy, fragmenty, skarabeusze, karty i unikaty, wraz z kolejnością, ikoną i notatką;
- eksport i import danych PoE w kopii JSON;
- kompaktowe podsumowanie PoE na Dashboardzie.

poe.ninja nie udostępnia wspieranego publicznego API profili i buildów do integracji zewnętrznych. Aplikacja nie scrapuje strony ani nie korzysta z jej wewnętrznych endpointów. Na stronie postaci wybierz **Copy PoB code**, wklej kod w Games Tracker, sprawdź podgląd, a następnie uzupełnij nick oraz ligę. Nick jest wpisywany ręcznie, ponieważ format PoB nie gwarantuje jego obecności. Surowy kod PoB nie jest zapisywany w bazie.

Import obejmuje tylko aktywny zestaw wyposażenia: broń, pancerz, biżuterię, flaski oraz charmy, jeśli występują w danej wersji gry. Drzewko pasywów, atlas, gemy, przedmioty zapasowe, budżet i historia zmian builda są celowo pomijane. Projekt nie jest zamiennikiem Path of Building ani pełnym planerem buildu.

Kod PoB nie zawiera adresów ani stabilnych identyfikatorów grafik przedmiotów. Dlatego widok używa czytelnych ikon slotów i lokalnego tooltipu zamiast zgadywać grafiki lub wykonywać niewspierane zapytania do wewnętrznych endpointów poe.ninja.

### Integracja z ligami PoE

Ligi są tworzone ręcznie w aplikacji. Do dodania ligi potrzebne są jej nazwa, wybór Path of Exile 1 albo Path of Exile 2 oraz data startu używana do chronologii i analiz rocznych; projekt nie łączy się z oficjalnym API lig.

## Stos technologiczny

Wersje zadeklarowane w plikach projektu i rozstrzygnięte przez lockfile:

| Obszar | Technologie |
| --- | --- |
| Frontend | Next.js `16.2.10`, React/React DOM `19.2.7`, TypeScript `6.0.3`, Tailwind CSS `4.3.2` z konfiguracją CSS-first |
| UI i formularze | Lucide React 1, react-hook-form 7.81, Zod 4.4, komponenty lokalne inspirowane shadcn/ui |
| Dane i wykresy | Recharts 3.9, dnd-kit core 6 / sortable 10 |
| Backend | Python 3.14 w obrazie Docker, FastAPI `>=0.139.0`, SQLAlchemy `>=2.0.51`, Pydantic 2.13, Alembic, Uvicorn 0.51 |
| Baza i wdrożenie | PostgreSQL 16, Docker Compose, Caddy |
| Integracje | RAWG, oficjalne API lig Path of Exile, lokalny parser kodu Path of Building, OpenAI-compatible LLM API |
| Testy | pytest 9, Vitest 4.1, ESLint 9.39 i TypeScript 6.0 |

Zależności PoE nie tworzą osobnego stosu: formularz postaci korzysta z tego samego react-hook-form/Zod, a UI z tych samych komponentów i Tailwinda co reszta aplikacji.

## Struktura projektu

```text
frontend/
  app/                 # routing App Router
  components/          # UI, gry, Analiza, PoE, chatbot i layout
  lib/                 # funkcje widoków i formatowanie
  services/api.ts      # klient FastAPI, timeouty i obsługa błędów
  tests/
  types/
backend/
  app/
    api/               # routery FastAPI
    chatbot/
    core/              # konfiguracja
    database/
    integrations/      # RAWG, ligi PoE i parser kodu PoB
    models/
    schemas/
    services/
  alembic/
  tests/
scripts/               # start, backup i restore PostgreSQL
docker-compose.yml     # lokalny PostgreSQL
docker-compose.prod.yml
```

## Wymagania

- Python 3.11 lub nowszy; obraz Docker korzysta z Pythona 3.14;
- Node.js 24 LTS;
- Docker Desktop do lokalnego PostgreSQL i Compose;
- opcjonalnie `make`.

## Konfiguracja lokalna

Skopiuj wzór do rootowego `.env`:

```powershell
Copy-Item .env.example .env
```

Minimalna konfiguracja:

```env
DATABASE_URL=postgresql+psycopg://games:games@localhost:5433/games_app
FRONTEND_URL=http://localhost:3000
```

Opcjonalne integracje:

```env
RAWG_API_KEY=
OPENAI_API_KEY=
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
OPENAI_MODEL=gemini-3.5-flash
LLM_REQUEST_TIMEOUT_SECONDS=60
```

- `RAWG_API_KEY` włącza wyszukiwanie, uzupełnianie okładek i metadanych, premiery, rekomendacje oraz migawki ocen zewnętrznych.
- `OPENAI_API_KEY`, `OPENAI_BASE_URL` i `OPENAI_MODEL` włączają chatbota.
- `LLM_REQUEST_TIMEOUT_SECONDS` musi mieścić się w zakresie `(0, 120]`; frontend czeka 75 sekund, aby backend zdążył zwrócić kontrolowany timeout.

Backend czyta kolejno rootowe `.env.production`, rootowe `.env` i `backend/.env`. Skrypt startowy ustawia lokalny adres API frontendu automatycznie. Przy ręcznym uruchamianiu frontendu utwórz `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=/api
```

Po zmianie zmiennych zrestartuj odpowiedni proces lub kontener. Pliki z rzeczywistymi sekretami nie powinny trafiać do repozytorium.

## Uruchomienie

Najprostsza ścieżka na Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start_app.ps1
```

Skrypt sprawdza Python/Node/Docker, przygotowuje brakujące pliki środowiskowe, instaluje zależności, uruchamia PostgreSQL, wykonuje migracje i neutralny seed, a następnie uruchamia backend oraz frontend w jednym terminalu.

Backend, frontend oraz ich procesy potomne są przypisane do jednej grupy nadzorowanej przez `scripts/dev_supervisor.py`. `Ctrl+C` najpierw wysyła łagodny sygnał zakończenia i czeka 5 sekund, a potem wymusza zamknięcie wyłącznie procesów utworzonych przez ten skrypt. Na Windows grupa korzysta z Job Object, więc zamknięcie terminala również nie pozostawia procesów `uvicorn --reload` ani `next dev`. Skrypt sprawdza zwolnienie portów 8000 i 3000 oraz zwraca kod procesu, który zakończył się błędem.

Jeżeli PostgreSQL nie działał wcześniej, skrypt zatrzyma uruchomiony przez siebie kontener podczas wyjścia lub błędu startu. Baza działająca jeszcze przed uruchomieniem skryptu pozostaje bez zmian. Dane w wolumenie nie są usuwane.

Kolejne uruchomienie bez instalacji:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start_app.ps1 -SkipInstall
```

Zatrzymanie starych procesów tej aplikacji na portach 3000/8000 podczas startu:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start_app.ps1 -SkipInstall -StopExisting
```

Parametr `-StopExisting` sprawdza ścieżkę i linię poleceń procesu oraz jego rodziców. Jeżeli port zajmuje proces spoza bieżącego katalogu projektu, skrypt zgłosi błąd i nie będzie zabijał wszystkich procesów Node lub Python po samej nazwie.

W trybie `next dev` Next.js dodaje własny element `nextjs-portal` z panelem developerskim (`Route`, `Bundler`, `Turbopack`, `Preferences`) i nakładką błędów. Panel nie pochodzi z komponentów Games Tracker, jest izolowany w Shadow DOM i nie jest dołączany przez produkcyjne `next build` / `next start`.

### Uruchomienie ręczne

```powershell
docker compose up -d postgres
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m app.database.seed
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

W drugim terminalu:

```powershell
cd frontend
npm install
npm run dev
```

- Frontend: <http://localhost:3000>
- Backend: <http://localhost:8000>
- OpenAPI: <http://localhost:8000/docs>
- Health check: <http://localhost:8000/health>

## Migracje i dane

Migracje uruchamiaj z katalogu `backend`:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Rewizje tworzą pierwotny model, bezpiecznie rozdzielają backlog od powtarzalnych ukończeń i dodają indeksy używane przez deduplikację RAWG, kolejność backlogu, historię chatbota oraz listy lig/postaci/statystyk PoE. Kolejne migracje dodają bez zmiany istniejących wpisów zewnętrzne oceny gier i osobną tabelę opinii o rekomendacjach. Migracje PoE dodają niedestrukcyjnie źródło snapshotu i tabelę `poe_equipment_items`. Unikalność nazwy ligi obowiązuje w obrębie wersji gry; migracja zatrzyma się bez zmiany danych, jeśli wcześniej zapisano duplikaty wymagające ręcznego rozstrzygnięcia.

Seed nie dodaje przykładowych gier ani danych PoE:

```powershell
.\.venv\Scripts\python.exe -m app.database.seed
```

## Kopie danych

Karta **Kopia zapasowa** na Dashboardzie eksportuje jeden plik JSON (`format_version: 3`) zawierający gry, backlog, ukończenia, własne statystyki, ligi, snapshoty postaci, wyposażenie, statystyki PoE, historię rozmów oraz zapisane opinie o rekomendacjach. Import pozostaje zgodny ze starszymi formatami `1` i `2`; brakujące w nich pola są uzupełniane bez zmiany danych użytkownika. Sekrety, wartości `.env` i surowe kody PoB nie są eksportowane.

Import działa wyłącznie w trybie `replace`. Backend najpierw waliduje cały dokument i relacje, a następnie zastępuje dane w jednej transakcji. Nieprawidłowy plik lub błąd zapisu wycofuje operację. Nie ma trybu scalania.

Do pełnej kopii PostgreSQL służą:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup_database.ps1
powershell -ExecutionPolicy Bypass -File scripts/restore_database.ps1 -BackupPath backups/games-app-YYYYMMDD-HHMMSS.sql
```

Restore bazy zastępuje dane i powinien być wykonywany świadomie.

## Tryb produkcyjny i PWA

Projekt zawiera Dockerfile dla backendu i frontendu, PostgreSQL 16, Caddy, wzór `.env.production.example` oraz produkcyjny Compose:

```powershell
Copy-Item .env.production.example .env.production
docker run --rm caddy:2-alpine caddy hash-password --plaintext "ustaw-silne-haslo"
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Produkcyjny Compose działa celowo w trybie odłączonym (`-d`), dlatego `Ctrl+C` nie zatrzymuje kontenerów. Do kontrolowanego zakończenia tego wariantu służy `docker compose --env-file .env.production -f docker-compose.prod.yml down` albo `make prod-down`.

W `.env.production` ustaw co najmniej silne `POSTGRES_PASSWORD`, `APP_DOMAIN`, `PUBLIC_APP_URL`, `APP_BASIC_AUTH_USERNAME` i wynik powyższego polecenia jako `APP_BASIC_AUTH_PASSWORD_HASH`. Hash bcrypt zawiera znaki `$`, dlatego najbezpieczniej zapisać całą wartość w pojedynczym cudzysłowie, np. `APP_BASIC_AUTH_PASSWORD_HASH='$2a$...'`.

Caddy wymaga uwierzytelnienia dla interfejsu i `/api`; publiczny pozostaje wyłącznie `/health`, potrzebny do kontroli dostępności. To ochrona odpowiednia dla prywatnego, jednoosobowego wdrożenia, ale nie zastępuje autoryzacji rekordów w aplikacji wieloużytkownikowej.

Manifest, service worker i strona offline pozwalają zainstalować aplikację jako PWA. Service worker cache'uje shell i statyczne zasoby; `/api` pozostaje network-only, aby nie prezentować starych danych.

## Najważniejsze endpointy

### Gry i backlog

- `GET /api/games/search?query=Hades&page=1&page_size=10`
- `GET /api/games/recommendations`, `PUT/DELETE /api/games/recommendations/feedback`
- `GET /api/games/releases?date_from=2026-08-01&date_to=2026-08-31`, `GET /api/games/rawg/{external_id}`
- `GET/POST /api/games`, `GET/PATCH/DELETE /api/games/{id}`
- `GET/POST /api/backlog`, `GET/PATCH/DELETE /api/backlog/{id}`
- `POST /api/backlog/batch`, `POST /api/backlog/reorder`

### Ukończenia i Analiza

- `GET /api/completed-games/years`
- `GET /api/completed-games/history`
- `GET/POST /api/completed-games`, `GET/PATCH/DELETE /api/completed-games/{id}`
- `GET /api/completed-games/year/{year}/dashboard`
- `GET /api/completed-games/year/{year}/activity`
- `GET /api/completed-games/year/{year}/report`
- `GET /api/completed-games/comparison?years=2025,2026`
- `GET /api/completed-games/month-comparison`
- `GET /api/completed-games/forecast`
- `GET/POST /api/completed-games/{id}/statistics`
- `GET/PATCH/DELETE /api/completed-games/statistics/{id}`

### PoE, kopie, Dashboard i chatbot

- `GET/POST /api/poe/leagues`, `PATCH/DELETE /api/poe/leagues/{id}`
- `GET/POST /api/poe/characters`, `GET/PATCH/DELETE /api/poe/characters/{id}`
- `POST /api/poe/pob/preview`, `POST /api/poe/characters/import-pob`
- `GET /api/poe/characters/{id}/equipment`
- `GET/POST /api/poe/characters/{id}/stats`, `POST /api/poe/characters/{id}/stats/reorder`
- `PATCH/DELETE /api/poe/stats/{id}`
- `GET /api/dashboard/summary`
- `GET /api/backup/export`, `POST /api/backup/import`
- `POST /api/chat`, `GET /api/chat/status`, `GET /api/chat/sessions`, `GET/DELETE /api/chat/sessions/{id}`

Pełny, aktualny kontrakt jest dostępny w OpenAPI pod `/docs`.

## Testy i kontrola jakości

Backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```

Frontend:

```powershell
cd frontend
npm test
npm run lint
npm run typecheck
npm run build
```

Projekt nie ma obecnie osobno skonfigurowanego lintera ani statycznego type checkera dla Pythona; nie należy przedstawiać takiej kontroli jako istniejącej komendy.

Audyt podatności produkcyjnych zależności npm:

```powershell
cd frontend
npm audit --omit=dev
```

## Rozwiązywanie problemów

### PostgreSQL lub `DATABASE_UNAVAILABLE`

Lokalny Compose wystawia bazę na porcie `5433`. Sprawdź, czy `DATABASE_URL` odpowiada portowi, użytkownikowi i hasłu istniejącego wolumenu. Odtworzenie kontenera bez kasowania danych:

```powershell
docker compose up -d --force-recreate postgres
```

Nie usuwaj wolumenu, jeśli zawiera dane użytkownika.

### RAWG nie wyszukuje albo nie pobiera okładki

Uzupełnij `RAWG_API_KEY` i zrestartuj backend. Brak konfiguracji zwraca 503, a awaria dostawcy 502; aplikacja nie podstawia fikcyjnych wyników.

### Kod PoB z poe.ninja nie daje się odczytać

- skopiuj pełną wartość z przycisku **Copy PoB code** na profilu postaci, bez adresu strony ani dodatkowego tekstu;
- obsługiwany jest skompresowany kod PoB oraz surowy XML PoB 1/2;
- snapshot musi zawierać sekcję postaci i co najmniej jeden założony przedmiot;
- limit wejścia wynosi 2 MB, a rozpakowanego XML 3 MB;
- nick oraz liga pozostają polami ręcznymi, bo nie są niezawodną częścią formatu PoB;
- aplikacja nie pobiera profilu poe.ninja i nie zależy od jego wewnętrznego API.

### Chatbot jest niedostępny lub zwraca timeout

Sprawdź `GET /api/chat/status`, klucz, base URL i nazwę modelu. Backend rozróżnia brak konfiguracji, błąd autoryzacji, timeout, rate limit, niedostępność dostawcy, błąd sieci i nieprawidłową odpowiedź. W logu odszukaj `error_id`; interfejs celowo nie pokazuje surowej odpowiedzi dostawcy.

### Frontend nie łączy się z API

Sprawdź `NEXT_PUBLIC_API_URL` oraz `FRONTEND_URL`. Lokalnie frontend używa `/api` przez proxy developerskie Next.js, a w produkcyjnym Compose ten sam adres obsługuje Caddy.

## Bezpieczeństwo i prywatność

- sekrety są czytane ze środowiska i nie trafiają do eksportu JSON;
- backend nie zwraca stack trace ani surowych odpowiedzi integracji;
- URL-e profilu muszą używać HTTP/HTTPS, a link źródłowy poe.ninja wyłącznie właściwej domeny;
- parser PoB ogranicza rozmiar danych, odrzuca deklaracje DTD/ENTITY i nie przechowuje surowego kodu;
- CORS ogranicza frontend do skonfigurowanego originu i lokalnych adresów developerskich;
- produkcyjny reverse proxy chroni aplikację podstawowym uwierzytelnianiem; lokalne uruchomienie developerskie pozostaje bez logowania.
