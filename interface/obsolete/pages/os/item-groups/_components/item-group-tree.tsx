"use client";

import { useState } from "react";

import type { TreeInstance } from "@headless-tree/core";
import { Plus } from "lucide-react";

import { Button } from "@/components/primitive/button";
import { Tree, TreeItem, TreeItemLabel } from "@/components/primitive/tree";
import type { ItemGroupNode } from "@/lib/frappe/item-group";

/** Runs a row action without letting the click reach the row's own
 * expand/collapse handler underneath it. */
function rowAction(run: () => void) {
  return (e: React.MouseEvent) => {
    e.stopPropagation();
    run();
  };
}

export function ItemGroupTreeView({
  tree,
  rootName,
  onAddChild,
  onEdit,
  onRename,
  onDelete,
}: {
  readonly tree: TreeInstance<ItemGroupNode>;
  readonly rootName: string;
  readonly onAddChild: (node: ItemGroupNode) => void;
  readonly onEdit: (node: ItemGroupNode) => void;
  readonly onRename: (node: ItemGroupNode) => void;
  readonly onDelete: (node: ItemGroupNode, parentName: string) => void;
}) {
  // tree.getItems() reads live state off a mutable instance with a stable
  // reference, so React Compiler would memoize the mapped rows against a
  // dependency that never changes - freezing the list at the empty array the
  // async data loader returns on first render. See ItemGroupsView.
  "use no memo";

  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <Tree indent={20} tree={tree} className="rounded-lg border p-2">
      {tree.getItems().map((item) => {
        const node = item.getItemData();
        const isRoot = item.getId() === rootName;
        const isSelected = selectedId === item.getId();

        return (
          <TreeItem key={item.getId()} item={item} asChild>
            <div>
              <div className="flex items-center justify-between gap-2">
                <TreeItemLabel
                  className="min-w-0 flex-1 cursor-pointer"
                  // Only selection here. Expand/collapse is already wired up by
                  // TreeItem, which spreads headless-tree's own item.getProps()
                  // onClick onto the row - and this click bubbles up to it.
                  // Toggling here as well ran both handlers per click, which
                  // cancelled out and made folders look unexpandable.
                  onClick={() =>
                    setSelectedId((prev) =>
                      prev === item.getId() ? null : item.getId(),
                    )
                  }
                >
                  <span className="truncate">
                    {node?.name ?? item.getItemName()}
                  </span>
                </TreeItemLabel>

                {isSelected && !isRoot && (
                  // Every action below stops propagation: these buttons sit
                  // inside the row, so otherwise each click would also reach
                  // the row's expand/collapse handler (see TreeItem).
                  <div className="flex flex-none items-center gap-1 pr-1">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={rowAction(() => onEdit(node))}
                    >
                      Edit
                    </Button>
                    {node?.is_group ? (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={rowAction(() => onAddChild(node))}
                      >
                        <Plus className="size-3" />
                        Add Child
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={rowAction(() => onRename(node))}
                    >
                      Rename
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={rowAction(() =>
                        onDelete(node, item.getParent()?.getId() ?? rootName),
                      )}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </TreeItem>
        );
      })}
    </Tree>
  );
}
