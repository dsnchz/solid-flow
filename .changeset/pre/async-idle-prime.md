---
"@dschz/solid-flow": patch
---

Idle priming of the selection views no longer throws while an async-seeded nodes or edges store is still pending. The prime runs on a plain timer with no reactive owner, so on a slow first load (data arriving after the browser's first idle callback) the read escaped as an uncaught NotReadyError. It now probes through `isPending`, which primes when the graph is ready and stays quiet otherwise.
