/** No config exists for this route yet - an ordinary, expected state for a
 * page nobody has created (same copy the old `os/[...not-found]/page.tsx`
 * showed for every not-yet-built sidebar link; this component replaces that
 * file). Not an error: rendered with a normal 200 inside the `/os` shell,
 * same as before. No "use client" here - nothing on this screen is
 * interactive, so it renders fine from the Server Component that now calls
 * it. */
export function ComingSoon() {
  return (
    <div className="flex h-full flex-col items-center justify-center space-y-2 text-center">
      <h1 className="font-semibold text-2xl">Page not found.</h1>
      <p className="text-muted-foreground">This section will be added in future updates.</p>
    </div>
  );
}
