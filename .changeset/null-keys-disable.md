---
"@dschz/solid-flow": patch
---

Setting a key prop to `null` (`deleteKey`, `selectionKey`, `multiSelectionKey`, `panActivationKey`, `zoomActivationKey`) now disables that key, as documented. `null` used to fall back to the default key, so for example `deleteKey={null}` still deleted the selection on Backspace. Leaving a prop out (or passing `undefined`) still uses the default.
