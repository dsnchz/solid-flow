---
"@dschz/solid-flow": patch
---

Fix the `cross` background variant rendering as a blank pane: a flat
`size: 1` prop default preempted the per-variant default size (cross needs
6), shrinking each cross to an invisible ~1px speck.
