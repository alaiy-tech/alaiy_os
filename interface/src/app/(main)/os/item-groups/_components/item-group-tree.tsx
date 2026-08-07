"use client";

import { useState } from "react";

import type { TreeInstance } from "@headless-tree/core";
import { Plus } from "lucide-react";

import { Tree, TreeItem, TreeItemLabel } from "@/components/reui/tree";
import { Button } from "@/components/ui/button";
import type { ItemGroupNode } from "@/lib/frappe/item-group";

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
                  onClick={() => {
                    if (item.isFolder()) {
                      if (item.isExpanded()) item.collapse();
                      else item.expand();
                    }
                    setSelectedId((prev) => (prev === item.getId() ? null : item.getId()));
                  }}
                >
                  <span className="truncate">{node?.name ?? item.getItemName()}</span>
                </TreeItemLabel>

                {isSelected && !isRoot && (
                  <div className="flex flex-none items-center gap-1 pr-1">
                    <Button variant="outline" size="xs" onClick={() => onEdit(node)}>
                      Edit
                    </Button>
                    {node?.is_group ? (
                      <Button variant="outline" size="xs" onClick={() => onAddChild(node)}>
                        <Plus className="size-3" />
                        Add Child
                      </Button>
                    ) : null}
                    <Button variant="outline" size="xs" onClick={() => onRename(node)}>
                      Rename
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onDelete(node, item.getParent()?.getId() ?? rootName)}
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
