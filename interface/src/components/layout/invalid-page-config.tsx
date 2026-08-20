/** A config file exists at this route but failed schema validation (or has
 * duplicate node ids) - distinct from `ComingSoon` (no config at all, which
 * is the ordinary state for an unbuilt page). Shows the validation errors
 * themselves (useful to whoever is authoring the config) but never a raw
 * filesystem path or stack trace. */
export function InvalidPageConfig({ errors }: { errors: string[] }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <h1 className="font-semibold text-2xl text-destructive">This page's configuration is invalid.</h1>
      <ul className="max-w-md list-disc space-y-1 text-left text-muted-foreground text-sm">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}
