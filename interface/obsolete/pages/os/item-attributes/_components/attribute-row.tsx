"use client";

import { ChevronRight, Trash2 } from "lucide-react";

import { Badge } from "@/components/primitive/badge";
import { Button } from "@/components/primitive/button";
import { TooltipWrap } from "@/components/primitive/tooltip-wrap";
import { formatAttributeRange } from "@/lib/item-attributes";
import { cn } from "@/lib/utils";
import type {
  ItemAttributeRow,
  ItemAttributeValue,
} from "@/types/item-attributes";

import { AttributeValueChips } from "./attribute-value-chips";

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function AttributeRow({
  attribute,
  isExpanded,
  onToggle,
  onValuesChange,
  onDelete,
}: {
  readonly attribute: ItemAttributeRow;
  readonly isExpanded: boolean;
  readonly onToggle: () => void;
  readonly onValuesChange: (values: ItemAttributeValue[]) => void;
  readonly onDelete: () => void;
}) {
  const isNumeric = Boolean(attribute.numeric_values);

  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={isExpanded}
        >
          <ChevronRight
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              isExpanded && "rotate-90",
            )}
          />
          <span className="truncate font-medium text-sm">
            {attribute.attribute_name}
          </span>
          {Boolean(attribute.disabled) && (
            <Badge variant="outline" className="text-muted-foreground">
              Disabled
            </Badge>
          )}
          {isNumeric && <Badge variant="outline">Numeric</Badge>}
        </button>

        <span className="hidden w-28 shrink-0 text-right text-muted-foreground text-sm sm:block">
          {isNumeric ? "Range" : plural(attribute.values.length, "value")}
        </span>
        <span className="w-24 shrink-0 text-right text-muted-foreground text-sm">
          {plural(attribute.usage_count, "item")}
        </span>

        {/* Stays clickable even when the attribute is in use: a disabled
            button fires no pointer events, so its tooltip could never explain
            why it is disabled. The dialog says so instead, and names the
            count. */}
        <TooltipWrap label={`Delete ${attribute.attribute_name}`}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            aria-label={`Delete ${attribute.attribute_name}`}
          >
            <Trash2 />
          </Button>
        </TooltipWrap>
      </div>

      {isExpanded && (
        <div className="bg-muted/30 px-4 py-3 pl-10">
          {isNumeric ? (
            <p className="text-muted-foreground text-sm">
              Values come from the range {formatAttributeRange(attribute)}. Edit
              it in ERPNext.
            </p>
          ) : (
            <AttributeValueChips
              attribute={attribute.name}
              values={attribute.values}
              onValuesChange={onValuesChange}
            />
          )}
        </div>
      )}
    </div>
  );
}
