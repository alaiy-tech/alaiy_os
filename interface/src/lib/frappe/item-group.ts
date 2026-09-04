export type ItemGroupNode = {
  name: string;
  is_group: 0 | 1;
};

export class ItemGroupApiError extends Error {}

async function unwrapMessage<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok) {
    const message =
      (data as { message?: string; exc_type?: string }).message ??
      (data as { exc_type?: string }).exc_type ??
      "Request failed.";
    throw new ItemGroupApiError(message);
  }
  return (data as { message: T }).message;
}

export async function getItemGroupChildren(parent: string | undefined, isRoot: boolean): Promise<ItemGroupNode[]> {
  const params = new URLSearchParams();
  if (parent) params.set("parent", parent);
  params.set("is_root", String(isRoot));
  const res = await fetch(`/api/method/alaiy_os.api.item_group.get_children?${params.toString()}`);
  return unwrapMessage<ItemGroupNode[]>(res);
}

export async function createItemGroup(input: {
  item_group_name: string;
  parent_item_group: string;
  is_group: boolean;
}): Promise<ItemGroupNode> {
  const res = await fetch("/api/resource/Item Group", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      item_group_name: input.item_group_name,
      parent_item_group: input.parent_item_group,
      is_group: input.is_group ? 1 : 0,
    }),
  });
  const data = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok) {
    throw new ItemGroupApiError((data as { message?: string }).message ?? "Could not create the item group.");
  }
  return (data as { data: ItemGroupNode }).data;
}

export async function updateItemGroup(name: string, patch: { is_group: boolean }): Promise<void> {
  const res = await fetch(`/api/resource/Item Group/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_group: patch.is_group ? 1 : 0 }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as Record<string, unknown>);
    throw new ItemGroupApiError((data as { message?: string }).message ?? "Could not update the item group.");
  }
}

export async function renameItemGroup(oldName: string, newName: string, merge: boolean): Promise<string> {
  const res = await fetch("/api/method/frappe.client.rename_doc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doctype: "Item Group", old_name: oldName, new_name: newName, merge }),
  });
  return unwrapMessage<string>(res);
}

export async function deleteItemGroup(name: string): Promise<void> {
  const res = await fetch(`/api/resource/Item Group/${encodeURIComponent(name)}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as Record<string, unknown>);
    throw new ItemGroupApiError((data as { message?: string }).message ?? "Could not delete the item group.");
  }
}
