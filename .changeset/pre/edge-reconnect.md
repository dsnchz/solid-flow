---
"@dschz/solid-flow": minor
---

Edge reconnection works end-to-end. Fixed: `EdgeReconnectAnchor` passed the
connection updater to XYHandle without a flush, so under Solid 2.0's
deferred model the gesture's synchronous read-back saw a stale (null)
`fromHandle` and never matched a drop handle — every reconnect ended with
`isValid: null` and no edge update. The anchor also gained
`onReconnectingChange` (the Solid translation of Svelte Flow's
`bind:reconnecting`) and now honors its `reconnecting` prop as a controlled
override; a new EdgeReconnect playground example demonstrates the
selected-edge anchor pattern.
