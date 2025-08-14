import type { Node } from "@/types";

export type TextNodeType = Node<{ text: string }, "text">;
export type UppercaseNodeType = Node<{ text: string }, "uppercase">;
export type ResultNodeType = Node<Record<string, never>, "result">;

export function isTextNode(node: unknown): node is TextNodeType | UppercaseNodeType {
  return (
    node != null &&
    typeof node === "object" &&
    "type" in node &&
    (node.type === "text" || node.type === "uppercase")
  );
}

export type MyNode = TextNodeType | UppercaseNodeType | ResultNodeType;
