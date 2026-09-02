"use client";

import { useCallback, useEffect, useState } from "react";

import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { getItemAttributes } from "@/lib/frappe/item-attribute";
import { normalizeValue } from "@/lib/item-attributes";
import type { ItemAttributeRow, ItemAttributeValue } from "@/types/item-attributes";

import { AttributeRow } from "./attribute-row";
import { CreateAttributeDialog } from "./create-attribute-dialog";
import { DeleteAttributeDialog } from "./delete-attribute-dialog";

type DialogState = { kind: "none" } | { kind: "create" } | { kind: "delete"; attribute: string; usageCount: number };

/** Attributes whose name or any value matches the search, and the names of
 * those matched only on a value — those get opened so the match is visible
 * without hunting for it. */
function search(attributes: ItemAttributeRow[], term: string) {
  const key = normalizeValue(term);
  if (!key) return { matches: attributes, matchedOnValue: [] as string[] };

  const matches: ItemAttributeRow[] = [];
  const matchedOnValue: string[] = [];

  for (const attribute of attributes) {
    const nameMatches = normalizeValue(attribute.attribute_name).includes(key);
    const valueMatches = attribute.values.some((value) => normalizeValue(value.attribute_value).includes(key));

    if (nameMatches || valueMatches) matches.push(attribute);
    if (!nameMatches && valueMatches) matchedOnValue.push(attribute.name);
  }

  return { matches, matchedOnValue };
}

export function ItemAttributesView() {
  const [attributes, setAttributes] = useState<ItemAttributeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });

  const load = useCallback(() => {
    setIsLoading(true);
    return getItemAttributes()
      .then((data) => {
        setAttributes(data);
        setLoadFailed(false);
      })
      .catch(() => {
        setAttributes([]);
        setLoadFailed(true);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleExpand(name: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function updateValues(name: string, values: ItemAttributeValue[]) {
    setAttributes((current) =>
      current.map((attribute) => (attribute.name === name ? { ...attribute, values } : attribute)),
    );
  }

  const { matches, matchedOnValue } = search(attributes, searchTerm);

  return (
    <>
      <Card className="gap-0 py-0">
        <CardHeader className="gap-2 border-b py-4 has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <InputGroup className="h-7 w-full md:w-64">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              className="h-7"
              placeholder="Search attributes and values..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </InputGroup>

          <CardAction className="self-center">
            <Button size="sm" onClick={() => setDialog({ kind: "create" })}>
              <Plus /> New Attribute
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="px-0">
          {isLoading && (
            <div className="flex flex-col gap-3 p-4">
              {[0, 1, 2, 3].map((row) => (
                <Skeleton key={row} className="h-8 w-full" />
              ))}
            </div>
          )}

          {!isLoading && loadFailed && (
            <Empty className="py-10">
              <EmptyTitle>Could not load attributes</EmptyTitle>
              <EmptyDescription>Make sure you&apos;re signed in, then try again.</EmptyDescription>
              <Button variant="outline" size="sm" onClick={() => void load()}>
                Retry
              </Button>
            </Empty>
          )}

          {!isLoading && !loadFailed && matches.length === 0 && (
            <Empty className="py-10">
              <EmptyTitle>{searchTerm ? "No matching attributes" : "No attributes yet"}</EmptyTitle>
              <EmptyDescription>
                {searchTerm
                  ? "Nothing here matches that search."
                  : "Create an attribute to start building item variants."}
              </EmptyDescription>
            </Empty>
          )}

          {!isLoading &&
            !loadFailed &&
            matches.map((attribute) => (
              <AttributeRow
                key={attribute.name}
                attribute={attribute}
                isExpanded={expandedIds.has(attribute.name) || matchedOnValue.includes(attribute.name)}
                onToggle={() => toggleExpand(attribute.name)}
                onValuesChange={(values) => updateValues(attribute.name, values)}
                onDelete={() =>
                  setDialog({ kind: "delete", attribute: attribute.name, usageCount: attribute.usage_count })
                }
              />
            ))}
        </CardContent>
      </Card>

      <CreateAttributeDialog
        open={dialog.kind === "create"}
        onOpenChange={(open) => !open && setDialog({ kind: "none" })}
        onCreated={() => void load()}
      />

      {dialog.kind === "delete" && (
        <DeleteAttributeDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: "none" })}
          attribute={dialog.attribute}
          usageCount={dialog.usageCount}
          onDeleted={() => void load()}
        />
      )}
    </>
  );
}
