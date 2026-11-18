---
"@dschz/solid-flow": patch
---

Requires solid-js / @solidjs/web `2.0.0` or newer, the stable release (the peer ranges were `^2.0.0-rc.13`). solid-flow is built and tested against 2.0.0, which carries the fix for solidjs/solid#4782, filed from this library: from rc.14 through rc.21 a 10,000-node flow took about 17 s to mount instead of about 2 s. Since rc.22 a `ref` callback runs inside the pass that creates its element and a development build refuses a computation created there; solid-flow now wires its node, edge, handle, resize-control and label elements from the component body, so development builds on 2.0 no longer halt on mount (`PRIMITIVE_IN_EFFECT_CALLBACK`). `@solid-primitives/event-listener` moves to its stable 3.0.0, whose server build allocates an owner per listener: the pane no longer creates its listeners on the server, so hydration keys keep lining up.
