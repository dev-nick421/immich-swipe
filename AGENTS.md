# Immich Swipe (Repo-Notizen für Agenten)

## Kurzüberblick
- Single-Page-App (Vue 3 + TypeScript + Tailwind) zum Durchsehen von Immich-Fotos: rechts = behalten, links = (in den Papierkorb) löschen.
- Kein eigener Backend-Service: Browser spricht Immich API direkt an (oder über den eingebauten Proxy des Docker-Images, siehe unten).
- State-Management über Pinia (`src/stores/*`), Routing über `vue-router` (`src/router/index.ts`).

## Quickstart (lokal)
- Voraussetzungen: Node.js 20.19+ oder 22.12+ (Vite 7; Docker-Build nutzt `node:22-alpine`, CI Node 20), npm.
- Install: `npm install`
- Dev-Server: `npm run dev` (Vite, Port `5173`, `host: true`)
- Build: `npm run build`
- Preview: `npm run preview`
- Typecheck: `npm run type-check`
- Tests: `npm test` (Vitest + jsdom, `tests/`)
- Docker-Smoke-Test: `docker/smoke-test.sh <image>`

## Konfiguration (.env / Login-Flow)
- `.env` Variablen (siehe `env.example` / `README.md`):
  - `VITE_SERVER_URL` (Basis-URL für die API; Details siehe „API/Proxy/CORS“)
  - `VITE_USER_<N>_NAME`, `VITE_USER_<N>_API_KEY` (alle Slots mit API-Key, aufsteigend sortiert, Lücken erlaubt; fehlender Name → `User <N>`; Werte werden getrimmt)
  - `IMMICH_URL` ist **keine** Vite-Variable, sondern Runtime-Env des Containers (eingebauter Proxy, siehe unten)
  - Hinweis: `src/vite-env.d.ts`, `Dockerfile` und `docker-compose.yml` sind aktuell bis `N=5` verdrahtet; für mehr User diese Stellen erweitern.
- Verhalten:
  - 1 User in `.env`: Auto-Login (keine Login-Seite)
  - >1 User in `.env`: User-Auswahl (`/select-user`)
  - keine `.env`: manuelles Login (`/login`), Config wird in `localStorage` gespeichert
- Gespeicherter Login (`src/stores/auth.ts`): Mit `.env`-Usern gilt ein gespeicherter Login nur, wenn Server-URL und API-Key noch zu einem `.env`-User passen (sonst verworfen → Auswahl/Auto-Login). Ohne `.env`-User werden Logins aus einem früheren `.env`-Build verworfen. Der User-Name wird beim Reload wiederhergestellt (#8).
- Wichtige lokale Storage Keys:
  - Auth: `immich-swipe-config` (Server-URL, API Key, `userName`, `source: 'env' | 'manual'`)
  - UI: `immich-swipe-theme`, `immich-swipe-skip-videos`
  - Stats: `immich-swipe-stats:<server>:<user>` (keep/delete Counter)
  - Review-Cache: `immich-swipe-reviewed:<server>:<user>` (bereits gesehene IDs + keep/delete)
- Security-Hinweis: `VITE_*` Variablen sind Build-Time und landen im Frontend-Bundle → `VITE_USER_*_API_KEY` nur für private Deployments/Images nutzen (nicht öffentlich publishen).

## API/Proxy/CORS (wichtigster Stolperstein)
- Immich sendet CORS-Header nur in Dev-Builds (`enableCors()` nur bei `isDev`). Ein Browser auf einer anderen Origin wird ohne Zusatz-Setup blockiert („Failed to fetch“/„NetworkError“).
- Zentrale Request-Helfer:
  - `src/composables/useImmich.ts` → `apiRequest()` baut URLs als `authStore.apiBaseUrl + endpoint`
  - `apiBaseUrl` (`src/stores/auth.ts`): mit eingebautem Proxy `<app-origin><BASE_URL>api`, sonst `immichBaseUrl + '/api'`
  - `immichBaseUrl` normalisiert `serverUrl` (entfernt ggf. `/api` am Ende) und wird immer für „Open in Immich“ genutzt
- Eingebauter Proxy (Docker):
  - Container-Env `IMMICH_URL` (z.B. `http://immich-server:2283`) → `docker/40-immich-swipe.sh` (läuft via `/docker-entrypoint.d/` vor nginx) schreibt `/etc/nginx/immich-swipe/runtime.conf`: `location ^~ /api/` → `IMMICH_URL`, Auflösung per `resolver` zur Request-Zeit, kein Buffering.
  - `nginx.conf` liefert `/config.js` (`window.__IMMICH_SWIPE__ = { proxy: true|false }`, no-store). `public/config.js` ist der statische Default (proxy: false) für Dev/Preview/GitHub Pages. `index.html` lädt `config.js` vor der App.
  - Ohne `IMMICH_URL`: direkter Zugriff wie bisher (CORS nötig), `/api/` auf der App antwortet mit JSON-Hinweis (404).
  - Ungültige `IMMICH_URL` → Container bricht beim Start mit Fehlermeldung ab.
- Fehlermeldungen: `apiRequest()` übersetzt Netzwerkfehler (CORS/nicht erreichbar/Mixed Content), Nicht-JSON-Antworten und Immich-Fehler (v2 `message[]`, v3 `errors[]`) in verständliche Texte; LoginView zeigt sie nach „Failed to connect:“ an.

## Immich API (Erkenntnisse / relevante Endpoints)
- Alle Requests laufen in dieser App effektiv gegen `.../api/...` (wegen `proxyBaseUrl = '/api'`) und nutzen den Header `x-api-key`.
- Connection-Check: `GET /users/me`
- Unterstützt: Immich v1.116+ inkl. v2.x und v3.x
- Random Asset: `POST /search/random` mit Body `{ size, visibility: 'timeline', type?: 'IMAGE' }` (`GET /assets/random` existiert in v3 nicht mehr)
- Chronologisch: `POST /search/metadata` mit Body `{ order, page, size, visibility: 'timeline' }`; Paging über `assets.nextPage` (`take`/`skip`/`assetType` sind keine gültigen Felder)
- `visibility: 'timeline'` immer explizit senden: v3 liefert sonst auch `hidden` Assets (z.B. Video-Teil von Live Photos)
- v3 validiert mit Zod (unbekannte Felder werden ignoriert, Fehler als `{ message: 'Validation failed', errors: [...] }`)
- Albums:
  - `GET /albums` (v2: nur eigene, daher zusätzlich `?shared=true`; v3: eigene + geteilte, `shared` wird ignoriert)
  - Asset in Album: `PUT /albums/<albumId>/assets` mit Body `{ "ids": ["<assetId>"] }`
- Papierkorb:
  - Löschen (Trash): `DELETE /assets` mit Body `{ "ids": ["<assetId>"], "force": false }`
  - Restore: `POST /trash/restore/assets` mit Body `{ "ids": ["<assetId>"] }`
- Favoriten:
  - Toggle/Set: `PUT /assets/<assetId>` mit Body `{ "isFavorite": true|false }` (Antwort wird in der App nicht benötigt; `currentAsset.isFavorite` wird lokal aktualisiert)
  - Optional (Bulk): `PUT /assets` mit Body `{ "ids": ["..."], "isFavorite": true|false }`
- Asset Media:
  - Thumbnail: `GET /assets/<assetId>/thumbnail?size=preview|thumbnail`
  - Original: `GET /assets/<assetId>/original`
- API-Key-Berechtigungen: `user.read`, `asset.read`, `asset.view`, `asset.download`, `asset.delete`, `asset.update`, `album.read`, `albumAsset.create`

## Docker/Deployment
- `docker-compose.yml` baut das Image, veröffentlicht Port `2293:80` und reicht `IMMICH_URL` als Runtime-Env durch.
- Die `VITE_*` Werte der `.env` werden als **Build-Args** in den Build gebacken (siehe `Dockerfile` + `docker-compose.yml`).
  - Änderung der `VITE_*` Werte erfordert Rebuild (`docker compose up -d --build`); `IMMICH_URL` nur Recreate.
- Runtime-Server ist Nginx (`nginx:alpine`) und serviert `dist/` + `nginx.conf` + `docker/40-immich-swipe.sh` (Entrypoint-Hook).
- `.gitattributes` erzwingt LF für `*.sh`/`*.conf` (CRLF würde den Entrypoint-Hook brechen).
- CI/CD:
  - `.github/workflows/ci.yml` (PRs + `main`): Type-Check, Tests, Build, Docker-Build + `docker/smoke-test.sh`.
  - `.github/workflows/publish-ghcr.yml` baut, smoke-testet & pushed ein generisches Image nach GHCR (`ghcr.io/<owner>/<repo>`) bei Push auf `main` und Tags `v*` (keine Build-Args/Keys im Workflow → Konfiguration per `IMMICH_URL` + manuellem Login, Auto-Login nur via Custom Build).

## Code-Map (wichtigste Stellen)
- Routing/Auth:
  - `src/router/index.ts` (Guard: Redirects je nach Login/.env-Konfig)
  - `src/stores/auth.ts` (env-Parsing, `localStorage`, URL-Normalisierung)
- Immich-Integration:
  - `src/composables/useImmich.ts` (Random Asset inkl. Skip-Videos Filter, chronologisches Paging mit geteiltem In-Flight-Request, Delete/Restore, Undo zeigt gelöschtes Asset wieder, Preload, Fehlermeldungen)
  - `src/types/immich.ts` (API-Typen)
- Docker/Runtime:
  - `nginx.conf`, `docker/40-immich-swipe.sh`, `docker/smoke-test.sh`, `public/config.js`
- UI/Interaktion:
  - `src/views/HomeView.vue` (Hauptscreen, Keyboard: ←/→ Keep/Delete, ↑ oder Ctrl/⌘+Z = Undo)
  - `src/components/SwipeCard.vue` (lädt Thumbnail/Video-Original als Blob mit Headern; Videos als `<video autoplay loop controls>`; Overlay-Button öffnet Asset-Detail in Immich `/photos/<id>`)
  - `src/components/ActionButtons.vue` (Undo-Button; Keep/Delete Buttons nur Desktop)
  - `src/composables/useSwipe.ts` (Touch+Mouse Swipe-Erkennung)
  - `src/stores/ui.ts` + `src/components/LoadingOverlay.vue` + `src/components/ToastNotification.vue`
  - `src/style.css` (`overflow: hidden`, `viewport-fit` via `100dvh`, Safe-Area Utilities)

## Konventionen für Änderungen
- TypeScript ist `strict` + `noUnusedLocals/noUnusedParameters` aktiv (`tsconfig.json`): saubere Imports/Variablen, sonst Build bricht.
- Beim Hinzufügen neuer `VITE_*` Variablen: `src/vite-env.d.ts`, `env.example` und ggf. `README.md` synchron halten.
- Neue Immich-Calls bevorzugt in `src/composables/useImmich.ts` ergänzen und intern `apiRequest()` nutzen (Fehlerhandling/Headers konsistent halten).
