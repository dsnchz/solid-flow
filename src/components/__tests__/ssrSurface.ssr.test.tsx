import { Loading, renderToString } from "@solidjs/web";
import { Position } from "@xyflow/system";
import { describe, expect, it } from "vitest";

import { createNodeStore } from "@/core";
import {
  Background,
  BaseEdge,
  Controls,
  type EdgeProps,
  MiniMap,
  type NodeProps,
  NodeResizer,
  NodeToolbar,
  SolidFlow,
} from "@/index";
import type { Edge, Node } from "@/types";

// The server-rendering contract beyond the basic render (SolidFlow.ssr.test):
// what each part of the surface produces with no DOM, no measurement and no
// pan-zoom instance. Every test here pins something the README promises or
// a limitation it documents.

const makeNode = (overrides: Partial<Node> & { id: string }): Node => ({
  position: { x: 0, y: 0 },
  data: { label: `node-${overrides.id}` },
  width: 100,
  height: 40,
  ...overrides,
});

const edge = (id: string, source: string, target: string): Edge => ({ id, source, target });

// Declared handle geometry (React Flow 12's SSR contract): with no DOM the
// flow cannot measure handles, so edges can only be laid out from these.
const withHandles = (node: Node, type: "source" | "target", position: Position): Node => ({
  ...node,
  handles: [
    {
      type,
      position,
      x: position === Position.Right ? 100 : 0,
      y: 20,
      width: 6,
      height: 6,
    },
  ],
});

const edgeMarkup = (html: string, id: string) =>
  html.match(
    new RegExp(`<svg[^>]*solid-flow__edge-wrapper[^>]*><g data-id="${id}"[\\s\\S]*?</svg>`),
  )?.[0];

describe("edges on the server", () => {
  it("renders an edge path when the nodes declare their handles", () => {
    const html = renderToString(() => (
      <SolidFlow
        nodes={[
          withHandles(makeNode({ id: "a" }), "source", Position.Right),
          withHandles(makeNode({ id: "b", position: { x: 300, y: 0 } }), "target", Position.Left),
        ]}
        edges={[edge("e1", "a", "b")]}
        width={800}
        height={600}
      />
    ));
    const g = edgeMarkup(html, "e1");
    expect(g).toBeDefined();
    // from the source handle's right edge (100 + 6, 20 + 3) to the target
    // handle's left edge (300, 23) — the same geometry the client lays out
    expect(g).toMatch(/\sd="M106,23 /);
    // and visible: no viewport has culled it (nothing is measured yet)
    expect(g).not.toContain("visibility:hidden");
  });

  it("renders no edge without declared handles (there is nothing to lay it out from)", () => {
    const html = renderToString(() => (
      <SolidFlow
        nodes={[makeNode({ id: "a" }), makeNode({ id: "b", position: { x: 300, y: 0 } })]}
        edges={[edge("e1", "a", "b")]}
        width={800}
        height={600}
      />
    ));
    expect(html).toContain('data-id="a"');
    expect(edgeMarkup(html, "e1")).toBeUndefined();
  });

  it("renders a custom edge component through the same path", () => {
    const LabelEdge = (props: EdgeProps) => (
      <BaseEdge
        id={props.id}
        path={`M${props.sourceX},${props.sourceY} L${props.targetX},${props.targetY}`}
        class="custom-edge"
      />
    );
    const html = renderToString(() => (
      <SolidFlow
        nodes={[
          withHandles(makeNode({ id: "a" }), "source", Position.Right),
          withHandles(makeNode({ id: "b", position: { x: 300, y: 0 } }), "target", Position.Left),
        ]}
        edges={[{ ...edge("e1", "a", "b"), type: "label" }]}
        edgeTypes={{ label: LabelEdge }}
        width={800}
        height={600}
      />
    ));
    expect(edgeMarkup(html, "e1")).toContain("custom-edge");
  });
});

describe("plugins on the server", () => {
  const plugins = () =>
    renderToString(() => (
      <SolidFlow
        nodes={[makeNode({ id: "a" }), makeNode({ id: "b", position: { x: 300, y: 0 } })]}
        edges={[]}
        width={800}
        height={600}
      >
        <Background />
        <Controls />
        <MiniMap />
      </SolidFlow>
    ));

  it("renders the Background pattern and the Controls", () => {
    const html = plugins();
    expect(html).toContain("solid-flow__background");
    expect(html).toContain("solid-flow__controls");
  });

  it("renders the MiniMap with one shape per node (no pan-zoom instance needed)", () => {
    const html = plugins();
    expect(html).toContain("solid-flow__minimap-svg");
    expect(html.match(/solid-flow__minimap-node/g)).toHaveLength(2);
  });

  it("renders NodeResizer controls inside a custom node", () => {
    const ResizableNode = (props: NodeProps) => (
      <>
        <NodeResizer isVisible />
        <span>{String(props.data.label)}</span>
      </>
    );
    const html = renderToString(() => (
      <SolidFlow
        nodes={[makeNode({ id: "a", type: "resizable" })]}
        edges={[]}
        nodeTypes={{ resizable: ResizableNode }}
        width={800}
        height={600}
      />
    ));
    expect(html).toContain("solid-flow__resize-control");
    expect(html).toContain("node-a");
  });

  it("does not render NodeToolbar on the server (it portals into the mounted flow)", () => {
    const ToolbarNode = (props: NodeProps) => (
      <>
        <NodeToolbar nodeId={props.id} isVisible>
          <button>tool</button>
        </NodeToolbar>
        <span>{String(props.data.label)}</span>
      </>
    );
    const html = renderToString(() => (
      <SolidFlow
        nodes={[makeNode({ id: "a", type: "tb" })]}
        edges={[]}
        nodeTypes={{ tb: ToolbarNode }}
        width={800}
        height={600}
      />
    ));
    expect(html).toContain("node-a");
    expect(html).not.toContain("solid-flow__node-toolbar");
  });
});

describe("flow options on the server", () => {
  it("puts the color mode class in the markup", () => {
    const html = renderToString(() => (
      <SolidFlow
        nodes={[makeNode({ id: "a" })]}
        edges={[]}
        width={800}
        height={600}
        colorMode="dark"
      />
    ));
    expect(html).toMatch(/class="solid-flow [^"]*\bdark\b/);
  });

  it("renders every node under onlyRenderVisibleElements (no viewport to cull against)", () => {
    const html = renderToString(() => (
      <SolidFlow
        nodes={[makeNode({ id: "a" }), makeNode({ id: "far", position: { x: 50000, y: 50000 } })]}
        edges={[]}
        width={800}
        height={600}
        onlyRenderVisibleElements
      />
    ));
    expect(html).toContain('data-id="a"');
    expect(html).toContain('data-id="far"');
  });

  it("renders a custom node component", () => {
    const Card = (props: NodeProps) => <div class="card">{String(props.data.label)}</div>;
    const html = renderToString(() => (
      <SolidFlow
        nodes={[makeNode({ id: "a", type: "card" })]}
        edges={[]}
        nodeTypes={{ card: Card }}
        width={800}
        height={600}
      />
    ));
    expect(html).toMatch(/class="card"[^>]*>node-a/);
  });
});

describe("async-seeded stores on the server", () => {
  it("holds the Loading boundary while the seed is pending", () => {
    const [nodes] = createNodeStore(() => new Promise<Node[]>(() => undefined));
    const html = renderToString(() => (
      <Loading fallback={<div data-testid="loading">loading graph</div>}>
        <SolidFlow nodes={nodes} edges={[]} width={800} height={600} />
      </Loading>
    ));
    expect(html).toContain('data-testid="loading"');
    expect(html).not.toContain("solid-flow__node");
  });
});
