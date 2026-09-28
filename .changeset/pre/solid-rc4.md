---
"@dschz/solid-flow": patch
---

SolidJS 2.0.0-rc.4 support. rc.4 ships the fix for the torn mid-action reads through derived stores that our optimistic-compat questions surfaced upstream (solidjs/solid#3089) — our contract spikes confirm the mid-action read artifact is gone, the full runtime matrix stays green, and drag performance improved slightly (mean ~4.7 → ~3.7 ms/move at 10k nodes).
