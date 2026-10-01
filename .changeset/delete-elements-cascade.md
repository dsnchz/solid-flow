---
"@dschz/solid-flow": patch
---

Deleting every node and every edge at once (select all, then Delete) at 10k nodes took 18.8 s; it now takes under a second. Edges that the deleted nodes already take with them are no longer looked up one by one in the cascade.
