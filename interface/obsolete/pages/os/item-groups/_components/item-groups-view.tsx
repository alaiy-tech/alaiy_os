"use client";

import { useState } from "react";

import {
  asyncDataLoaderFeature,
  expandAllFeature,
  hotkeysCoreFeature,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { ChevronsDownUp, ChevronsUpDown, Plus } from "lucide-react";

import { Button } from "@/components/primitive/button";
import {
  getItemGroupChildren,
  type ItemGroupNode,
} from "@/lib/frappe/item-group";

import { DeleteItemGroupDialog } from "./delete-item-group-dialog";
import { ItemGroupFormDialog } from "./item-group-form-dialog";
import { ItemGroupTreeView } from "./item-group-tree";
import { RenameItemGroupDialog } from "./rename-item-group-dialog";

type DialogState =
  | { kind: "none" }
  | { kind: "create"; parentName: string; parentLabel: string }
  | { kind: "edit"; node: ItemGroupNode }
  | { kind: "rename"; name: string }
  | { kind: "delete"; name: string; parentName: string };

export function ItemGroupsView({ rootName }: { readonly rootName: string }) {
  // useTree() hands back one mutable instance whose identity never changes -
  // it re-renders by mutating itself and bumping internal state. React
  // Compiler keys its memo cache on reference identity, so it would cache the
  // <ItemGroupTreeView> element on first render and React would then bail out
  // of ever re-rendering the subtree, leaving the async-loaded tree
  // permanently empty. Opt this component out of compilation.
  "use no memo";

  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });

  const tree = useTree<ItemGroupNode>({
    rootItemId: rootName,
    getItemName: (item) => item.getItemData()?.name ?? "",
    isItemFolder: (item) => Boolean(item.getItemData()?.is_group),
    dataLoader: {
      getItem: (itemId) => ({ name: itemId, is_group: 1 }),
      getChildrenWithData: async (itemId) => {
        const children = await getItemGroupChildren(itemId, false);
        return children.map((c) => ({ id: c.name, data: c }));
      },
    },
    indent: 20,
    features: [asyncDataLoaderFeature, hotkeysCoreFeature, expandAllFeature],
  });

  function closeDialog() {
    setDialog({ kind: "none" });
  }

  function invalidateChildren(parentName: string) {
    tree.getItemInstance(parentName)?.invalidateChildrenIds();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => tree.expandAll()}
          aria-label="Expand all"
          title="Expand all"
        >
          <ChevronsUpDown />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => tree.collapseAll()}
          aria-label="Collapse all"
          title="Collapse all"
        >
          <ChevronsDownUp />
        </Button>
        <Button
          onClick={() =>
            setDialog({
              kind: "create",
              parentName: rootName,
              parentLabel: rootName,
            })
          }
        >
          <Plus />
          New Item Group
        </Button>
      </div>

      <ItemGroupTreeView
        tree={tree}
        rootName={rootName}
        onAddChild={(node) =>
          setDialog({
            kind: "create",
            parentName: node.name,
            parentLabel: node.name,
          })
        }
        onEdit={(node) => setDialog({ kind: "edit", node })}
        onRename={(node) => setDialog({ kind: "rename", name: node.name })}
        onDelete={(node, parentName) =>
          setDialog({ kind: "delete", name: node.name, parentName })
        }
      />

      {dialog.kind === "create" && (
        <ItemGroupFormDialog
          open
          onOpenChange={(open) => !open && closeDialog()}
          mode={{
            kind: "create",
            parentName: dialog.parentName,
            parentLabel: dialog.parentLabel,
          }}
          onSaved={invalidateChildren}
        />
      )}

      {dialog.kind === "edit" && (
        <ItemGroupFormDialog
          open
          onOpenChange={(open) => !open && closeDialog()}
          mode={{ kind: "edit", node: dialog.node }}
          onSaved={() =>
            tree.getItemInstance(dialog.node.name)?.invalidateItemData()
          }
        />
      )}

      {dialog.kind === "rename" && (
        <RenameItemGroupDialog
          open
          onOpenChange={(open) => !open && closeDialog()}
          currentName={dialog.name}
          onRenamed={(oldName) => {
            const parent = tree.getItemInstance(oldName)?.getParent()?.getId();
            if (parent) invalidateChildren(parent);
          }}
        />
      )}

      {dialog.kind === "delete" && (
        <DeleteItemGroupDialog
          open
          onOpenChange={(open) => !open && closeDialog()}
          name={dialog.name}
          onDeleted={() => {
            invalidateChildren(dialog.parentName);
            closeDialog();
          }}
        />
      )}
    </div>
  );
}
