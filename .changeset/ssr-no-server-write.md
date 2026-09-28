---
"@dschz/solid-flow": patch
---

A server render no longer writes a signal. Each node's layout bumped a geometry change counter, which on the server is a `SERVER_WRITE` (a dev warning in Solid 2.0 today, slated to become an error). Nothing on the server reads that counter, so it is skipped there; the geometry itself is still recorded for server-side layout such as the minimap.
