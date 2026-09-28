---
"@dschz/solid-flow": patch
---

Stylesheet fixes bringing the CSS to parity with React Flow and Svelte Flow:

- Centered panels are centered: `top-center` / `bottom-center` sat 15px right of center, and `center-left` / `center-right` were centered horizontally instead of vertically.
- NodeResizer handles are 5px (were 4px) and stay centered on the node's corners when `autoScale` enlarges them on a zoomed-out viewport.
- Horizontal `<Controls>` separate their buttons with a right border instead of the vertical layout's bottom borders.
- The control-button styles apply to `ControlButton`s only (`.solid-flow__controls-button`), not to every `<button>` inside `<Controls>`.
- In the default theme a selected built-in node keeps its border and shows selection as its box shadow (it switched to a `#555` border with no dark value). The selected border and `--xy-node-border-selected` now apply with `base.css` only; restyle selection in the default theme through `--xy-node-boxshadow-selected`.
- The default theme hides the browser focus outline on every selectable node, custom types included, and on the multi-node selection box.
- The flow container is `direction: ltr`, so right-to-left pages do not mirror the Controls or panels.
- The pane is `touch-action: none`, so touch drags pan or box-select instead of scrolling the page.
- `<Background bgColor>` takes precedence over an app-wide `--xy-background-color`.
- The flow's layer containers are `user-select: none`, so drags across the pane and label layers no longer select page text.
- `<EdgeLabel transparent>` drops the label background (the prop had no effect).
