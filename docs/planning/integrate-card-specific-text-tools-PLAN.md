# Integrate Card-Specific Tools into the Text Tab

## Structured brief

Card Conjurer currently adds a new top-level creator tab when certain frame-version scripts load. Those tabs are visually disruptive, inconsistent with the compact app navigation, and often expose implementation-oriented geometry controls before the average user needs them.

Move every currently dynamic card-specific tab into the existing **Text** experience. Keep the full capability of each card type, but make the normal workflow simple: content and game-facing values belong beside the related text fields; appearance-only options belong in a collapsed **Advanced** section; and anything that changes placement, size, offsets, stretching, or room geometry belongs in a left-side **Layout** drawer consistent with the existing text-field Layout drawer.

The nine dynamic tabs in scope are:

1. Planeswalker
2. Saga
3. Class
4. Station
5. Dungeon
6. QR Code
7. Mystical Archive
8. Mystical Archive (Horizontal)
9. Kamigawa Basics

### Desired outcome

- The top creator navigation remains the same fixed eight tabs regardless of the selected card/frame type.
- The Text tab reveals only the contextual controls that apply to the active card layout.
- An average user can enter the card-specific content or values without seeing raw geometry controls.
- Every legacy option remains reachable through either the contextual Text section, its collapsed Advanced section, or its Layout drawer.
- Existing card rendering, frame-stretching, save/load behavior, and layout math do not regress.

### Success criteria

- Loading any of the nine affected version scripts does not append a top-level tab or a sibling creator-menu section.
- Standard cards show no empty card-specific panel or irrelevant controls in Text.
- Switching among standard and special card layouts replaces the contextual controls cleanly, with no duplicates or stale controls.
- Planeswalker loyalty values/costs and Saga chapter counts are visibly associated with their corresponding ability text fields.
- Station’s badge values and QR Code’s URL are available in the default Text workflow.
- Class, Mystical Archive, Mystical Archive (Horizontal), and Kamigawa Basics add no unnecessary default clutter when their only extra controls are layout-related.
- Dungeon room text remains in the normal text-field list; the room-map specification is retained in a clearly named Dungeon Layout drawer.
- Planeswalker, Saga, Class, Station, Dungeon, QR Code, Mystical Archive, Mystical Archive (Horizontal), and Kamigawa Basics all retain their current adjustment capabilities.
- Contextual Advanced sections use the app’s current labeled checkbox/dropdown styles and are collapsed by default.
- Layout drawers open from the left, follow the current drawer visual language, have labeled controls, close accessibly, and remain usable at desktop and narrow responsive widths.
- Existing saved cards and existing version scripts continue to load without requiring a data migration.

## Scope

### In scope

- Introduce a shared client-side registration/rendering mechanism for card-specific Text tools.
- Add a contextual section within the Text tab and render it only when an active version registers relevant controls.
- Associate per-field metadata controls with their matching Text cards where that relationship is clear.
- Extend the current Layout drawer pattern to render card-type-specific geometry controls.
- Add a contextual collapsed Advanced area for nonessential appearance and behavior options.
- Convert all nine legacy dynamic tab implementations to the new mechanism.
- Preserve existing control IDs or provide an explicit adapter so the existing edit, redraw, stretch, and value-restoration functions continue to work.
- Add labels, concise helper text, ARIA relationships, and keyboard/focus behavior consistent with the existing Text and drawer UI.
- Update cache-busting asset versions in the creator page when changed JavaScript or CSS requires it.

### Explicit non-goals

- Rewriting any card renderer, frame-stretch algorithm, canvas drawing pipeline, or text-layout engine.
- Replacing Dungeon’s room-map syntax with a graphical dungeon editor.
- Redesigning Station’s underlying rendering model or changing its defaults.
- Changing frame auto-selection, frame packs, card dimensions, or output appearance except through the user’s existing controls.
- Redesigning the fixed eight-tab creator navigation beyond preventing dynamic additions.
- Changing saved-card schemas or adding a migration.
- Deploying or publishing the application.

## Current-state findings

### Application structure

- `creator/index.html` owns the fixed creator navigation, the Text panel, the generic left-side `#textbox-editor`, and the Formatting Help drawer.
- `js/creator-23.js` builds Text field cards in `createTextFieldCard()`, rebuilds the Text form in `renderTextFieldForm()`, loads layouts in `loadTextOptions()`, and opens the generic field drawer in `textboxEditorForKey()`.
- `css/style-9.css` contains the current Text-card, labeled Advanced-option, responsive navigation, and left-side drawer styles.
- The application is static HTML/CSS/JavaScript. There is no package manifest or automated UI test suite. CI only publishes the contents of `master` to S3.
- The repository’s remote default branch is `master`, not `main`; this plan’s branch is based on fetched `origin/master` commit `6a0d9867`.

### Dynamic-version behavior

Each affected version file currently guards itself with `loadedVersions`, appends a `<h3>` to `#creator-menu-tabs`, creates a hidden `#creator-menu-*` section, and wires controls through fixed DOM IDs:

| Version file | Current default controls | Controls that belong in Layout | Controls that belong in Advanced |
| --- | --- | --- | --- |
| `js/frames/versionPlaneswalker.js` | Four loyalty costs/values associated with ability fields | Four ability heights and four loyalty-badge shifts | Invert textbox colors |
| `js/frames/versionSaga.js` | Chapter count associated with each ability field | Four ability heights | None |
| `js/frames/versionClass.js` | Existing level text/cost fields are already rendered by Text | Four level heights | None |
| `js/frames/versionStation.js` | Badge values 1 and 2 | PT X/Y offsets, square X/Y/width, and both square heights | Badge/PT/square color modes, custom square color, opacities, disable-first-square, reset |
| `js/frames/versionDungeon.js` | Wall color; generated dungeon-room text already flows through `loadTextOptions()` | Raw multiline room-map specification | None |
| `js/frames/versionQRCode.js` | Decklist URL | QR X/Y/size; expose the existing `card.qrCode` position/size data through labeled controls | Existing color/alpha/padding data remains unchanged unless already supported by the legacy visible UI |
| `js/frames/versionMysticalArchiveJP.js` | None | Title-bar height and type-bar width | None |
| `js/frames/versionMysticalArchiveJPHorizontal.js` | None | Title-bar width and type-bar width | None |
| `js/frames/versionNeoBasics.js` | None | Title-bar height | None |

The actual card-specific text is already modeled in `card.text` for Planeswalker abilities, Saga abilities, Class levels, and generated Dungeon rooms. That makes the Text renderer the stable integration point; only their metadata and layout controls need contextual UI.

## Decisions made

1. **All nine dynamic top-level tabs will be removed.** Station, Dungeon, and QR Code will not receive exceptions.
2. **Use progressive disclosure.** Default Text UI contains only content/game-facing values; a collapsed Advanced section contains occasional appearance/behavior choices; a Layout button opens geometry controls.
3. **Associate metadata with its content where possible.** Planeswalker loyalty and Saga chapters should render as compact accessories on the corresponding ability field cards, rather than as a detached settings grid.
4. **Use one contextual registration contract.** Version files register their inline, layout, and Advanced controls with a shared Text-tools renderer instead of directly mutating the navigation. The registry must support clean replacement and rerendering as frame layouts change.
5. **Preserve legacy rendering functions.** Initial integration should reuse the current fixed IDs and handlers, or a small adapter that calls them, to minimize risk to canvas output.
6. **Use the existing drawer language.** Card-specific layout uses the same left-side animated drawer shell, headings, grouped fields, unit treatments, close affordance, and responsive behavior as the field Layout drawer. It may use a dedicated drawer body or a drawer mode, whichever produces the smaller coherent implementation.
7. **Do not promote unsupported QR appearance controls.** QR position and size are appropriate Layout controls because their backing data and renderer already exist. The commented-out legacy color UI is not revived as part of this change.
8. **Keep complex expert functions discoverable, not dominant.** Station’s full option set and Dungeon’s raw layout syntax remain available with clear names and helper copy, but are not expanded by default.
9. **No persistence migration.** Control values continue to live in the same `card`, `card.text`, frame stretch, and version-level state used today.

## Ordered implementation plan

### 1. Add the contextual Text-tools host and shared controller

Intended files:

- `creator/index.html`
- `js/creator-23.js`
- `css/style-9.css`

Work:

- Add a hidden contextual-card-tools host within the Text panel, positioned with the Card Text content rather than as a creator-menu sibling.
- Add a shared registration API/data contract that lets a loaded version declare a stable key, user-facing label, optional per-text-field accessories, default controls, Advanced controls, and Layout controls.
- Render the active registration from `renderTextFieldForm()`/`loadTextOptions()` so dynamic Dungeon text regeneration and normal layout changes cannot orphan the controls.
- Ensure registration replaces or clears the active definition when another version/layout becomes active, while the `loadedVersions` script guard can still prevent duplicate script initialization.
- Add a small shared helper for opening the contextual Layout drawer and restoring control values after rendering.
- Preserve focus when the Text form rerenders and return focus sensibly when a drawer closes.

Checkpoint:

- A temporary test registration can appear in Text, open the left Layout drawer, survive a Text-form rerender, and clear without adding a navigation tab.

### 2. Establish the simplified contextual UI patterns

Intended files:

- `creator/index.html`
- `css/style-9.css`
- `js/creator-23.js`

Work:

- Style compact field accessories for values that belong to a specific Text field.
- Style an optional contextual section heading with a Layout button matching the current Card Text/Layout affordances.
- Reuse the current labeled option-card pattern for Advanced controls, collapsed by default.
- Add grouped drawer sections and inputs for geometry-heavy card types, including descriptive labels and units.
- Define narrow-screen behavior so accessories wrap without obscuring the text input and the drawer remains scrollable and operable.
- Keep hidden contextual hosts out of layout entirely when no tool is active.

Checkpoint:

- Standard cards are visually unchanged except for any inert host markup; a representative mock special card is compact at desktop and mobile widths.

### 3. Integrate Planeswalker, Saga, and Class

Intended files:

- `js/frames/versionPlaneswalker.js`
- `js/frames/versionSaga.js`
- `js/frames/versionClass.js`
- shared Text-tools files from steps 1–2 as needed

Work:

- Remove top-tab/section injection from all three version scripts.
- Planeswalker: attach each loyalty cost/value input to the corresponding ability card; move ability heights and badge shifts into Planeswalker Layout; move invert textbox colors into collapsed Advanced.
- Saga: attach each chapter-count input to the corresponding ability card; move ability heights into Saga Layout.
- Class: rely on its existing level text and cost fields for the default workflow; expose only level heights through Class Layout.
- Retain `planeswalkerEdited()`, `fixPlaneswalkerInputs()`, `invertPlaneswalkerColors()`, `sagaEdited()`, `fixSagaInputs()`, `classEdited()`, and `fixClassInputs()` behavior via preserved IDs or explicit binding adapters.

Checkpoint:

- Each card type shows the intended simplified Text UI, every moved value changes the preview as before, rerender/load restores values, and no contextual tab appears.

### 4. Integrate Station with strong progressive disclosure

Intended files:

- `js/frames/versionStation.js`
- shared Text-tools files/styles as needed

Work:

- Replace Station’s large legacy section with a concise contextual Text registration.
- Keep badge values 1 and 2 in the default Station section with plain-language labels.
- Move PT offsets and square bounds/heights into Station Layout, grouped by Power/Toughness and ability boxes.
- Move badge/PT/square color modes, custom color, both opacity controls, disable-first-square, and reset into collapsed Advanced groups.
- Maintain the current auto/custom color behavior, conditional custom-color visibility, range/number synchronization, reset behavior, and `fixStationInputs()` restoration.
- Do not change Station drawing or card defaults.

Checkpoint:

- The default Station UI is substantially shorter, Advanced still exposes every legacy visible option, Layout exposes every legacy geometry option, and identical settings produce identical canvas output.

### 5. Integrate Dungeon and QR Code

Intended files:

- `js/frames/versionDungeon.js`
- `js/frames/versionQRCode.js`
- shared Text-tools files/styles as needed

Work:

- Dungeon: remove tab injection; keep wall color as the concise contextual control; put the raw room-map textarea in Dungeon Layout with short syntax guidance; keep generated room fields in the normal Card Text list and ensure regeneration does not duplicate or remove the contextual tools.
- QR Code: remove tab injection; show the URL as the default contextual control; bind URL changes back to `card.qrCode.url` as well as the renderer so redraw/rerender restoration is deterministic; expose existing X, Y, and size values in QR Layout with appropriate card-relative-to-pixel conversion consistent with other layout controls.
- Preserve `dungeonEditedBuffer()`, `dungeonEdited()`, and `updateQRCode()` rendering behavior.

Checkpoint:

- Dungeon map edits regenerate room fields while retaining the Dungeon tools; QR URL and layout edits redraw and restore correctly; neither adds a top-level tab.

### 6. Integrate specialty frame stretch controls

Intended files:

- `js/frames/versionMysticalArchiveJP.js`
- `js/frames/versionMysticalArchiveJPHorizontal.js`
- `js/frames/versionNeoBasics.js`
- shared Text-tools files/styles as needed

Work:

- Remove tab/section injection from all three scripts.
- Register a contextual Layout action without adding an empty default settings block.
- Place the existing title/type bar dimensions in clearly labeled Layout groups and preserve their current min/max/step/defaults and `stretch*()` handlers.
- Keep mana-symbol script loading unchanged.

Checkpoint:

- Each specialty frame exposes its stretch controls from Text Layout, updates text bounds and SVG stretches as before, and adds no default clutter or top-level tab.

### 7. Harden transitions, accessibility, and compatibility

Intended files:

- all touched UI/controller/version files

Work:

- Exercise switching from each special layout to a standard layout and between special layouts; clear stale controls and close or retarget an open drawer safely.
- Prevent duplicate registrations or duplicate DOM IDs after repeated frame-pack/layout loading.
- Confirm existing import/save paths restore the same underlying card values and invoke each version’s input-fix routine when appropriate.
- Ensure every visible input has an explicit label, buttons expose their purpose, Advanced toggles communicate collapsed state using the project’s established behavior, and drawer controls are keyboard reachable.
- Confirm legacy inline callbacks do not query removed elements before the contextual UI is rendered; guard or decouple only where required.
- Update creator JavaScript/CSS cache-busting query strings.

Checkpoint:

- Full transition and persistence matrix passes with no console exceptions, stale tabs, duplicate IDs, or inaccessible controls.

### 8. Final review, evidence, and PR handoff

Intended files:

- feature source files
- no throwaway screenshots committed unless the repository gains a durable evidence convention

Work:

- Review the complete diff for unrelated changes and secrets.
- Run the verification matrix below on the isolated worktree’s task-owned local server.
- Capture the selected representative screenshots, attach them with stable GitHub-renderable URLs in the PR, and verify inline rendering on desktop and GitHub mobile.
- Commit all and only intended source changes, push `feat/integrate-card-specific-text-tools`, and open a PR against the default-branch exception `master` using the Standardized Feature PR template.
- Stop the task-owned server and verify its port is free; do not stop the user’s pre-existing server on port 8081.

## Edge cases and compatibility

- **No active special version:** the contextual host and its Layout action must be absent, not merely blank.
- **Repeated script/layout loading:** `loadedVersions` and the new registry must not leave stale definitions or duplicate IDs.
- **Switching while a drawer is open:** close or rerender the drawer so controls never mutate the previous card type.
- **Text rerender/focus:** `renderTextFieldForm()` is called during several workflows; preserve the current focused field/caret behavior and contextual controls.
- **Dungeon regeneration:** `loadTextOptions(textObjects)` must preserve both existing room text where applicable and the registered Dungeon tools.
- **Variable ability counts:** layouts that expose fewer than four Planeswalker/Saga/Class fields must not show orphan accessories or irrelevant geometry inputs; retain the version scripts’ existing correction logic.
- **Station conditional controls:** custom color and related controls must follow the selected color mode and retain synchronized values.
- **QR state:** URL edits must update stored QR state, not only a transient function argument.
- **Imported/older cards:** missing optional values should fall back to current version defaults without throwing; no schema rewrite is performed.
- **Responsive layout:** long labels, Station Advanced, and Dungeon syntax must remain usable without horizontal page overflow.
- **Caching:** changed static assets require updated query strings so browser testing and deployed review do not use stale JavaScript/CSS.
- **Backend/API/permissions:** none are involved. All changes are local static UI and canvas behavior.
- **Recovery:** the change is isolated to one feature branch and introduces no persistent migration. Reverting the feature commit(s) restores the dynamic tabs and legacy sections.

## Test strategy

There is no repository-supported automated test runner. Verification will therefore combine JavaScript syntax checks, static diff checks, DOM/console assertions in the in-app browser, and manual canvas-output smoke tests on a task-owned non-production server.

### Exact non-production commands

From `C:\Users\Jake\Documents\Developer\cardconjurer-text-tools`:

```powershell
$node = 'C:\Users\Jake\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
Get-ChildItem js -Recurse -Filter '*.js' | ForEach-Object { & $node --check $_.FullName }
git diff --check origin/master...HEAD
git status --short
```

Start an isolated static server on a port separate from the user’s existing port 8081:

```powershell
$python = 'C:\Users\Jake\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $python -m http.server 8082 --bind 127.0.0.1 --directory 'C:\Users\Jake\Documents\Developer\cardconjurer-text-tools'
```

Open `http://127.0.0.1:8082/creator` in the in-app browser. This local static surface exercises the actual application and canvas code and is adequate because the feature has no backend, native API, authentication, or persistent remote dependency. It does not prove behavior in every external browser; human acceptance testing remains a merge gate.

### Full browser verification matrix

Use a desktop viewport comparable to the current app review surface (approximately 1650 × 1270) for all nine card types:

| Workflow/state | Required checks |
| --- | --- |
| Standard card | Fixed eight tabs only; no contextual card tools; existing Text fields and field Layout drawer unchanged |
| Planeswalker | Loyalty inputs align with ability fields; all four heights/shifts work in Layout; invert works in Advanced; values restore |
| Saga | Chapter counts align with ability fields; all ability heights work in Layout; values restore |
| Class | Default Text remains uncluttered; level heights work in Layout; values restore |
| Station | Default shows badge values only; every legacy geometry option works in Layout; every legacy appearance/behavior option works in Advanced; conditional color UI and reset work |
| Dungeon | Wall color works; raw map input works in Layout; regenerated room fields remain editable; contextual section survives regeneration |
| QR Code | URL, X, Y, and size update the preview and restore; QR remains scannable for a representative URL |
| Mystical Archive | Title height and type width stretch frame/text correctly from Layout |
| Mystical Archive (Horizontal) | Title width and type width stretch frame/text correctly from Layout |
| Kamigawa Basics | Title height stretches frame/text correctly from Layout |
| Switching | Standard → special → standard and special → special clear stale tools, duplicate IDs, selected-tab state, and open drawers |
| Import/save | Representative Planeswalker, Station, Dungeon, and QR settings survive the project’s existing save/import round trip where those values are currently serialized |
| Console/DOM | No uncaught errors; exactly eight top tabs; no duplicate IDs after repeated loads |

Repeat representative high-complexity workflows at a narrow responsive viewport (390 × 844):

- Planeswalker default controls plus Layout drawer.
- Station default controls, Advanced, and Layout drawer.
- Dungeon Layout textarea and generated room fields.
- QR URL and Layout drawer.

Verify keyboard navigation for one inline accessory workflow, the Advanced toggle, Layout open/close, and focus return. Verify drawer body scrolling reaches the final control at both viewports.

### Representative PR evidence set

Capture the smallest visual set that demonstrates materially different behavior:

1. **“Card-specific values live with Card Text” — Planeswalker, desktop 1650 × 1270.** Show loyalty controls associated with ability fields and the fixed eight-tab navigation. Coverage statement must name Saga and Class as additionally verified.
2. **“Complex tools are simplified by default” — Station, desktop 1650 × 1270.** Show the concise default Station Text section with Advanced collapsed. Pair with one Station Layout drawer image only if the drawer state cannot be understood from the other representative drawer screenshot. Coverage statement must enumerate all retained Station controls tested.
3. **“Geometry stays in Layout” — Dungeon Layout drawer, desktop 1650 × 1270.** Show the left-side drawer, raw room layout, normal Dungeon text fields, and fixed navigation. Coverage statement must name QR Code and all three specialty stretch layouts as additionally verified.
4. **“Responsive progressive disclosure” — Station or Dungeon, 390 × 844.** Show the most crowded relevant state without overflow and with the drawer scrollable. Coverage statement must name the other narrow-screen workflows verified.

Use a before/after pair only for the Planeswalker/navigation image if a pre-change capture is available and materially helps review. Do not create nine repetitive screenshots. Every selected image must render inline in the PR via a stable GitHub-accessible URL; local filesystem paths are not acceptable PR evidence.

## Documentation and PR handoff

- No end-user README change is required unless implementation introduces syntax or interaction that is not self-explanatory in the UI. Dungeon syntax help should live next to the Dungeon Layout control.
- Document the remote-default exception (`master`) and the absence of automated UI tests in the PR’s Risks/Notes.
- PR tester steps must identify exact representative frame packs/layouts for all nine types, expected fixed navigation, where each control moved, and the save/import checks that apply.
- Keep “Human acceptance testing complete” unchecked for the reviewer.
- No migration, function, backend, or production step exists; explicitly state that nothing was deployed.

## Release and rollback

- Release is outside this feature workflow. The PR targets `master` for human review and must not be merged or deployed by the implementation agent.
- Rollback before merge is branch deletion; rollback after merge is a normal revert of the feature commit(s). There is no data recovery procedure because no stored schema or production data changes.
- The implementation must stop only its task-owned local server on port 8082 and leave the user’s pre-existing port 8081 process untouched.

## Review checkpoint

This plan is decision-complete but must be reviewed and explicitly approved before implementation. After approval, execute it with the **Standardized Feature** skill in the existing `C:\Users\Jake\Documents\Developer\cardconjurer-text-tools` worktree on `feat/integrate-card-specific-text-tools`; do not create a replacement branch or worktree.
