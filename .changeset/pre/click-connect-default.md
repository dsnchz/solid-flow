---
"@dschz/solid-flow": patch
---

`clickConnect` now defaults to `true`, matching React Flow (`connectOnClick`) and Svelte Flow (`clickConnect`). Clicking a handle and then a compatible handle connects them without a drag. It had no default here, so click-to-connect was off unless the prop was passed. Behavior change: in a flow that did not pass `clickConnect`, a click on a handle now arms a connection (the root gets the `connecting` class and `onClickConnectStart` fires). Pass `clickConnect={false}` to keep the old behavior.
