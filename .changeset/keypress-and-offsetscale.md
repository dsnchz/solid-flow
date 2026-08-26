---
"@dschz/solid-flow": minor
---

Two parity features: `useKeyPress` (reactive key/combo tracking usable anywhere — hardened beyond upstream: combos re-activate when the base key is re-pressed while the modifier stays held, fixing the pattern behind xyflow#2248, and stuck modifiers self-heal from later input events) and MiniMap `offsetScale` (scales the padding around the graph, default 5 — the last MiniMap parity gap).
