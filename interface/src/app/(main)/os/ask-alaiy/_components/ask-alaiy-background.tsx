import Image from "next/image";

import { cn } from "@/lib/utils";

export function AskAlaiyBackground({ className }: { readonly className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      <Image
        src="/wave.svg"
        alt=""
        width={700}
        height={700}
        className="max-w-none ml-96 rotate-45 opacity-15 dark:opacity-20"
      />
    </div>
  );
}
