import { Construction } from "lucide-react";

export default function ComingSoonPage({ title, doctype }: { title: string; doctype?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
        <Construction className="size-6 text-primary" />
      </div>
      <h1 className="font-serif text-2xl font-bold text-foreground">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This screen is coming soon.
        {doctype && (
          <>
            {" "}
            It will read and write the <span className="font-medium text-foreground">{doctype}</span> doctype once built.
          </>
        )}
      </p>
    </div>
  );
}
