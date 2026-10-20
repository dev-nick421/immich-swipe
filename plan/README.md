# Plan & Stand

Was umgesetzt ist und was noch offen ist. Größere Vorhaben vor der Umsetzung als eigene Datei
(`NNN-thema.md`) planen und danach hier zusammenfassen, statt die Planungsdatei liegen zu lassen.

## Umgesetzt

| Bereich | Stand | Wo |
|---|---|---|
| Review-Flow | Random (`POST /search/random`) und chronologisch (`POST /search/metadata`, Paging über `nextPage`), Skip Videos, Album-Filter (alle / ohne Album / ein Album) | `src/composables/useImmich.ts` |
| Entscheidungen | Keep, Delete (Papierkorb), Favorit, Add-to-Album inkl. Hotkeys 0–9, Undo (zeigt das Asset wieder) | `useImmich.ts`, `src/views/HomeView.vue` |
| Alben eines Fotos | Anzeige auf der Karte und im Album-Picker, Rückfrage vor dem Löschen | `useImmich.ts`, `SwipeCard.vue`, `AlbumPicker.vue` |
| Reviewed-Cache & Statistik | pro Server/User in `localStorage` | `src/stores/reviewed.ts`, `src/stores/ui.ts` |
| Login | `.env`-User (Auto-Login / Auswahl) oder manuell; veraltete gespeicherte Logins werden verworfen | `src/stores/auth.ts`, `src/router/index.ts` |
| Immich-Kompatibilität | v1.116+, v2, v3 | `useImmich.ts` |
| Docker | Multi-Stage-Build, eingebauter API-Proxy (`VITE_SERVER_URL` / `IMMICH_URL`), GHCR-Image für amd64 und arm64 | `Dockerfile`, `nginx.conf`, `docker/` |
| UI | Design-Tokens, Dark Mode per App-Schalter, Bottom-Sheets, Einstellungen, einmaliges Tutorial | `src/style.css`, `src/components/` |
| PWA | Manifest, Icons, Safe Areas | `index.html`, `public/` |
| Qualität | Vitest, CI mit Type-Check, Tests, Build und Docker-Smoke-Test | `tests/`, `.github/workflows/` |

## Offen

- **Service Worker (#3):** bewusst nicht umgesetzt. Die App braucht ohnehin Immich, und veraltete Caches nach Updates sind das typische PWA-Problem. Nur angehen, wenn ein Offline-Start gewünscht ist.
- **Filter „in irgendeinem Album“ (#20):** mit den flachen Suchfeldern nicht möglich (`albumIds` liefert die Schnittmenge). Ginge mit dem strukturierten `filter` ab Immich v3.2, dann aber ohne v2-Support.
- **Drag-to-Album:** `ActionButtons.vue` hat ein Drop-Ziel (`albumDrop`), aber nichts ist ziehbar (`SwipeCard` setzt `draggable="false"`). Fertigbauen oder entfernen.
- **Fokus in Sheets:** keine Fokus-Falle und kein Zurücksetzen des Fokus nach dem Schließen (Tastatur/Screenreader).
