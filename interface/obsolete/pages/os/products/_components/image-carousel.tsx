"use client";

import { useState } from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { ITEM_IMAGE_REFERRER_POLICY } from "@/constants/products";
import { cn } from "@/lib/utils";

/** Single image renders plainly; 2+ get prev/next controls and dot
 * indicators, hover-revealed so a dense grid doesn't look cluttered. */
export function ImageCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const validImages = images.filter((src): src is string => Boolean(src));

  if (validImages.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-muted text-muted-foreground text-xs">
        No image
      </div>
    );
  }

  return (
    <div className="group relative aspect-square w-full overflow-hidden bg-muted">
      <img
        src={validImages[index]}
        alt={alt}
        referrerPolicy={ITEM_IMAGE_REFERRER_POLICY}
        className="size-full object-cover"
      />
      {validImages.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={(event) => {
              event.stopPropagation();
              setIndex((i) => (i - 1 + validImages.length) % validImages.length);
            }}
            className="absolute inset-y-0 left-0 flex w-8 items-center justify-center bg-gradient-to-r from-black/30 to-transparent text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={(event) => {
              event.stopPropagation();
              setIndex((i) => (i + 1) % validImages.length);
            }}
            className="absolute inset-y-0 right-0 flex w-8 items-center justify-center bg-gradient-to-l from-black/30 to-transparent text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="absolute bottom-1.5 flex w-full items-center justify-center gap-1">
            {validImages.map((src, i) => (
              <span key={src} className={cn("size-1.5 rounded-full bg-white/60", i === index && "bg-white")} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
