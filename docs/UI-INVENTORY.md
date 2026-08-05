# UI Inventory
<!-- Maintained by agents. Verify exemplars before trusting; update after adding patterns. -->

## Design tokens
- Fonts: Montserrat variants for workspace UI, with app fallbacks — defined in `css/style-9.css`.
- Colors: shared site tokens map legacy surfaces and browser selection to the workspace's dark slate, teal, and light-blue palette; workspace semantic custom properties define neutral, hover, selected, disabled, primary, and destructive interaction roles (`--workspace-control*`, `--workspace-accent*`, `--workspace-focus`, and `--workspace-danger*`) — defined in `css/style-9.css`.
- Spacing, radii, elevation: compact rem-based controls use `--workspace-radius: .55rem` matching the Settings button for outer rectangular surfaces, with derived `--workspace-radius-segmented`, `--workspace-radius-inner`, `--workspace-radius-nested`, and `--workspace-radius-compact` values keeping inset children visually concentric; thin semantic borders, dark layered surfaces, and one `--workspace-panel-gutter` align both tab strips with their content; true circles, progress tracks, scrollbars, and rendered card/image content retain shape-specific radii — defined throughout the creator workspace section of `css/style-9.css`.
- Text styles: `.creator-eyebrow` for compact uppercase context and `.input` for controls — defined in `css/style-9.css`.

## Screen scaffold
- Header: `.creator-app-bar` aligns the set selector with the set-count edge and the fixed Settings control with the right-panel gutter; `.creator-app-status-area` keeps the New Set-style Update/Restart action separate from the content-sized save card, matches its `2.35rem` height, and preserves the same `.5rem` control gap used by New Set/Undo/Redo — `creator/index.html`, `js/desktopBridge.js`, and `css/style-9.css`.
- Workspace: three-column `.creator-grid` containing the set library, live preview, and editor menu — `creator/index.html` and `css/style-9.css`.
- Primary and secondary buttons: teal is explicitly scoped to `.creator-new-set`, the New Card `.sets-primary`, and segmented-tab selectors; every other action uses the shared dark bordered control treatment — `creator/index.html` and `css/style-9.css`.
- Drawers: shared `.textbox-editor` left drawer with a close-button row followed by one `.textbox-editor-title` and a divider; its fixed-height input, select, and button controls use zero block padding for consistent vertical centering across card text, searches, art layout, and watermark layout — `creator/index.html` and `css/style-9.css`.
- Contextual help: `.formatting-help-drawer` provides the shared reference-table treatment; Set Details uses its right-anchored `.markdown-help-drawer` variant so help stays opposite the set panel — `creator/index.html`, `js/setWorkspace.js`, and `css/style-9.css`.

## Workflow to component map
| Workflow | Component | Exemplar |
|---|---|---|
| Pick an active set | Native `.input` select | `creator/index.html` |
| Switch editor sections | Shared `.segmented-tab-track`: one Copy Card-style dark track with consistent unselected hover states and a New Card-style teal selector that slides between equal-width tabs | `creator/index.html`, `js/setWorkspace.js`, `css/style-9.css` |
| Communicate interactive priority | Shared interaction hierarchy: teal is reserved for active segmented tabs, New Set, and New Card; selected cards, frames, presets, choices, and checked controls use dark blue; neutral controls use near-black; disabled controls use gray; destructive controls use red | `css/style-9.css` |
| Show secondary actions | `.creator-action-dropdown` | `creator/index.html`, `js/setWorkspace.js` |
| Choose from a dropdown | App-wide `.workspace-select` enhancer mirrors action dropdowns with a left-aligned label, edge-pinned chevron that rotates around a fixed vertical center, and one fully opaque `--workspace-menu-surface`; New Set also paints each option row with that solid surface, while the app-bar stacking layer keeps its menu above and pointer-blocking over workspace dividers; every select and action menu closes on selection, trigger re-click, outside click, or Escape, renders above app chrome with an 8px viewport inset, sizes to its widest option, and scrolls when space runs out; native selects remain the underlying form controls | `js/frameSearch.js`, `creator/index.html`, `css/style-9.css` |
| Confirm destructive action | Native confirm followed by history-backed action | `js/setWorkspace.js` |
| Search a card list | Pinned `.sets-search` above `.sets-card-scroll` | `js/setWorkspace.js` |
| Scan card metadata | Three-line card rows with title, type line, rendered mana symbols, rarity, and collector number | `js/setWorkspace.js`, `css/style-9.css` |
| Browse frame styles | Lazy-loaded `.frame-catalog` tiles try each pack's available neutral assets in colorless, Eldrazi, artifact, white, then first-frame order, skipping accessory layers and missing files | `js/frameSearch.js`, `css/style-9.css` |
| Apply catalog frames | The automatic renderer uses color variants when available, then type-aware creature/noncreature, legendary/regular, neutral, and first-frame defaults for standalone packs | `js/autoFrame.js`, `js/frameSearch.js` |
| Choose artwork | Immediate upload/drop and clipboard actions, explicit URL loading, or a Scryfall-backed `.art-search-drawer` | `creator/index.html`, `js/creator-23.js` |
| Import a card | The `.creator-action-dropdown` offers `.cardconjurer-card` file import and the Scryfall-backed `.card-search-drawer`; both actions use the workspace's CSP-safe delegated `data-card-import-action` path | `creator/index.html`, `js/setWorkspace.js` |
| Export the active card | The existing `.creator-action-dropdown` offers native-save PNG, JPG, and `.cardconjurer-card` exports plus Print; desktop image exports use the same validated `showSaveDialog` bridge as structured card exports | `creator/index.html`, `js/creator-23.js`, `desktop/services/file-service.ts` |
| Adjust artwork placement | `.art-layout-drawer` with exact position, scale, rotation, auto-fit, and position-preservation controls | `creator/index.html`, `js/creator-23.js` |
| Adjust numeric values | Shared `.layout-number-control` preserves exact typing and adds large minus/plus targets with sequential live press-and-hold adjustment and Shift for explicit 10x steps; it enhances modern layout shells and wraps remaining visible workspace number inputs, including Frame Element, Set Symbol, and serialized-card fields | `js/layoutNumberControls.js`, `js/creator-23.js`, `css/style-9.css` |
| Choose a watermark | Searchable horizontal preset catalog with live card-color previews, immediate upload/drop, or explicit URL and set-code loading in the Watermark tab | `creator/index.html`, `js/creator-23.js` |
| Adjust watermark placement | `.watermark-layout-drawer` with exact position, scale, and reset controls | `creator/index.html`, `js/creator-23.js` |
| Style a watermark | Always-visible opacity plus automatic color-identity/type tinting; Advanced exposes the auto-update toggle and manual split-color overrides | `creator/index.html`, `js/creator-23.js` |
| Edit per-card collector details | Dedicated Rarity, Note, Serialized Card, and Footer Mark sections; serialized placement uses the shared compact layout-drawer pattern | `creator/index.html`, `js/creator-23.js`, `js/setWorkspace.js` |
| Configure set collector output | Set-owned code, language, copyright, style, and first-copyright-line Note styling in the Collector tab | `js/setWorkspace.js`, `js/setModel.js` |
| Switch between rendered cards | Frozen `.creator-canvas-transition` snapshot fully covers a hidden live canvas until pending assets settle and the next card receives a final render | `creator/index.html`, `js/creator-23.js`, `js/setWorkspace.js`, `css/style-9.css` |
| Keep card thumbnails current | Final canvas renders patch the active card thumbnail in place and persist it for reloads | `js/creator-23.js`, `js/setWorkspace.js` |
| Resize workspace panels | `.workspace-resizer` draggable separators with persisted widths | `creator/index.html`, `js/setWorkspace.js` |
| Hydrate the saved workspace | Full-screen `.creator-loading-screen` until preferences, set data, and the active card finish rendering | `creator/index.html`, `js/setWorkspace.js` |
| Communicate autosave health | Content-sized `.creator-app-context` status card matching the Settings button height, with consistent horizontal padding; it remains blue Saved successfully during writes and changes to red Issue saving only after a failed write | `creator/index.html`, `js/setWorkspace.js`, `css/style-9.css` |
| Manage desktop settings and asset packs | One left `.desktop-drawer` opened from the fixed top-right Settings control; grouped Frame Packs, Updates, and About sections use the layout-drawer card pattern, with locked installed rows for required Set Symbols and Standard above direct optional Install/Uninstall progress | `js/desktopBridge.js`, `css/style-9.css` |
| Complete first-run setup | Workspace-themed `.sets-dialog` with compact multi-select pack rows and one primary action | `js/desktopBridge.js`, `css/style-9.css` |
| Configure and preview print jobs | Minimal full-workspace print view: standard app-bar Back/select/Print controls, visual card rows with compact minus/count/plus quantity controls, and unlabelled paper previews; list thumbnails stay lightweight while each printable front receives a dedicated full-resolution PNG source | `js/desktopBridge.js`, `js/setWorkspace.js`, `js/printModel.js`, `css/style-9.css` |

## Framework-widget theming
- Dialogs: `.sets-dialog` uses workspace surfaces, borders, type, and button treatments — `js/setWorkspace.js`, `css/style-9.css`.
- Native selects: hidden native `.input` controls retain values/events while the app-wide `.workspace-select` presents the shared Set Options trigger, rotating chevron, and option-menu treatment — `js/frameSearch.js` and `css/style-9.css`.
- Native date picker: `.sets-date-input` keeps the browser picker dependency-free while applying the workspace dark color scheme, tabular date numerals, and themed calendar affordance — `js/setWorkspace.js` and `css/style-9.css`.

## Do / Don't
- Use existing workspace custom properties instead of introducing new colors.
- Keep global selection, native controls, and browser chrome aligned with the shared site tokens.
- Keep controls compact and use Montserrat workspace typography.
- Preserve the mobile Sets drawer behavior below the desktop workspace breakpoint.
- Reserve prominent teal for the active segmented tab, New Set, and New Card.
- Use `--workspace-radius` for outer rectangular workspace and desktop-shell components, then use the derived inset radius that matches a nested child's depth so compound-control corners remain concentric; only intrinsically circular indicators, progress/scrollbar tracks, and rendered card/image content use shape-specific radii.
- Use dark blue for selected cards, frames, presets, choices, checked controls, and open secondary dropdowns; neutral controls stay near-black and only lighten their border and background on hover.
- Use gray for disabled controls and red only for destructive actions such as delete, remove, clear, and uninstall.
