---
"@dschz/solid-flow": patch
---

The node wrapper attaches its dblclick listener only when onNodeDoubleClick is passed (10,000 fewer listeners at 10k nodes), builds the element style as one literal, and runs its measure request and resize observation from one effect (heap 651 -> 643 MB at 10k; selection drag script time 168 -> 136 ms).
