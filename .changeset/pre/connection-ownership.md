---
"@dschz/solid-flow": patch
---

Breaking: completed connections are no longer written into a controlled edges store. In 0.2.x the flow inserted the connected edge into your store before `onConnect` fired. Your store now owns membership: the connection reaches you only through `onConnect`, and adopting it (pushing it into your store, as the README's Quick Start does) is what makes it exist; an unadopted connection is dropped and does not render. Uncontrolled flows (`defaultEdges`) keep the 0.2.x behavior: the flow owns membership and inserts the edge itself.
