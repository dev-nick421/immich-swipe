# Immich Swipe (Repo-Notizen für Agenten)

## Kurzüberblick
- Single-Page-App (Vue 3 + TypeScript + Tailwind) zum Durchsehen von Immich-Fotos: rechts = behalten, links = (in den Papierkorb) löschen.
- Kein eigener Backend-Service: Browser spricht Immich API direkt an (oder über einen Reverse-Proxy, siehe unten).
- State-Management über Pinia (`src/stores/*`), Routing über `vue-router` (`src/router/index.ts`).

## Quickstart (lokal)
- Voraussetzungen: Node.js (Docker nutzt `node:20-alpine`), npm.
- Install: `npm install`
- Dev-Server: `npm run dev` (Vite, Port `5173`, `host: true`)
- Build: `npm run build`
- Preview: `npm run preview`
- Typecheck: `npm run type-check`

## Konfiguration (.env / Login-Flow)
- `.env` Variablen (siehe `env.example` / `README.md`):
  - `VITE_SERVER_URL` (Basis-URL für die API; Details siehe „API/Proxy/CORS“)
  - `VITE_USER_<N>_NAME`, `VITE_USER_<N>_API_KEY` (Parser läuft hochzählig ab 1 bis Name/Key fehlen)
  - Hinweis: `src/vite-env.d.ts`, `Dockerfile` und `docker-compose.yml` sind aktuell bis `N=5` verdrahtet; für mehr User diese Stellen erweitern.
- Verhalten:
  - 1 User in `.env`: Auto-Login (keine Login-Seite)
  - >1 User in `.env`: User-Auswahl (`/select-user`)
  - keine `.env`: manuelles Login (`/login`), Config wird in `localStorage` gespeichert
- Wichtige lokale Storage Keys:
  - Auth: `immich-swipe-config` (Server-URL + API Key)
  - UI: `immich-swipe-theme`, `immich-swipe-skip-videos`
- Security-Hinweis: `VITE_*` Variablen sind Build-Time und landen im Frontend-Bundle → `VITE_USER_*_API_KEY` nur für private Deployments/Images nutzen (nicht öffentlich publishen).

## API/Proxy/CORS (wichtigster Stolperstein)
- Zentrale Request-Helfer:
  - `src/composables/useImmich.ts` → `apiRequest()` baut URLs als:
    - `url = authStore.immichBaseUrl + authStore.proxyBaseUrl + endpoint`
    - `proxyBaseUrl` ist aktuell fest `'/api'` (`src/stores/auth.ts`)
    - `immichBaseUrl` normalisiert `serverUrl` (entfernt ggf. `/api` am Ende)
- Praktische Konsequenz:
  - Wenn `VITE_SERVER_URL` auf die Immich-Instanz zeigt (z.B. `https://immich.example.com`), gehen Requests an `https://immich.example.com/api/...` → dafür muss Immich CORS erlauben (README enthält Snippets).
  - Es gibt zusätzlich eine Nginx-Config (`nginx.conf`) mit Proxy-Location `/immich-api/` inkl. CORS-Headern. Damit das zur aktuellen Client-URL-Bildung passt, muss `VITE_SERVER_URL` i.d.R. auf `<app-origin>/immich-api` zeigen, damit der Client `/immich-api/api/...` aufruft.
- Security-Hinweis (Proxy): `nginx.conf` erlaubt per `X-Target-Host` ein dynamisches `proxy_pass`-Ziel. Das ist funktional, kann aber als „Open Proxy/SSRF“ missbraucht werden, wenn der Reverse-Proxy öffentlich erreichbar ist.

## Immich API (Erkenntnisse / relevante Endpoints)
- Alle Requests laufen in dieser App effektiv gegen `.../api/...` (wegen `proxyBaseUrl = '/api'`) und nutzen den Header `x-api-key`.
- Connection-Check: `GET /users/me`
- Random Asset: `GET /assets/random?count=<n>`
- Chronologisch: `POST /search/metadata` (Body u.a. `take`, `size`, `skip`, `order`, `assetType`)
- Albums:
  - `GET /albums`
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

## Docker/Deployment
- `docker-compose.yml` baut das Image und veröffentlicht Port `2293:80`.
- Die `.env` Werte werden als **Build-Args** in den Build gebacken (siehe `Dockerfile` + `docker-compose.yml`).
  - Änderung der `.env` in Production erfordert Rebuild/Recreate des Containers.
- Runtime-Server ist Nginx (`nginx:alpine`) und serviert `dist/` + `nginx.conf`.
- CI/CD: `.github/workflows/publish-ghcr.yml` baut & pushed ein generisches Image nach GHCR (`ghcr.io/<owner>/<repo>`) bei Push auf `main` und Tags `v*` (keine Build-Args/Keys im Workflow → Konfiguration erfolgt dann per manuellem Login/`localStorage`, Auto-Login nur via Custom Build).

## Code-Map (wichtigste Stellen)
- Routing/Auth:
  - `src/router/index.ts` (Guard: Redirects je nach Login/.env-Konfig)
  - `src/stores/auth.ts` (env-Parsing, `localStorage`, URL-Normalisierung)
- Immich-Integration:
  - `src/composables/useImmich.ts` (Random Asset inkl. Skip-Videos Filter, Delete/Restore, Undo zeigt gelöschtes Asset wieder, Preload)
  - `src/types/immich.ts` (API-Typen)
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
