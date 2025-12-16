# Plan: Undo/Redo zeigt letztes Asset wieder

## Ziel
- Beim Klick auf **Undo / Wiederherstellen** (oder `Ctrl+Z`) soll das zuletzt gelöschte Foto/Video nicht nur in Immich wiederhergestellt werden, sondern **auch wieder als aktuelles Asset angezeigt** werden, damit man erneut entscheiden kann (Keep/Delete).

## Verhalten (Soll)
1. User löscht Asset **A** → App zeigt anschließend Asset **B**.
2. User drückt **Undo/Wiederherstellen** → Asset **A** wird restored und **sofort wieder angezeigt**.
3. Nach der erneuten Entscheidung über **A** soll die App sinnvoll weitergehen (idealerweise zurück zu **B**).

## Umsetzung (Tech)
- `src/composables/useImmich.ts`
  - `lastDeletedAsset` bleibt Quelle für den Undo.
  - Beim Undo wird das aktuell angezeigte Asset als „Resume“-Kandidat zwischengespeichert und als `nextAsset` eingeplant.
  - Nach erfolgreichem Restore: `currentAsset = restoredAsset`, `nextAsset = resumeAsset` (falls vorhanden).

## Akzeptanzkriterien
- Undo stellt das zuletzt gelöschte Asset wieder her **und** zeigt es erneut an.
- Danach kann das Asset erneut per Swipe/Buttons entschieden werden.
- Zähler/Toast bleiben konsistent (Deleted Count wird zurückgesetzt um 1).

