---
"@dschz/solid-flow": patch
---

`fitView` works for every flow mounted under a `SolidFlowProvider`, not just the first. The provider's state outlives each `<SolidFlow>`, and a later flow fitted as soon as its pan-zoom mounted, before any of its own nodes was measured: an empty fit that left the `initialViewport` in place, and with `maxZoom={Infinity}` drew a frame with an infinite zoom (a `NaN` minimap and background pattern). Unmounting a `<SolidFlow>` under a `SolidFlowProvider` also clears the provider state's DOM node and destroys the pan/zoom controller, so a provider that outlives its flow no longer keeps the detached canvas DOM alive.
