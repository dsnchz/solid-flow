---
"@dschz/solid-flow": patch
---

A flow prop passed as an explicit `undefined` now keeps the flow's default. A wrapper that forwards its own optional props (`minZoom={props.minZoom}`) used to override the defaults whenever its caller left one out: `minZoom` became `undefined` instead of 0.5, `colorMode` resolved to nothing and dropped the theme class, and so on. This applies to `<SolidFlow>`, `<SolidFlowProvider>` and the headless flow state.
