import { describe, expect, it } from "vitest";

import { applyUIAction, findNode } from "@/runtime/mutations";
import type { UIPageDefinition } from "@/types/runtime/page";

function fixture(): UIPageDefinition {
  return {
    id: "page",
    kind: "page",
    children: [
      {
        id: "root",
        kind: "layout",
        type: "stack",
        children: [
          {
            id: "header",
            kind: "component",
            type: "os-page-header",
            props: { title: "Dashboard" },
          },
          {
            id: "row",
            kind: "layout",
            type: "grid",
            columns: { base: 1, xl: 12 },
            children: [
              {
                id: "kpi-a",
                kind: "component",
                type: "os-kpi",
                props: { title: "A" },
              },
              {
                id: "kpi-b",
                kind: "component",
                type: "os-kpi",
                props: { title: "B" },
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("applyUIAction", () => {
  it("REMOVE_COMPONENT removes the node and returns a new, immutable definition", () => {
    const original = fixture();
    const snapshot = JSON.parse(JSON.stringify(original));

    const next = applyUIAction(original, {
      type: "REMOVE_COMPONENT",
      componentId: "kpi-a",
    });

    expect(findNode(next, "kpi-a")).toBeUndefined();
    expect(findNode(next, "kpi-b")).toBeDefined();
    // the input is byte-for-byte untouched
    expect(original).toEqual(snapshot);
    expect(next).not.toBe(original);
  });

  it("REMOVE_COMPONENT is a no-op (returns an equivalent definition) for an unknown id", () => {
    const original = fixture();
    const next = applyUIAction(original, {
      type: "REMOVE_COMPONENT",
      componentId: "does-not-exist",
    });
    expect(next).toEqual(original);
  });

  it("ADD_COMPONENT inserts a new node under the given parent, at the given index", () => {
    const original = fixture();
    const next = applyUIAction(original, {
      type: "ADD_COMPONENT",
      parentId: "row",
      node: {
        id: "kpi-c",
        kind: "component",
        type: "os-kpi",
        props: { title: "C" },
      },
      index: 1,
    });

    const row = findNode(next, "row");
    expect(row && "children" in row ? row.children.map((child) => child.id) : []).toEqual(["kpi-a", "kpi-c", "kpi-b"]);
    // original definition is untouched
    expect(findNode(original, "kpi-c")).toBeUndefined();
  });

  it("ADD_COMPONENT is a no-op for an unknown parentId", () => {
    const original = fixture();
    const next = applyUIAction(original, {
      type: "ADD_COMPONENT",
      parentId: "does-not-exist",
      node: {
        id: "kpi-c",
        kind: "component",
        type: "os-kpi",
        props: { title: "C" },
      },
    });

    expect(next).toEqual(original);
    expect(findNode(next, "kpi-c")).toBeUndefined();
  });

  it("ADD_COMPONENT is a no-op when parentId is not a layout container", () => {
    const original = fixture();
    const next = applyUIAction(original, {
      type: "ADD_COMPONENT",
      parentId: "header",
      node: {
        id: "kpi-c",
        kind: "component",
        type: "os-kpi",
        props: { title: "C" },
      },
    });

    expect(next).toEqual(original);
    expect(findNode(next, "kpi-c")).toBeUndefined();
  });

  it("MOVE_COMPONENT relocates a node from one parent to another, immutably, without touching unrelated siblings", () => {
    const original = fixture();
    const snapshot = JSON.parse(JSON.stringify(original));

    const next = applyUIAction(original, {
      type: "MOVE_COMPONENT",
      componentId: "kpi-a",
      newParentId: "root",
      index: 0,
    });

    const root = findNode(next, "root");
    expect(root && "children" in root ? root.children[0].id : undefined).toBe("kpi-a");
    const row = findNode(next, "row");
    expect(row && "children" in row ? row.children.map((child) => child.id) : []).toEqual(["kpi-b"]);

    // the untouched "header" sibling keeps its exact object identity
    const nextRoot = findNode(next, "root");
    if (nextRoot && "children" in nextRoot) {
      const nextHeader = nextRoot.children.find((child) => child.id === "header");
      expect(nextHeader).toBe(findNode(original, "header"));
    }

    // the input is byte-for-byte untouched and the output is a new object
    expect(original).toEqual(snapshot);
    expect(next).not.toBe(original);
  });

  it("MOVE_COMPONENT reorders a node within its own parent", () => {
    const original = fixture();
    const next = applyUIAction(original, {
      type: "MOVE_COMPONENT",
      componentId: "kpi-a",
      newParentId: "row",
      index: 1,
    });

    const row = findNode(next, "row");
    expect(row && "children" in row ? row.children.map((child) => child.id) : []).toEqual(["kpi-b", "kpi-a"]);
    // the sibling that didn't move keeps its exact object identity
    const originalKpiB = findNode(original, "kpi-b");
    const nextKpiB = findNode(next, "kpi-b");
    expect(nextKpiB).toBe(originalKpiB);
  });

  it("MOVE_COMPONENT is a no-op (does not lose the node) for an unknown newParentId", () => {
    const original = fixture();
    const next = applyUIAction(original, {
      type: "MOVE_COMPONENT",
      componentId: "kpi-a",
      newParentId: "does-not-exist",
    });

    expect(next).toEqual(original);
    expect(findNode(next, "kpi-a")).toBeDefined();
  });

  it("MOVE_COMPONENT is a no-op when newParentId is not a layout container (e.g. a component node)", () => {
    const original = fixture();
    const next = applyUIAction(original, {
      type: "MOVE_COMPONENT",
      componentId: "kpi-a",
      newParentId: "header",
    });

    expect(next).toEqual(original);
    expect(findNode(next, "kpi-a")).toBeDefined();
  });

  it("MOVE_COMPONENT is a no-op when moving a node into itself", () => {
    const original = fixture();
    const next = applyUIAction(original, {
      type: "MOVE_COMPONENT",
      componentId: "row",
      newParentId: "row",
    });

    expect(next).toEqual(original);
  });

  it("MOVE_COMPONENT is a no-op when moving a node into its own descendant (cycle guard)", () => {
    const original = fixture();
    // "row" contains "kpi-a" - moving "row" to become a child of "kpi-a" would
    // otherwise have removeFromTree delete "row" (and "kpi-a" along with it)
    // before the insert ever runs, silently losing both.
    const next = applyUIAction(original, {
      type: "MOVE_COMPONENT",
      componentId: "row",
      newParentId: "kpi-a",
    });

    expect(next).toEqual(original);
    expect(findNode(next, "row")).toBeDefined();
    expect(findNode(next, "kpi-a")).toBeDefined();
  });

  it("UPDATE_COMPONENT patches a node's props/layout without touching its identity elsewhere", () => {
    const original = fixture();
    const next = applyUIAction(original, {
      type: "UPDATE_COMPONENT",
      componentId: "kpi-b",
      patch: { props: { title: "Renamed" } },
    });

    const updated = findNode(next, "kpi-b");
    expect(updated && "props" in updated ? updated.props : undefined).toEqual({
      title: "Renamed",
    });
    // the root node itself is rebuilt (the patch is nested inside it), but its
    // untouched "header" child keeps its exact object identity
    const originalRoot = original.children[0];
    const nextRoot = next.children[0];
    expect(originalRoot).not.toBe(nextRoot);
    if ("children" in originalRoot && "children" in nextRoot) {
      expect(originalRoot.children[0]).toBe(nextRoot.children[0]); // "header" node, unrelated to the patch
    }
  });
});
