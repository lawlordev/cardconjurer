# UI Inventory
<!-- Maintained by agents. Verify exemplars before trusting; update after adding patterns. -->

## Design tokens
- Fonts: Montserrat variants for workspace UI, with app fallbacks — defined in `css/style-9.css`.
- Colors: workspace semantic custom properties (`--workspace-bg`, `--workspace-panel`, `--workspace-border`, `--workspace-accent`, and related tokens) — defined on `.creator-workspace` in `css/style-9.css`.
- Spacing, radii, elevation: compact rem-based controls, approximately `.38rem`–`.55rem` radii, thin semantic borders, and dark layered surfaces — defined throughout the creator workspace section of `css/style-9.css`.
- Text styles: `.creator-eyebrow` for compact uppercase context and `.input` for controls — defined in `css/style-9.css`.

## Screen scaffold
- Header: `.creator-app-bar` with left-side set controls and right-side workspace status — `creator/index.html`.
- Workspace: three-column `.creator-grid` containing the set library, live preview, and editor menu — `creator/index.html` and `css/style-9.css`.
- Primary and secondary buttons: teal `.sets-primary` for primary actions; dark bordered compact buttons for secondary actions — `creator/index.html` and `css/style-9.css`.
- Drawers: shared `.textbox-editor` left drawer with a close-button row followed by one `.textbox-editor-title` and a divider — `creator/index.html` and `css/style-9.css`.

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
| Switch between rendered cards | Frozen `.creator-canvas-transition` snapshot fully covers a hidden live canvas until pending assets settle and the next card receives a final render | `creator/index.html`, `js/creator-23.js`, `js/setWorkspace.js`, `css/style-9.css` |
| Keep card thumbnails current | Final canvas renders patch the active card thumbnail in place and persist it for reloads | `js/creator-23.js`, `js/setWorkspace.js` |
| Resize workspace panels | `.workspace-resizer` draggable separators with persisted widths | `creator/index.html`, `js/setWorkspace.js` |
| Hydrate the saved workspace | Full-screen `.creator-loading-screen` until preferences, set data, and the active card finish rendering | `creator/index.html`, `js/setWorkspace.js` |

## Framework-widget theming
- Dialogs: `.sets-dialog` uses workspace surfaces, borders, type, and button treatments — `js/setWorkspace.js`, `css/style-9.css`.
- Native selects: `.input` and specialized compact select sizing — `css/style-9.css`.

## Do / Don't
- Use existing workspace custom properties instead of introducing new colors.
- Keep controls compact and use Montserrat workspace typography.
- Preserve the mobile Sets drawer behavior below the desktop workspace breakpoint.
- Use teal for active/selected emphasis and muted slate for neutral controls.
