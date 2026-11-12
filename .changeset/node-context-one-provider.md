---
"@dschz/solid-flow": patch
---

Each node provides its id and connectable state through one context instead of two, which saves a provider (a root and two computeds) per node: about 8 MB less heap on mount at 10k nodes.
