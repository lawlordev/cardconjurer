# Sets Workspace

## Planning metadata

- Status: decision-complete and ready for product review; implementation has not started.
- Planning branch: `codex/feat/sets`
- Base branch: `origin/master`
- Base commit: `cf1b74cc` (`Add optional copyright text to collector card information`)
- Planning date: 2026-08-02
- Repository shape: static HTML, CSS, and classic JavaScript served locally; no package manifest or existing automated test suite.

## Structured brief

### Desired outcome

Replace the reserved left-side library with a local-first Sets workspace. Every card must belong to exactly one set, and edits to either a card or its set must save continuously without Save or Cancel actions. A user opening Card Conjurer for the first time should immediately have an `Untitled Set` (`UT1`) containing one blank Common card numbered `0001` with the default frame and Post-ONE collector formatting.

The left third of the desktop workspace becomes the set surface. It keeps one active set at a time, selected through a dropdown, and contains four tabs:

1. **Cards** (default): searchable, sortable, filterable list of cards with thumbnails and card actions.
2. **Set Details**: set metadata and Markdown story editing/preview.
3. **Set Symbol**: shared rarity-specific symbol sources.
4. **Collector**: shared collector style, set code, language, copyright, derived year, and collector-group order.

The center remains the live preview and the right remains the card editor. Set Symbol and Collector leave the card editor. A new Card Details card-editor tab retains per-card rarity, printing classification, symbol placement, and collector-presentation controls.

### Success criteria

- Every persisted card has one set owner; there is no standalone-card state.
- First launch and deletion of the final set create an `Untitled Set`/`UT#` set with one blank Common `0001` card.
- Deleting the final card in any set immediately creates a replacement blank `0001` card as part of the same undoable action.
- Multiple sets persist locally, switch through a dropdown, and receive unique names and exactly three-character uppercase alphanumeric codes.
- Set and card changes autosave continuously and restore after reload without Save or Cancel prompts.
- Undo and redo work throughout card and set editing, survive reload, retain 40 actions per set, coalesce typing, and support standard keyboard shortcuts.
- The Cards tab defaults to collector order and shows thumbnail, title, mana cost, rarity, and collector number for every printing.
- Search matches title, type line, rules text, and artist.
- Sort choices are Collector, Alphabetical, and Mana Value.
- Filters cover Color, Color Identity, Rarity, and Card Type. Color and Color Identity each accept one selected color with `Only` or `Includes` semantics.
- Search/sort/filter state is remembered per set across switches and reloads.
- Automatic collector numbering always controls the displayed number; no card can pin or manually override it.
- Standard-frame cards are always the first collector group and follow colorless nonartifact, W, U, B, R, G, multicolor, colorless artifact, nonbasic land, and basic land ordering, alphabetically within each bucket.
- After the main group, the default reorderable group order is Tokens, Borderless, non-Booster-Fun Special Treatments grouped by frame, Booster Fun grouped by frame, and Custom grouped by frame. Cards within every frame group use the standard bucket ordering.
- Frame group and printing category are inferred from the frame registry when possible and can be corrected manually in Card Details.
- Post-ONE formatting displays a four-digit number such as `0200`; Pre-ONE displays a three-digit number and the three-digit total of every printing, such as `200/275`.
- Same-frame art variants are linked list entries with `a`, `b`, and subsequent suffixes, occupy the same alphabetical position, and relabel consecutively after deletion.
- Treatment variants are linked gameplay identities with their own collector numbers in their inferred frame groups.
- An art or treatment variant automatically unlinks if a gameplay field diverges; an art variant also unlinks if its frame treatment changes.
- A double-faced card is one list entry with one collector number. The persisted schema reserves a back-face slot, but this feature edits only the currently supported/front face.
- New Card creates a blank Common card with the default frame. Duplicate Card creates an independent consecutive printing. Add Art Variant and Add Treatment Variant create the corresponding linked copies.
- Cards can be moved or copied between sets; target-set symbol/code/language/copyright/year override source shared data and both sets renumber.
- Card deletion is immediate and undoable. Set deletion requires confirmation and is undoable.
- One-card and one-set portable files use `.cardconjurer-card` and `.cardconjurer-set` respectively.
- A card import enters the active set, keeps all card-specific rendering data, accepts the active set's shared fields, renumbers, and automatically replaces an existing matching gameplay identity.
- A set import with a matching name or code asks Replace or Merge. Merge keeps local-only cards but imported metadata and conflicting/newer card records win.
- Exported files preserve external/local image URLs as URLs and embed files that the user uploaded. Frame selection, art and symbol placement, custom layers, and all other card-specific values round-trip exactly.
- Set-image ZIP export is distinct from set-file export, contains only rendered images, uses the current PNG/JPEG selection, names images `<collector number> <card title>.<ext>`, reports progress, and can be canceled.
- Set-symbol artwork is shared by rarity, with separate Common, Uncommon, Rare, and Mythic Rare sources. Tokens and basic lands use the Common source. Position, scale, and rotation remain per card.
- New sets default to `EN`, blank release date, Creator `Card Conjurer User`, Copyright `© <current year> Custom Cards.`, Post-ONE style, and Common rarity for their first card.
- The printed collector year uses the release-date year when present and the current year otherwise.
- On narrow screens, the set workspace becomes a slide-out drawer rather than stacking as a permanently visible full-width section.

### Set metadata

Editable fields are:

- name;
- short description;
- release date (blank by default);
- creator (`Card Conjurer User` by default);
- notes;
- story Markdown plus a rendered preview;
- exactly three-character uppercase alphanumeric set code (`UT1`, `UT2`, and so on for generated sets);
- language (`EN` by default);
- copyright text (`© <current year> Custom Cards.` by default);
- collector style (Post-ONE by default or Pre-ONE);
- four rarity-specific set-symbol sources;
- ordered collector frame groups.

Internal fields include a stable UUID, created/updated timestamps, the active card, per-set list view state, and the persistent undo/redo history.

### Scope

#### In scope

- Local IndexedDB persistence for sets, cards, uploaded assets, view state, and undo history.
- The complete left-panel Cards/Set Details/Set Symbol/Collector interface.
- New Card Details tab and relocation of current per-card collector/symbol controls.
- Automatic collector classification, grouping, numbering, variant linking, and renumbering.
- Search, sort, filters, thumbnails, set switching, and responsive drawer behavior.
- Universal persistent undo/redo for card and set mutations.
- New/duplicate/delete/move/copy/art-variant/treatment-variant actions.
- Portable single-card and whole-set import/export with schema validation and embedded uploaded assets.
- Set-image ZIP generation in PNG or JPEG with progress/cancellation.
- A safe Markdown story preview.
- Removal of the legacy manual saved-card UI and replacement of the one-live-draft startup path.
- Automated pure-logic tests plus desktop and narrow-browser integration verification.

#### Explicit non-goals

- Accounts, server persistence, cloud sync, or collaboration.
- A two-face card editor or a rendered back-face workflow; only the schema slot and shared-number model are added.
- Manual or locked collector numbers.
- User-defined ordering inside a collector frame group.
- More rarity values than Common, Uncommon, Rare, and Mythic Rare.
- Automatic conversion of the current live draft or legacy manually saved cards. Those card payloads may be discarded; unrelated user preferences remain.
- Exporting set metadata inside the image ZIP.
- Changing the canvas renderer, frame assets, text layout engine, Scryfall import behavior, or image output except where needed to load a selected persisted card and apply set-owned fields.
- Deployment, publication, or a pull request during this planning phase.

### Product decisions and implementation defaults

| Area | Decision |
| --- | --- |
| Ownership | Every card belongs to exactly one set. |
| Startup | Create the next unique `Untitled Set`/`UT#` and one blank Common card when no set exists. |
| Active surface | One active set; dropdown switcher; Cards tab selected by default. |
| Autosave | Every mutation persists continuously; no Save or Cancel UI. |
| Card import conflict | Replace the matching local printing automatically. Stable imported IDs match first; otherwise use gameplay fingerprint plus frame/variant role. |
| Set import conflict | Ask Replace or Merge; imported/newer metadata and matching cards win during Merge. |
| Color filtering | Separate Color and Color Identity filters. Each uses one color plus `Only` or `Includes`. |
| Collector color | Use actual printed color, including color indicators; broader identity is only for the Identity filter. |
| Alphabetic comparison | Strip Card Conjurer formatting tokens, trim/collapse whitespace, compare case- and diacritic-insensitively, then use stable creation order as the final tie-break. |
| Sort direction | Each sort supports ascending/descending; the new-set default is Collector ascending. This is a conventional UI default, not a product-specific rule. |
| Mana value | Parse the front-face mana cost; X contributes zero outside the stack and absent costs are zero. |
| Variant suffixes | Use `a` through `z`, then `aa`, `ab`, and so on rather than imposing a 26-variant limit. |
| Gameplay fingerprint | Include title, mana cost, type line, rules/gameplay text, power/toughness, loyalty/defense, and other layout-specific gameplay values. Exclude art, artist, flavor text, visual placement, and other presentation-only data. |
| Safe Markdown | Support headings, paragraphs, emphasis, strong text, lists, blockquotes, fenced/inline code, and links. Escape raw HTML and reject unsafe link protocols. |
| Multi-tab behavior | Treat one tab as the active editor. Broadcast committed changes so another open tab refreshes its list/state instead of silently overwriting stale data. |
| File schema | JSON envelope with explicit `format`, `schemaVersion`, `exportedAt`, records, and an uploaded-asset table. Unknown future schema versions fail closed with a clear error. |

The current Magic Comprehensive Rules document the legal collector-number forms as `[card number]/[total]` or a standalone card number, but do not define one universal post-main-set treatment order. Product ranges vary. The requested frame-group system is therefore the source of truth for this feature, while the official forms remain the rendering constraint. See [Wizards' current rules page](https://magic.wizards.com/en/rules) and rule 213.1a in the linked Comprehensive Rules.

## Current-state findings

### Application and UI

- `creator/index.html` contains the three-column workspace. The left `aside.creator-library` is explicitly marked as a future set/card area and currently creates no data.
- The current desktop grid is approximately 29% library, 37% preview, and 33% editor at a 1665-pixel viewport, matching the intended left-third allocation.
- `css/style-9.css` changes to two columns below 880 px and then stacks the library, preview, and editor below 720 px. Browser inspection at 390×844 exposed extreme horizontal overflow from the legacy content. The new drawer must replace this stack and include explicit overflow containment.
- `creator/index.html` and `js/creator-23.js` own the eight card-editor tabs and `toggleCreatorTabs()`. Set Symbol and Collector are currently card tabs; Import/Save also holds the legacy saved-card UI.
- The active canvas remains the appropriate preview for set-wide symbol/copyright changes. Updating shared set data must immediately rehydrate/redraw the active card and invalidate other thumbnails.

### Card runtime and rendering

- `js/creator-23.js` stores the complete live card in one global `card`, renders the canvas, and uses `cardStorageSnapshot()` to remove runtime `Image` objects before serialization.
- `loadCard()` currently accepts a localStorage key, clears/rebuilds frames and text controls, loads dynamic version scripts and mana assets, and performs a deterministic render through `renderLoadedCard()`.
- The implementation should extract the JSON-driven portion into `loadCardData(cardData, uiState)` and keep one compatibility wrapper while set storage replaces key-based loading.
- `textEdited()`, frame/text layout drawers, art/symbol functions, collector functions, dynamic version scripts, and frame customization are mutation entry points. `queueLiveDraftSave()` currently covers only a subset. A set-aware mutation/history bridge must become the shared persistence call while retaining the old function name as a temporary compatibility alias for frame scripts.
- `renderLoadedCard()` and the `previewCanvas` render-revision marker provide a stable point to refresh a thumbnail after all images and fonts settle.

### Collector and frame metadata

- Collector values are currently copied between DOM inputs and card fields inside `bottomInfoEdited()`.
- `enableNewCollectorStyle` is a global localStorage preference. It must become the active set's collector style and drive `setBottomInfoStyle()` whenever a card loads or the set changes.
- Set code, language, year, copyright, and collector number currently live in each card. The new model stores them on the set and hydrates them into the runtime card/DOM for drawing without persisting duplicate card-owned copies.
- Rarity, note, artist, serial values, star/dot, collector visibility/layout, and symbol position are currently intertwined in the old tabs. Rarity and collector/symbol presentation stay on the card and move to Card Details.
- `js/frameRegistry.js` already exposes `category(pack)`, `family(pack)`, and profile/variant relationships. It distinguishes standard, Booster Fun, tokens, basics, legacy, and custom catalog groups. Extend this registry with collector-category/group metadata and override hooks rather than parsing visible frame labels in the workspace.
- Actual color can be derived from the mana cost plus color indicator. Color identity additionally scans rules/gameplay text for mana symbols. Lands and colorless artifacts require type-line precedence over the generic colorless bucket.

### Persistence, imports, and downloads

- Current reload persistence is one localStorage live draft (`__card_conjurer_live_draft__` plus UI state), and legacy manual saves are individual localStorage records indexed by `cardKeys`. This is limited by the browser's small localStorage quota and cannot support sets, uploaded assets, and 40-step histories reliably.
- Use IndexedDB. Keep unrelated preferences such as autoframe and reminder-text preferences in localStorage.
- First successful database bootstrap may remove/ignore `cardKeys`, the records listed by it, the two live-draft keys, and the temporary bulk key. Do not clear localStorage wholesale.
- User uploads become data URLs in `js/main-1.js`; URL/local-art inputs remain URLs. The persistence layer needs asset references so the same uploaded bytes are not repeated in every history entry or linked variant.
- `bulkDownloadZip()` already renders saved cards sequentially, waits for tracked images/fonts, supports File System Access streaming, falls back to an in-memory Blob, and restores the original card afterward. Generalize it to active-set records, selected PNG/JPEG output, numbered filenames, progress, cancellation, and guaranteed active-card restoration.
- `downloadCard()` already enforces artist credit and emits PNG/JPEG. Reuse the same render and validation path for each ZIP entry.
- JSZip is loaded dynamically from a CDN during initialization. Preserve the existing fallback/error behavior; portable card/set files themselves are plain JSON envelopes and do not require JSZip.

### Tests and delivery

- There is no package manifest or automated UI test suite.
- `.github/workflows/publish.yaml` only syncs `master` to S3 on push; it performs no build or tests.
- The repository includes `dev_server.py` and `start-dev-server.ps1`; the latter finds the bundled Codex Python runtime when Python is not on PATH.
- The Codex bundled Node runtime is available at `C:\Users\Jake\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`. Pure model modules can be made Node-compatible and tested with the built-in `node:test` runner without adding a package manager.

## Proposed persisted model

Use an IndexedDB database named `card-conjurer` with an explicit schema version. Keep records structured-clone-compatible and renderer-independent.

### Object stores

#### `sets`

- `id` UUID primary key.
- Metadata fields listed in the brief.
- `collectorStyle`: `post-one` or `pre-one`.
- `symbolSources`: asset/URL references for `common`, `uncommon`, `rare`, and `mythic`.
- `collectorGroupOrder`: stable group keys; main is implicit/fixed first.
- `activeCardId`.
- `listState`: search, sort key/direction, and filters.
- `createdAt`, `updatedAt`.

#### `cards`

- `id` UUID primary key and indexed `setId`.
- `cardData`: renderer snapshot excluding set-owned values and runtime `Image` objects.
- `uiState`: active frame pack/customization state currently captured by `liveDraftUiSnapshot()`.
- `rarity`: `common`, `uncommon`, `rare`, or `mythic`.
- `printingCategory`: `main`, `token`, `borderless`, `special`, `booster-fun`, or `custom`.
- `frameGroupKey` and user-facing group label.
- `classificationOverride` when the user corrects inferred category/group.
- `logicalCardId`, `variantKind` (`art`, `treatment`, or null), and `variantOrder`.
- `gameplayFingerprint` and stable independent-printing order.
- `collectorNumber` cached from the deterministic numbering function.
- `backFace`: nullable reserved payload; null in this feature.
- Derived list fields: normalized title/type/rules/artist, mana display/value, actual colors, color identity, and card types.
- Thumbnail asset reference plus dirty/revision markers.
- `createdAt`, `updatedAt`.

#### `assets`

- `id` UUID primary key.
- Uploaded Blob, MIME type, original filename, content hash, and timestamps.
- URL sources are not copied into this store.
- Persisted card/set fields refer to either `{kind: "url", value}` or `{kind: "asset", assetId}`. Runtime hydration creates usable object/data URLs.
- Garbage collection runs only after history pruning and verifies that no live record or undo entry references the asset.

#### `history`

- One transaction record per semantic action with affected set IDs, label, timestamp, coalescing key, and compact before/after patches.
- Per-set undo/redo cursors capped at 40 transactions.
- Uploaded assets are referenced by ID rather than duplicated in patches.
- Cross-set move/copy transactions are referenced by both sets and undo atomically from either affected set.
- A deleted set and its history remain as a recoverable tombstone until the deletion falls outside its undo window.

#### `preferences`

- Active set ID, schema/bootstrap marker, and multi-tab revision metadata.
- Existing unrelated visual/editor preferences remain in localStorage.

### Runtime invariants

- A set transaction that creates/deletes/moves cards always runs numbering before commit and persists the set/cards/history atomically.
- Set-owned values are injected into the global runtime `card` and matching DOM fields on load. They are stripped from `cardData` before persistence.
- A frame or gameplay edit recalculates derived fields, variant linkage, frame classification, collector numbers, list text, and the active thumbnail in one autosave cycle.
- Set symbol, collector style, code/language/copyright, or release date changes redraw the active card immediately and mark all set thumbnails dirty.
- A set can never commit with zero cards. Last-card and last-set replacement behavior is part of the original action, not a second undo step.

## Deterministic collector numbering

Implement the numbering engine as pure functions in `js/setModel.js` and make it the only writer of `collectorNumber`.

1. Resolve each card's collector category/group from Card Details override or `FRAME_REGISTRY` metadata.
2. Place standard-frame main cards in the fixed first group.
3. Build remaining groups in the set's saved order. Seed a new set with Tokens, Borderless, Special frame groups, Booster Fun frame groups, then Custom frame groups. Newly encountered frame groups are inserted at the end of their category while preserving prior user ordering.
4. Inside each group, bucket by:
   1. colorless nonartifact, nonland;
   2. white;
   3. blue;
   4. black;
   5. red;
   6. green;
   7. multicolor;
   8. colorless artifact;
   9. nonbasic land;
   10. basic land.
5. Sort each bucket by normalized front-face title and stable independent-printing/variant order.
6. Assign one base sequence number to each independent printing or linked art-variant family. Linked same-frame art variants share the base sequence number and receive consecutive suffixes. Treatment variants are independent sequence entries in their treatment frame groups.
7. Format Post-ONE with a minimum width of four (`0001`, `0200a`). Format Pre-ONE with a minimum width of three plus `/YYY` where `YYY` is the count of every card record/printing in the set (`200a/275`). Never truncate values that exceed the minimum width.
8. Apply the resulting set-wide numbers in one transaction after create, edit, unlink, frame/category change, move/copy/import, group reorder, or delete.

## Ordered implementation plan

### 1. Add the pure set domain model and tests

Intended files:

- `js/setModel.js` (new)
- `tests/set-model.test.js` (new)
- `tests/set-files.test.js` (new)
- `tests/set-history.test.js` (new)

Work:

- Define set/card defaults, schema constants, ID helpers, name/code allocation (`Untitled Set`, `UT1`, etc.), and strict validation.
- Implement formatting-token stripping, gameplay fingerprints, derived title/type/rules/artist/mana/color/identity/card-type data, natural collector comparison, search/sort/filter reducers, and collector classification/numbering.
- Implement file envelope validation and deterministic merge/replace reducers without browser APIs.
- Implement history reducer/coalescing/cursor/pruning behavior and inverse patches.
- Export through both `window.CardConjurerSetModel` and `module.exports` so the same code runs in the browser and Node's built-in test runner.

Checkpoint:

- Pure tests cover empty/default sets, all collector buckets, frame-group reordering, art suffix deletion/relettering, treatment variants, duplicate tie order, Pre-/Post-ONE formats, every-printing denominator, DFC single-number behavior, variant unlinking, search/filter semantics, imports, and 40-step persistent history.

### 2. Add IndexedDB, uploaded-asset references, and bootstrap

Intended files:

- `js/setStorage.js` (new)
- `js/setWorkspace.js` (new)
- `creator/index.html`
- `js/creator-23.js`

Work:

- Create/open the schema and stores described above, with transaction helpers for atomic set/card/history writes.
- Convert user-uploaded data URLs into deduplicated Blob assets. Preserve HTTP(S), relative `local_art`, and repository asset sources as URL references.
- Add asset hydration/revocation and conservative garbage collection after history pruning.
- Bootstrap the first set/card or restore active IDs. Allocate the next unique `Untitled Set #` and `UT#` values.
- After successful bootstrap, remove only legacy card payload keys/indexes and obsolete temporary draft keys; preserve unrelated localStorage preferences.
- Add quota/open/transaction error states that keep the in-memory editor usable, show a durable warning, and offer set export before destructive recovery.
- Add a `BroadcastChannel` revision message so another tab refreshes committed set/list state instead of overwriting it blindly.

Checkpoint:

- Fresh storage, restored storage, failed/corrupt storage, quota errors, and another-tab notifications are deterministic. Reload restores active set/card, list state, and undo/redo cursors.

### 3. Refactor the global card loader into a set-aware bridge

Intended files:

- `js/creator-23.js`
- `js/setWorkspace.js`
- affected dynamic version scripts only where a mutation cannot reach the shared bridge

Work:

- Extract `loadCardData(cardData, uiState)` from key-based `loadCard()` while preserving frame reconstruction, dynamic scripts, fonts/images, and `renderLoadedCard()` ordering.
- Replace live-draft initialization with `CardConjurerSets.initialize()` after the frame catalog is ready.
- Replace `saveLiveDraftCard()`/`queueLiveDraftSave()` with active-card snapshot commits. Keep `queueLiveDraftSave` as a compatibility alias until all existing callers and Planeswalker scripts use the set-aware mutation gateway.
- Split serialization into renderer data, frame UI state, derived list metadata, per-card details, and set-owned hydrated values.
- Apply active set code/language/copyright/year/style/symbol source and computed collector number before each load/render; never copy these fields back into card-owned persistence.
- Add semantic mutation labels/coalescing keys to text, frame, art, watermark, symbol placement, collector presentation, import, and card-specific layout handlers.
- On committed renders, produce/update the active thumbnail and list row from the render revision.
- Make Reset an undoable reset of the active card to the default frame/card data while retaining its set membership and derived number.

Checkpoint:

- Switching among at least Regular, Planeswalker, Saga, Station, token, basic-land, and specialty frames restores identical card output; edits autosave and undo across reload without regressing the current render-order fixes.

### 4. Replace the reserved library with the active-set workspace shell

Intended files:

- `creator/index.html`
- `css/style-9.css`
- `js/setWorkspace.js`

Work:

- Replace future/empty markup with set dropdown, New Set, set action menu, undo/redo controls, and the four left-panel tabs.
- Keep Cards selected by default and retain the chosen tab per active set if appropriate; switching sets restores that set's list state and active card.
- Add set create/delete/export/import/download-images actions. Set delete shows confirmation and remains undoable. Last-set deletion creates a temporary replacement set inside the same transaction.
- Enforce unique local name/code editing and generated `Untitled Set`/`UT#` values without blocking continuous editing mid-keystroke; normalize/validate on commit/blur and show inline errors.
- Add accessible tab roles, selected state, focus management, keyboard navigation, loading/empty/error states, and live status text for autosave/history.

Checkpoint:

- Multiple sets can be created, switched, renamed, deleted/undone, and restored across reload with unique names/codes and no standalone card state.

### 5. Build Set Details, Set Symbol, and Collector tabs

Intended files:

- `creator/index.html`
- `css/style-9.css`
- `js/setWorkspace.js`
- `js/setModel.js`
- `js/frameRegistry.js` as needed for group labels

Work:

- Set Details: name, description, release date, creator, notes, Story Markdown editor, and side-by-side/stacked rendered preview.
- Render Markdown with the declared safe subset, escaped raw HTML, safe links, and no executable content. Imported story text is treated as untrusted.
- Set Symbol: retain official source lookup where possible and expose separate upload/URL controls and previews for C/U/R/M. Use Common automatically for token/basic-land cards.
- Collector: set code, language, copyright, derived year preview, Post-/Pre-ONE style, total-printing preview, and drag/keyboard reorderable collector frame groups with main fixed first.
- Changing shared symbol or collector fields updates the active preview, renumbers when applicable, and marks set thumbnails dirty for background/lazy regeneration.
- Remove obsolete set-symbol locks/default collector controls that conflict with set ownership.

Checkpoint:

- Set metadata persists continuously; Story preview is safe; all four symbol rarities display correctly; release-year fallback works; style/group changes update every card and undo/redo as one semantic action.

### 6. Add Card Details and finish frame classification

Intended files:

- `creator/index.html`
- `css/style-9.css`
- `js/creator-23.js`
- `js/setWorkspace.js`
- `js/frameRegistry.js`

Work:

- Remove Set Symbol and Collector from the right card-editor tabs and add Card Details.
- Keep Frame, Text, Art, Watermark, Scryfall/paste Import, Tutorial, and image download behavior.
- Move per-card rarity, printing category/frame group, color indicator if applicable, foil star/dot, note, serial, collector visibility/layout/style details, and set-symbol position/scale/rotation into Card Details.
- Extend `FRAME_REGISTRY.definition()` with collector category/group inference. Map tokens, borderless, non-Booster-Fun special/promos/legacy frames, Booster Fun, and custom frames. Keep catalog `basics` separate from collector grouping so a basic land follows the active frame treatment group.
- Show inferred classification and a manual correction control; collector number remains read-only.
- Restrict rarity to Common, Uncommon, Rare, and Mythic Rare and refresh the shared symbol source/frame stamps on change.

Checkpoint:

- Existing card-level collector/symbol presentation remains adjustable, set-owned values cannot diverge by card, and all representative frame families enter the expected default collector groups.

### 7. Implement card actions, linkage, and universal history

Intended files:

- `js/setWorkspace.js`
- `js/setModel.js`
- `js/setStorage.js`
- `creator/index.html`
- `css/style-9.css`

Work:

- Add New, Duplicate, Add Art Variant, Add Treatment Variant, Delete, Move To, Copy To, Export Card, and Import Card actions.
- New uses blank/default/Common data. Duplicate is independent and receives stable tie order immediately after its source. Linked variants duplicate all current card data and record logical identity/variant kind.
- Recompute gameplay fingerprints after relevant edits. Automatically unlink diverged gameplay; also unlink art variants when frame treatment diverges. Reletter remaining art variants after removal.
- Move/copy presents a target-set selector. Target shared fields win; copy receives new IDs; move renumbers both sets. Moving the only card creates the source's replacement blank card atomically.
- Delete Card is immediate with Undo status. Delete Set remains confirmed. Preserve active selection by choosing the next collector item, previous item, or generated blank fallback.
- Add app-bar and narrow-drawer Undo/Redo buttons. Intercept `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z`, including focused fields, while respecting IME composition.
- Coalesce repeated edits to the same field after a short idle period or blur; frame actions, imports, moves, and deletes remain single discrete transactions.
- Store 40 actions per affected set and persist cursors. A new action after undo clears the applicable redo branch.

Checkpoint:

- Every action can be undone/redone before and after reload. Cross-set operations remain atomic. Uploaded images are not duplicated across linked copies or history entries.

### 8. Implement the Cards list, thumbnails, search, sort, filters, and drawer

Intended files:

- `creator/index.html`
- `css/style-9.css`
- `js/setWorkspace.js`
- `js/setModel.js`

Work:

- Build virtualizable/list-efficient rows with thumbnail, title fallback (`Untitled Card`), mana cost, rarity label/icon, read-only collector number, active state, and action menu.
- Keep the selected card visible after renumber/sort/filter when it still matches. Show a clear filtered-empty state without deleting selection.
- Search normalized title/type/rules/artist. Add remembered Collector/Alphabetical/Mana Value sorting and direction.
- Add single-value Color and Color Identity filters with Only/Includes mode, plus Rarity and Card Type filters. Combine different filter groups with AND.
- Derive actual color from cost/indicator and broader identity from cost, indicator, and mana symbols in gameplay text.
- Generate compact WebP/PNG thumbnails from the settled card canvas, cache them as assets, update the active card after edits, and lazily regenerate invalidated nonactive thumbnails.
- Replace the narrow stacked library with a slide-out set drawer, app-bar trigger, overlay, Escape close, returned focus, scroll locking, and no horizontal overflow at 390×844. Preserve the desktop one-third column and the intermediate two-column/editor-below layout.

Checkpoint:

- Lists remain responsive with a representative large set, filtering/sorting/searching restore after reload, thumbnails update after shared/card edits, and desktop/mobile selection remains keyboard and screen-reader operable.

### 9. Add portable card/set files and conflict handling

Intended files:

- `js/setFiles.js` (new)
- `js/setWorkspace.js`
- `js/setStorage.js`
- `js/setModel.js`
- `creator/index.html`
- `tests/set-files.test.js`

Work:

- Implement versioned `.cardconjurer-card` and `.cardconjurer-set` JSON envelopes.
- Export external/local URLs unchanged and embed uploaded assets once in the envelope with content hash/MIME/name. Include frame UI state and all renderer/card metadata needed for exact reconstruction.
- Card exports carry set context for portability, but card import always applies the active set's symbol/code/language/copyright/year/style and recalculates collector data.
- Match a card import by stable origin ID first, then gameplay/frame/variant fingerprint; replace automatically and make the replacement undoable.
- On matching set code or name, show Replace/Merge. Replace swaps the set. Merge preserves local-only cards while imported metadata, group order, assets, and conflicting cards win. Both paths validate first, transact atomically, renumber, and are undoable.
- Reject malformed JSON, wrong envelope type, unsafe/unsupported schema versions, missing required fields, invalid asset encoding, duplicate IDs, and impossible cross-record references with actionable errors and no partial writes.
- Reuse the file inputs for drag/drop and picker flows; clear the input value so the same file can be re-imported.

Checkpoint:

- URL-only, uploaded-asset, custom-frame, art-variant, treatment-variant, and reserved-DFC fixtures round-trip without renderer drift. Replace/Merge and card replacement follow the approved conflict rules.

### 10. Rework set-image ZIP generation

Intended files:

- `js/creator-23.js`
- `js/setWorkspace.js`
- `creator/index.html`
- `css/style-9.css`

Work:

- Generalize the existing sequential bulk renderer to accept the active set's collector-ordered card records and `loadCardData()` rather than localStorage keys.
- Use the current image format select: PNG lossless or JPEG at the same quality as single-card download. Do not expose preview/new-tab for ZIP.
- Sanitize filenames and use `<formatted collector number> <title or Untitled Card>.<png|jpg>`; disambiguate only impossible duplicate filenames without changing displayed collector data.
- Add progress count/title, cancel control, failure count, and completion/error status. Cancellation stops before the next render and does not produce a partial download unless the user explicitly confirms keeping completed entries.
- Preserve streaming via File System Access and Blob fallback. Revoke object URLs and always restore the original active set/card/UI/render in `finally`, including cancellation and exceptions.
- Include all printings and only image files; no set envelope or manifest.

Checkpoint:

- PNG and JPEG ZIPs contain the correct names/count/order and visibly match single-card downloads. Cancel, one-card sets, uploaded assets, slow/broken images, and fallback generation leave the editor unchanged.

### 11. Harden compatibility, accessibility, cache versions, and documentation

Intended files:

- all touched source/test files
- `README.md`
- `creator/index.html`
- `index.html` and/or cache-busting references that serve changed CSS/JS

Work:

- Preserve Scryfall import, paste-card, current frame/version scripts, local-art URLs, artist-credit validation, image download, watermark behavior, and card-specific text/layout tools.
- Remove legacy manual Save/Load/Delete All/Download Saved Cards controls and dead code only after set replacements are verified.
- Add status/error/live-region copy, focus restoration, accessible menus/dialogs, keyboard group reordering, reduced-motion behavior, and high-contrast selected/focus states.
- Document local persistence, browser/device scope, automatic numbering, import/export/ZIP differences, undo retention, uploaded-vs-URL assets, and backup guidance.
- Update asset cache-busting tokens consistently so the static host and local server load the new scripts/styles.

Checkpoint:

- No console errors on startup or core workflows; old frame/card workflows still render; documentation matches the implemented file types and recovery limits.

## Edge cases and recovery requirements

- **No database / blocked database:** keep a clear retry/export-recovery surface; never pretend autosave succeeded.
- **Quota exceeded:** retain current in-memory edits, warn persistently, permit export/deletion/retry, and do not prune live assets automatically.
- **Legacy keys:** delete/ignore only indexed card payloads and draft keys after the new database commits its first set; never call `localStorage.clear()`.
- **Corrupt file or database record:** validate before mutation; isolate the bad record, show the reason, and leave the active set unchanged.
- **Imported set collisions:** match code or name case-insensitively after normalization; do not show Replace/Merge for an unrelated UUID with no collision.
- **Imported card collisions:** deterministic automatic replacement as defined above; replacement is one undoable transaction.
- **Blank/incomplete card:** index as colorless with zero mana value and an `Untitled Card` display fallback; it still receives a collector number.
- **Color indicator:** participates in actual color and identity even without a mana cost.
- **Rules symbols:** contribute to color identity but not actual color.
- **Colored artifacts:** stay in their actual W/U/B/R/G/multicolor bucket; only colorless artifacts use the artifact bucket.
- **Lands:** land buckets override color/artifact buckets; `Basic` supertype chooses the final basic-land bucket.
- **Hybrid/Phyrexian mana:** include every represented color for actual color/identity; canonicalize WUBRG order.
- **Variant edits:** presentation-only changes preserve linkage. Gameplay changes unlink. Art variant frame changes unlink. Undo restores the prior link and numbers.
- **More than 26 art variants:** continue with spreadsheet-style suffixes.
- **Pre-ONE count:** count each list entry/printing once, including every suffixed art variant, treatment, promo/special frame, token, and reserved single DFC entry.
- **Frame group disappears:** keep its saved order as dormant metadata so undo/import can restore it; hide empty groups from the reorder UI.
- **Shared metadata edits:** active preview updates immediately; inactive thumbnails visibly enter a regenerating/stale state rather than showing misleading final imagery.
- **Last card/set:** replacement blank entity is atomic with deletion/move and vanishes if that action is undone.
- **Set deletion undo:** restore cards, assets, list state, and history. Undoing last-set deletion also removes the automatically created placeholder set.
- **Concurrent tab:** later committed revision triggers refresh/rebase notice; do not allow silent last-writer-wins over a dirty active edit.
- **Bulk ZIP:** sanitize Windows-reserved characters/names, preserve suffixes and collector separators safely, and restore active runtime in all exits.
- **Markdown:** raw HTML is displayed as text; links allow only safe protocols and open with `noopener`.
- **Double-faced cards:** persist one list record/number with nullable `backFace`; do not invent a back renderer or two-image ZIP behavior.
- **Unsupported old card files:** the existing multi-saved-card `.cardconjurer` format is not migrated automatically; show a clear unsupported-format message rather than corrupting a set.

## Test strategy

### Automated pure-logic tests

Run with the bundled Node executable (or `node` when available):

```powershell
& 'C:\Users\Jake\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests\set-model.test.js tests\set-files.test.js tests\set-history.test.js
```

Required coverage:

- defaults, unique Untitled names/codes, strict code normalization, and metadata validation;
- collector buckets, alpha/tie ordering, frame groups and custom reorder;
- Pre-/Post-ONE formatting, every-printing totals, natural collector sort, and widths beyond padding;
- art suffix creation/deletion/relettering beyond `z`;
- treatment numbering and gameplay/frame unlink rules;
- DFC one-record behavior;
- actual color and broader color identity, including hybrid/Phyrexian/indicator/rules symbols;
- mana-value derivation and title/type/rules/artist indexing;
- every search/sort/filter combination and state serialization;
- card/set file validation, asset deduplication, card replacement, set Replace/Merge precedence, and unknown-schema rejection;
- history coalescing, reload serialization, redo clearing, 40-step pruning, set/card deletion, and cross-set atomic actions.

### Static and repository checks

```powershell
git diff --check
```

If implementation introduces standalone scripts that can be syntax-checked without a browser:

```powershell
& 'C:\Users\Jake\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check js\setModel.js
& 'C:\Users\Jake\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check js\setStorage.js
& 'C:\Users\Jake\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check js\setFiles.js
& 'C:\Users\Jake\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check js\setWorkspace.js
```

### Local browser verification

Start the documented local server from the feature worktree:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-dev-server.ps1
```

Use the in-app browser against `http://127.0.0.1:8081/`. Clear only the new test database when a clean-state scenario requires it; do not clear unrelated local preferences.

Desktop coverage at approximately 1440×900 or wider:

1. Fresh launch creates UT1/one Common `0001`; metadata defaults and Post-ONE preview are correct.
2. Create/switch/rename/delete/undo multiple sets; uniqueness and last-set fallback work.
3. Edit every set field, Markdown preview, all four symbol sources, style, group order, and reload.
4. Create representative cards for every collector bucket and frame category; assert all numbers and Pre-ONE denominator.
5. Create/delete/edit art and treatment variants, an independent duplicate, and reserved DFC data; verify linking/unlinking/undo.
6. Search each supported field; use all sorts/directions and Color/Identity/Rarity/Card Type filters; reload remembered state.
7. Move/copy cards between sets, including the only card; verify shared-field override and both-set renumbering.
8. Exercise 40+ undo actions, typing coalescing, redo clearing, deletion, set changes, reload, and keyboard shortcuts inside fields.
9. Export/import URL-only and uploaded-asset cards; verify automatic replacement and exact canvas reconstruction.
10. Export/import sets through new, Replace, and Merge paths; verify metadata precedence, local-only retention, corrupt-file rejection, and undo.
11. Generate PNG and JPEG ZIPs; verify order, filenames, count, image parity, progress, cancellation, broken-image handling, streaming/fallback, and active-card restoration.
12. Regress Scryfall/paste import, representative special frame scripts, text layout drawers, watermarks, artist validation, and single-card downloads.
13. Verify empty/loading/autosaving/offline-library/quota/import-error states and console logs.

Responsive coverage:

- 880 px intermediate layout: library/preview remain usable and editor moves below without clipping.
- 720 px boundary and 390×844 narrow viewport: set workspace is a closed-by-default drawer, opens/closes from an accessible trigger/overlay/Escape, traps or manages focus correctly, restores focus, and produces no horizontal overflow.
- Keyboard-only pass for set tabs, list rows/action menus, filters, group reorder, Markdown preview controls, import conflict dialog, delete confirmation, progress cancel, Undo, and Redo.

### Verification surface rationale

The feature is browser-only and uses IndexedDB, File APIs, canvas, dynamic scripts, and responsive DOM behavior. Pure Node tests are appropriate for deterministic model/file/history logic, but they do not prove IndexedDB transactions, canvas parity, file-picker/download behavior, dynamic frame restoration, or accessibility. The in-app browser exercises the actual local application and is therefore the strongest repository-supported integration surface. No native simulator or Docker service is needed.

## Verification and PR evidence plan

Full coverage is the complete matrix above. PR visuals should stay intentionally small:

1. **`sets-cards-desktop` — desktop 1440×900:** active-set dropdown, Cards tab, representative thumbnail rows, search/sort/filter controls, active preview, and card editor. Purpose: explain the primary workflow and three-column integration.
2. **`sets-collector-desktop` — desktop 1440×900:** Collector tab with Post-/Pre-ONE selector, shared fields, and reordered frame groups alongside a representative numbered card. Purpose: make the numbering model reviewable.
3. **`sets-mobile-drawer` — 390×844:** opened set drawer over the usable mobile workspace with focusable close control. Purpose: prove the agreed narrow-screen adaptation and absence of the current overflow.
4. **`sets-undo-import-state` — desktop 1440×900 only if materially distinct in the final UI:** one representative undo toast or Replace/Merge conflict dialog, not both. Purpose: show recovery/decision language.

The PR description must state that additional set/card actions, variant states, filters, error states, ZIP formats, imports, and viewport boundaries were exercised even when they are not pictured. Confirm every selected image renders inline in the PR; do not attach redundant screenshots for equivalent list/filter states.

## Documentation, handoff, and rollback

- Update `README.md` with local-only persistence, initial defaults, set/card files, image ZIP distinction, URL/upload asset behavior, undo retention, and backup guidance.
- Record any new vendored code or licenses if implementation chooses a library despite the plan's dependency-free safe Markdown approach.
- Do not deploy or publish during feature implementation. The repository's only CI job publishes direct pushes to `master`, so verification must complete before merge.
- For rollback before release, revert the feature commit(s); the new IndexedDB database may remain inert and can be removed by a documented recovery action.
- Legacy card keys are allowed to be discarded only after successful new-database bootstrap. Because the user explicitly declined migration, rollback does not promise recovery of those old card payloads.
- A failed implementation must never delete the new IndexedDB database automatically. Export/recovery should remain possible from the last working feature build.
- Review checkpoint: approve this plan before implementation. The implementation instruction should invoke the `standardized-feature` skill in this same `codex/feat/sets` worktree and branch.
