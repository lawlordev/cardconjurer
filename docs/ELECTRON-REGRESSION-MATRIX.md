# Electron Regression Matrix

This map was built from the rendered Electron workspace and is exercised by `npm run test:regression` against an isolated temporary user-data directory. The run records screenshots in `SET_CONJURER_EVIDENCE_DIR` when that variable is set, or in the system temporary directory otherwise.

Every checkpoint fails on JavaScript exceptions, CSP violations, page errors, and failed document/script/stylesheet responses. Optional frame-preview image misses remain excluded because the catalog intentionally probes multiple asset fallbacks.

| Surface | Interactions covered | Regression assertions |
|---|---|---|
| First run | Required pack selection and onboarding completion | Standard pack is selected/locked; workspace becomes ready |
| Set Details | Name, description, release date, creator, notes, Markdown story, help drawer | Values persist across tab rerender; story preview renders; no CSP errors |
| Collector | Code, language, copyright, copyright Note styling, collector format, group ordering | Switcher and hydrated active-card fields update immediately |
| Set Symbol | Set-code load, per-rarity source edit, clear, reload | All rarity sources load, clear, and restore without renderer errors |
| Cards | Search and clear | Empty-state filtering and query reset work |
| Frame | Search, category filter, frame selection, advanced options, customization | Search clears; selected frame and controls remain interactive |
| Text | Mana, title, type, rules, power/toughness, auto-size, layout drawer, formatting help | Dynamic text controls accept edits and both drawers open/close |
| Art | Artist, auto-fit, exact layout, preserve position, advanced rendering, remove | Layout fields and art actions run without renderer errors |
| Watermark | Search, preset, opacity, exact layout, manual colors, remove | Preset and appearance/layout controls run without renderer errors |
| Card Details | Rarity, Note, serialization, footer star, serialized layout | Set-owned rarity and card-owned collector details update together |
| Card actions and history | New, duplicate, variant, set-detail undo, redo | Card count moves 1 → 4; deterministic set edit survives undo/redo |
| Set actions | Duplicate set, create set, switch set, copy card | Three sets exist and copied card appears in its destination |
| Import | Card-search drawer open/close | Drawer is reachable without making a network request |
| Desktop | Combined Settings and Frame Packs drawer | Current desktop settings surface opens, contains Frame Packs, and closes |
| Print | Single-card print preview | Front and default-back pages are generated |

Download/export file dialogs, destructive delete confirmations, external Scryfall searches, and OS clipboard/file uploads are deliberately kept out of this deterministic suite. Their entry points are inventoried in `docs/UI-INVENTORY.md`; they require fixture files, network contracts, or native-dialog harnesses rather than ordinary DOM automation.
