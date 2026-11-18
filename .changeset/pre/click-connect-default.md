---
"@dschz/solid-flow": patch
---

Breaking: `clickConnect` now defaults to `true`, matching React Flow (`connectOnClick`) and Svelte Flow (`clickConnect`). Clicking a handle and then a compatible handle connects them without a drag. It had no default in 0.2.x, so click-to-connect was off unless the prop was passed. In a flow that did not pass `clickConnect`, a click on a handle now arms a connection (the root gets the `connecting` class and `onClickConnectStart` fires). Pass `clickConnect={false}` to keep the old behavior. `clickConnect` also takes effect when it changes after mount; handles already rendered used to keep the setting they were created with.
