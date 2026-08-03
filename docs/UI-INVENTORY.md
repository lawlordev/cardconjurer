# UI Inventory
<!-- Maintained by agents. Verify exemplars before trusting; update after adding patterns. -->

## Design tokens
- Fonts: Montserrat variants for workspace UI, with app fallbacks — defined in `css/style-9.css`.
- Colors: shared site tokens map legacy surfaces and browser selection to the workspace's dark slate, teal, and light-blue palette; workspace semantic custom properties (`--workspace-bg`, `--workspace-panel`, `--workspace-border`, `--workspace-accent`, and related tokens) refine that palette — defined in `css/style-9.css`.
- Spacing, radii, elevation: compact rem-based controls, approximately `.38rem`–`.55rem` radii, thin semantic borders, and dark layered surfaces — defined throughout the creator workspace section of `css/style-9.css`.
- Text styles: `.creator-eyebrow` for compact uppercase context and `.input` for controls — defined in `css/style-9.css`.

## Screen scaffold
- Header: `.creator-app-bar` with left-side set controls and right-side workspace status — `creator/index.html`.
- Workspace: three-column `.creator-grid` containing the set library, live preview, and editor menu — `creator/index.html` and `css/style-9.css`.
- Primary and secondary buttons: teal `.sets-primary` for primary actions; dark bordered compact buttons for secondary actions — `creator/index.html` and `css/style-9.css`.
- Drawers: shared `.textbox-editor` left drawer with a close-button row followed by one `.textbox-editor-title` and a divider; its fixed-height input, select, and button controls use zero block padding for consistent vertical centering across card text, searches, art layout, and watermark layout — `creator/index.html` and `css/style-9.css`.
- Contextual help: `.formatting-help-drawer` provides the shared reference-table treatment; Set Details uses its right-anchored `.markdown-help-drawer` variant so help stays opposite the set panel — `creator/index.html`, `js/setWorkspace.js`, and `css/style-9.css`.

## Workflow to component map
| Workflow | Component | Exemplar |
|---|---|---|
| Pick an active set | Native `.input` select | `creator/index.html` |
| Switch editor sections | Compact selected tabs matching the Set Editor tabs' fixed 1.85rem height | `creator/index.html`, `js/setWorkspace.js`, `css/style-9.css` |
| Show secondary actions | `.creator-action-dropdown` | `creator/index.html`, `js/setWorkspace.js` |
| Confirm destructive action | Native confirm followed by history-backed action | `js/setWorkspace.js` |
| Search a card list | Pinned `.sets-search` above `.sets-card-scroll` | `js/setWorkspace.js` |
| Scan card metadata | Three-line card rows with title, type line, rendered mana symbols, rarity, and collector number | `js/setWorkspace.js`, `css/style-9.css` |
| Browse frame styles | Lazy-loaded `.frame-catalog` tiles try each pack's available neutral assets in colorless, Eldrazi, artifact, white, then first-frame order, skipping accessory layers and missing files | `js/frameSearch.js`, `css/style-9.css` |
| Apply catalog frames | The automatic renderer uses color variants when available, then type-aware creature/noncreature, legendary/regular, neutral, and first-frame defaults for standalone packs | `js/autoFrame.js`, `js/frameSearch.js` |
| Search and import a real card | Scryfall-backed `.card-search-drawer` that creates a new card before applying the selected printing | `creator/index.html`, `js/setWorkspace.js` |
| Choose artwork | Immediate upload/drop and clipboard actions, explicit URL loading, or a Scryfall-backed `.art-search-drawer` | `creator/index.html`, `js/creator-23.js` |
| Adjust artwork placement | `.art-layout-drawer` with exact position, scale, rotation, auto-fit, and position-preservation controls | `creator/index.html`, `js/creator-23.js` |
| Choose a watermark | Searchable horizontal preset catalog with live card-color previews, immediate upload/drop, or explicit URL and set-code loading in the Watermark tab | `creator/index.html`, `js/creator-23.js` |
| Adjust watermark placement | `.watermark-layout-drawer` with exact position, scale, and reset controls | `creator/index.html`, `js/creator-23.js` |
| Style a watermark | Always-visible opacity plus automatic color-identity/type tinting; Advanced exposes the auto-update toggle and manual split-color overrides | `creator/index.html`, `js/creator-23.js` |
| Edit per-card collector details | Dedicated Rarity, Note, Serialized Card, and Footer Mark sections; serialized placement uses the shared compact layout-drawer pattern | `creator/index.html`, `js/creator-23.js`, `js/setWorkspace.js` |
| Configure set collector output | Set-owned code, language, copyright, style, and first-copyright-line Note styling in the Collector tab | `js/setWorkspace.js`, `js/setModel.js` |
| Switch between rendered cards | Frozen `.creator-canvas-transition` snapshot fully covers a hidden live canvas until pending assets settle and the next card receives a final render | `creator/index.html`, `js/creator-23.js`, `js/setWorkspace.js`, `css/style-9.css` |
| Keep card thumbnails current | Final canvas renders patch the active card thumbnail in place and persist it for reloads | `js/creator-23.js`, `js/setWorkspace.js` |
| Resize workspace panels | `.workspace-resizer` draggable separators with persisted widths | `creator/index.html`, `js/setWorkspace.js` |
| Hydrate the saved workspace | Full-screen `.creator-loading-screen` until preferences, set data, and the active card finish rendering | `creator/index.html`, `js/setWorkspace.js` |
| Manage desktop settings and frame packs | Left `.desktop-drawer` built from the existing `.textbox-editor.layout-drawer` header and compact section controls | `js/desktopBridge.js`, `css/style-9.css` |
| Complete first-run setup | Workspace-themed `.sets-dialog` with compact multi-select pack rows and one primary action | `js/desktopBridge.js`, `css/style-9.css` |
| Configure and preview print jobs | Full-workspace print view, familiar app-bar controls, card-list thumbnails, and exact-size page previews | `js/desktopBridge.js`, `css/style-9.css` |

## Framework-widget theming
- Dialogs: `.sets-dialog` uses workspace surfaces, borders, type, and button treatments — `js/setWorkspace.js`, `css/style-9.css`.
- Native selects: `.input` and specialized compact select sizing — `css/style-9.css`.
- Native date picker: `.sets-date-input` keeps the browser picker dependency-free while applying the workspace dark color scheme, tabular date numerals, and themed calendar affordance — `js/setWorkspace.js` and `css/style-9.css`.

## Do / Don't
- Use existing workspace custom properties instead of introducing new colors.
- Keep global selection, native controls, and browser chrome aligned with the shared site tokens.
- Keep controls compact and use Montserrat workspace typography.
- Preserve the mobile Sets drawer behavior below the desktop workspace breakpoint.
- Use teal for active/selected emphasis and muted slate for neutral controls.
