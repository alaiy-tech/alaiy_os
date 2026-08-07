// Server-only: reads the bench site URL. Never import this from a "use client" module.
export function getFrappeUrl(): string {
  const url = process.env.FRAPPE_URL;
  if (!url) {
    throw new Error(
      "FRAPPE_URL is not set. Copy interface/.env.example to interface/.env.local and " +
        "point it at your bench's site URL (e.g. http://your-site.localhost:8000).",
    );
  }
  return url.replace(/\/+$/, "");
}
