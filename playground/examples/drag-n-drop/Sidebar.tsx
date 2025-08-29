export function Sidebar() {
  const onDragStart = (event: DragEvent, nodeType: string) => {
    if (!event.dataTransfer) {
      return null;
    }

    event.dataTransfer.setData("application/solidflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside
      style={{
        width: "20vw",
        background: "#f4f4f4",
        padding: "0.4rem 0.8rem",
        "font-size": "12px",
      }}
    >
      <div style={{ margin: "0.5rem 0 0.25rem 0" }}>
        You can drag these nodes to the pane on the left.
      </div>
      <div
        style={{
          "margin-bottom": "0.5rem",
          border: "1px solid #111",
          padding: "0.5rem 1rem",
          "font-weight": "700",
          "border-radius": "3px",
          cursor: "grab",
        }}
        onDragStart={(event) => onDragStart(event, "input")}
        draggable={true}
      >
        Input Node
      </div>
      <div
        style={{
          "margin-bottom": "0.5rem",
          border: "1px solid #111",
          padding: "0.5rem 1rem",
          "font-weight": "700",
          "border-radius": "3px",
          cursor: "grab",
        }}
        onDragStart={(event) => onDragStart(event, "default")}
        draggable={true}
      >
        Default Node
      </div>
      <div
        style={{
          "margin-bottom": "0.5rem",
          border: "1px solid #111",
          padding: "0.5rem 1rem",
          "font-weight": "700",
          "border-radius": "3px",
          cursor: "grab",
        }}
        onDragStart={(event) => onDragStart(event, "output")}
        draggable={true}
      >
        Output Node
      </div>
    </aside>
  );
}
