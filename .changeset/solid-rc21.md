---
"@dschz/solid-flow": patch
---

Requires solid-js / @solidjs/web `2.0.0-rc.21` or newer (the peer ranges were `^2.0.0-rc.13`). solid-flow is built and tested against rc.21. rc.14 and rc.15 halt a flow that adds a node and selects it inside an open action (solidjs/solid#4137), and stop re-running an effect that caught `NotReadyError` from an async node or edge store once it loads (solidjs/solid#4070). Both are fixed in rc.16.
