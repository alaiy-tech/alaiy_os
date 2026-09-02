"use client";

import { useState } from "react";

import { ImageOff } from "lucide-react";

import { ITEM_IMAGE_REFERRER_POLICY } from "@/constants/products";
import { cn } from "@/lib/utils";

/** Where the pointer is over the frame, in percent, or null when it has left.
 * Doubles as the "is the image zoomed" flag so one piece of state drives both. */
type ZoomOrigin = { x: number; y: number } | null;

function EmptyFrame() {
  return (
    <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/40">
      <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
        <ImageOff className="size-4 text-muted-foreground" />
      </div>
      <span className="text-muted-foreground text-sm">No image on this item.</span>
    </div>
  );
}

/**
 * The item's photos: one large frame, magnified under the pointer, over a strip
 * of thumbnails.
 *
 * Zoom is a `transform: scale` with the pointer's position as the transform
 * origin, so it costs no second request - the same file is scaled up. Item
 * images are frequently a supplier's own CDN URL rather than a file on this
 * site (see ITEM_IMAGE_REFERRER_POLICY), so there is no high-resolution variant
 * to swap in even where the browser would fetch one.
 *
 * The strip scrolls sideways rather than wrapping: a template with thirty
 * variants would otherwise push the whole sticky column past the viewport and
 * take its own scroll away.
 */
export function ItemGallery({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<ZoomOrigin>(null);

  if (images.length === 0) return <EmptyFrame />;

  // Clamped rather than trusted: the strip and the frame read the same state,
  // and an item whose gallery shrinks between renders (a variant deleted) would
  // otherwise index past the end and render a blank frame.
  const active = images[Math.min(index, images.length - 1)];

  return (
    <div className="flex flex-col gap-3">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer-only
          enhancement. The magnifier reveals nothing that is not already on
          screen at 1x, so there is no information a keyboard or touch user is
          shut out of and no interactive role that would honestly describe it. */}
      <div
        className="relative aspect-square w-full cursor-zoom-in overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10"
        onMouseMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          setZoom({
            x: ((event.clientX - box.left) / box.width) * 100,
            y: ((event.clientY - box.top) / box.height) * 100,
          });
        }}
        onMouseLeave={() => setZoom(null)}
      >
        <img
          src={active}
          alt={alt}
          referrerPolicy={ITEM_IMAGE_REFERRER_POLICY}
          className="size-full object-cover transition-transform duration-100"
          style={zoom ? { transform: "scale(1.8)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
        />
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, position) => (
            <button
              key={image}
              type="button"
              onClick={() => setIndex(position)}
              aria-label={`Show image ${position + 1} of ${images.length}`}
              aria-current={image === active}
              className={cn(
                "size-14 shrink-0 overflow-hidden rounded-md ring-1 transition-colors duration-100",
                image === active ? "ring-2 ring-primary" : "ring-border hover:ring-foreground/30",
              )}
            >
              <img
                src={image}
                alt=""
                loading="lazy"
                referrerPolicy={ITEM_IMAGE_REFERRER_POLICY}
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
