# Plan: Alben-Zuordnung per Hotkey (0–9) + Chronologischer Modus

## Ziel
- Nutzer können das aktuelle Asset per Hotkey `0–9` direkt einem Album hinzufügen; das zählt als **Keep** (Asset bleibt erhalten) und lädt danach das nächste Asset.
- Mobile/Touch: Ein **Album-Button** erlaubt „Add to Album“; zusätzlich soll ein **Drag-to-Album-Button** Flow möglich sein, der beim Drop ein Album-Auswahlmenü öffnet.
- Desktop: gleicher Album-Button/Drag-Flow + konfigurierbare Hotkeys für „One-Key Add“.
- Alle neuen Einstellungen werden in `localStorage` persistiert.
- Zusätzlich kann zwischen **Random** und **Chronologisch** (Timeline) umgeschaltet werden.

## User Stories
1. Als Desktop-Nutzer drücke ich `1`, um das aktuelle Bild sofort Album „Familie“ hinzuzufügen (und automatisch weiterzuswipen).
2. Als Desktop-Nutzer kann ich Hotkeys `0–9` auf beliebige Alben mappen und diese Zuordnung später ändern.
3. Als Mobile-Nutzer kann ich über einen Album-Button ein Album auswählen, um das aktuelle Bild dorthin zu legen (und weiterzumachen).
4. Als Mobile-Nutzer kann ich das aktuelle Bild „auf den Album-Button ziehen“, um die Album-Auswahl zu öffnen, ohne auf kleine UI-Elemente tippen zu müssen.
5. Als Nutzer kann ich zwischen Random-Review und chronologischer Reihenfolge wechseln; die Auswahl bleibt nach Reload erhalten.

## UX / Interaktion (Vorschlag)
- **Album-Button** in der bestehenden Action-Button-Zeile (neben Undo; auf Mobile sichtbar).
  - Tap/Click öffnet „Album Picker“ (Modal/Bottom Sheet).
  - Im Picker: Liste der Alben (Name + optional Count/Preview), optional Suchfeld.
  - Tap auf Album führt `addToAlbum(albumId)` aus → Toast „Added to <Album>“ → weiter zum nächsten Asset.
- **Hotkeys**:
  - `0–9`: Wenn ein Album gemappt ist → `addToAlbum(mappedAlbumId)`.
  - Wenn kein Mapping existiert → Toast „No album configured for key X“.
  - Hotkeys sind deaktiviert, wenn ein Input/Modal fokusiert ist (damit Login/Search nicht kaputt geht).
- **Drag-to-Album-Button**:
  - Desktop: HTML5 Drag&Drop vom Card-Container auf den Album-Button (Drop öffnet Picker oder fügt direkt in „last used album“ ein, je nach UX-Entscheid).
  - Mobile: Touch-/Pointer-basierter „Drag Mode“ (z.B. Long-Press auf Card → Drag-Preview → Release über Album-Button öffnet Picker).
  - Visuelles Feedback: Album-Button highlightet, wenn „Drop möglich“.

## Datenmodell & Persistence (`localStorage`)
### Zu persistierende Werte
- `reviewOrder`: `'random' | 'chronological'` (ggf. zusätzlich Richtung `asc/desc`, falls gewünscht).
- `albumHotkeys`: Mapping `{ "0": "<albumId>", ..., "9": "<albumId>" }`.
- `lastUsedAlbumId`: `<albumId> | null` (für UX-Abkürzungen, optional).
- Optional: `pinnedAlbumIds: string[]` (für „Top Alben“ im Picker, optional).

### Scoping (mehrere User / Server)
- Preferiert: Storage-Keys **pro Account** namespacen (z.B. via `serverUrl + userId` oder `serverUrl + hash(apiKey)`), damit Hotkeys nicht zwischen Accounts kollidieren.
- Umsetzungsidee:
  - Ein Helper `getPreferencesStorageKey()` (z.B. `immich-swipe-preferences:<server>:<user>`).
  - `userId` kann einmalig über `/users/me` geladen und im Auth-Store gehalten werden (oder `apiKey` gehasht werden, wenn kein User-Profil gespeichert werden soll).

## Immich API: benötigte Endpoints (zu verifizieren)
### Alben
- Alben listen (z.B. `GET /albums`).
- Asset zu Album hinzufügen (z.B. `PUT|POST /albums/:id/assets` mit Body `{ ids: [assetId] }`).
- Optional: Alben inkl. Shared/Archived filtern (Entscheidung im Picker).

### Chronologische Reihenfolge
- Ziel: Assets in stabiler Reihenfolge (z.B. nach `localDateTime`/`fileCreatedAt`) paginiert abrufen.
- Kandidaten (zu verifizieren):
  - `POST /search/metadata` mit `take/skip/sortBy/order` oder
  - `GET /assets` mit Sort-/Paging-Parametern oder
  - Timeline-/Bucket-API (wenn verfügbar).
- Für Performance: statt „1 Asset pro Request“ besser eine **Queue/Buffer** (z.B. page-size 50) nachladen, `skipVideos` lokal filtern und bei Bedarf weiter paginieren.

## Umsetzungsschritte
1. API-Verifikation (lokal gegen Immich)
   - Swagger/Docs/Network-Inspect nutzen, um Album- und Search/Timeline-Endpunkte sicher zu bestätigen.
   - Response-Shapes dokumentieren → TypeScript-Typen ergänzen.

2. Types erweitern (`src/types/immich.ts`)
   - `ImmichAlbum` (id, albumName, assetCount/… je nach API).
   - `SearchRequest/SearchResponse` (für Chrono-Modus), falls nötig.

3. Persistente Preferences-Store hinzufügen
   - Neuer Pinia-Store (z.B. `src/stores/preferences.ts`) mit:
     - `reviewOrder`, `albumHotkeys`, `lastUsedAlbumId` (+ optional pinned).
     - Initialisierung aus `localStorage` + `watch()` Persistenz (analog `ui.ts`).
     - Account-Scoped Storage-Key (siehe oben).

4. Immich-Composable erweitern (`src/composables/useImmich.ts`)
   - Album-API:
     - `fetchAlbums()` (caching, error handling, loading state optional).
     - `addAssetToAlbum(albumId, assetId)` (nutzt `apiRequest()`).
   - Review-Order:
     - Refactor `fetchRandomAsset()` → `fetchNextAsset()` abhängig von `preferences.reviewOrder`.
     - Chrono-Implementierung mit Queue/Buffer + Cursor (skipVideos berücksichtigt).
   - „Add-to-Album zählt als Keep“:
     - Neue Aktion `keepToAlbum(albumId)` = `addAssetToAlbum` + `incrementKept` + `moveToNextAsset`.

5. UI integrieren
   - `ActionButtons.vue`: Album-Button hinzufügen (Icon + Tooltip).
   - `HomeView.vue`:
     - Album Picker Modal/BottomSheet einhängen (Asset-Kontext: aktuelle Asset-ID).
     - Keyboard-Handler um `0–9` erweitern (mit Guard: keine Inputs/Modals).
     - Umschalter „Random/Chronologisch“ (z.B. in `AppHeader.vue` neben Skip-Videos, oder im Picker/Settings).
   - Optional: `src/components/AlbumPicker.vue` + `src/components/HotkeyConfig.vue` (klar getrennt halten).

6. Drag-to-Album-Button
   - Desktop: Drag-Start am Card-Container + Drop-Target am Album-Button (Highlight + Drop-Handler).
   - Mobile: Pointer/Touch Long-Press → Drag-Preview + Hit-Test auf Album-Button-Bounds → Picker öffnen.
   - Konflikte mit `useSwipe` minimieren (z.B. Drag nur nach Long-Press, Swipe bleibt horizontal).

7. Fehlerfälle & UX
   - Add-to-Album Fehler: Toast + optional „Retry“ (min. „nicht weitergehen“, bis der Nutzer bestätigt, oder optimistisch weitergehen und Fehler anzeigen — Entscheidung treffen).
   - Offline/401: wie bestehendes Error-Handling in `useImmich.ts`.

## Tests (mit einplanen)
> Aktuell gibt es kein Test-Setup. Für dieses Feature lohnt sich mindestens Unit/Component-Testing mit Vitest.

1. Test-Infrastruktur
   - DevDeps: `vitest`, `@vue/test-utils`, `jsdom` (oder `happy-dom`), ggf. `@testing-library/vue`.
   - `package.json` Scripts: `test`, `test:watch` (und optional `test:ui`).
   - Basis-Setup für Pinia in Tests (createPinia/setActivePinia).

2. Unit-Tests
   - `preferences`-Store:
     - Default-Werte ohne `localStorage`.
     - Persistenz (write-through) + Rehydrate.
     - Account-Scoping-Key erzeugt unterschiedliche Namespaces.
   - `useImmich`:
     - `addAssetToAlbum()` ruft `fetch` mit korrektem Endpoint/Body auf (fetch mock).
     - Chrono-Queue lädt Seite nach, respektiert `skipVideos`, liefert deterministische Reihenfolge.

3. Component-Tests
   - `HomeView` Keyboard:
     - `keydown '1'` triggert Add-to-Album, wenn Mapping vorhanden.
     - Kein Trigger, wenn Fokus in Input/Modal.
   - Album Picker:
     - Klick auf Album führt Keep+Add aus und schließt Modal.

## Akzeptanzkriterien
- `0–9` Hotkeys fügen das aktuelle Asset dem konfigurierten Album hinzu und laden danach das nächste Asset (zählt als Keep).
- Album-Picker per Button funktioniert auf Mobile/Desktop; Auswahl fügt hinzu und swipt weiter.
- Drag-to-Album-Button funktioniert mindestens auf Desktop; Mobile-Drag ist implementiert oder klar als optionaler Schritt gekennzeichnet.
- Review-Order Toggle (Random/Chronologisch) wirkt sofort und bleibt nach Reload erhalten.
- Alle neuen Settings sind robust in `localStorage` persistiert (keine TypeScript-Warnings, strict TS bleibt grün).
- Tests decken Store-Persistenz + mindestens den Hotkey-Flow und Add-to-Album API-Call ab.

## Betroffene Dateien (voraussichtlich)
- `src/composables/useImmich.ts` (Album-API + Review-Order)
- `src/stores/preferences.ts` (neu, Persistenz)
- `src/stores/ui.ts` (ggf. minimal: UX-Flags/Toasts; oder unverändert)
- `src/views/HomeView.vue` (Hotkeys, Picker, Order-Toggle)
- `src/components/ActionButtons.vue` (Album-Button)
- `src/components/AppHeader.vue` (Order-Toggle optional)
- `src/types/immich.ts` (Album/Search Types)
- `package.json` + Test-Setup-Dateien (Vitest)

