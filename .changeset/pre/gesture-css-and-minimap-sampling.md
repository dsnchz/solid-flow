---
"@dschz/solid-flow": patch
---

Breaking (custom CSS): handles no longer get the `connectionindicator` class. The possible-target handle styling during a connection is derived from root-level classes in CSS; target `.solid-flow.connecting .solid-flow__handle.connectable.connectableend` (see the handle styles) instead.
