---
"@dschz/solid-flow": patch
---

The connection index behind `flow.connections`, `useNodeConnections` and the Handle `onConnect` / `onDisconnect` callbacks is built on its first read instead of at mount, and a box selection no longer reads it (each gesture maps nodes to their edges itself, with the same results). A flow that never reads the index mounts about 6% faster at 10k nodes, holds about 22 MB less heap, and replaces its graph or deletes half its nodes about 9-11% faster; each box selection costs about 12 ms more. An app that does read the index pays a one-time build on the first read (about 75 ms at 10k edges) and runs as before from then on.
