import "server-only";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

/**
 * A redirect out of a Route Handler, built on this app's own public origin.
 *
 * Deliberately not `new URL(path, request.url)`. Next does not derive
 * `request.url` from the forwarded `Host` header: without
 * `experimental.trustHostHeader` it builds an absolute URL out of the address
 * the server itself listens on — see the `initUrl` in
 * next/dist/server/lib/router-utils/resolve-routes.js. Behind nginx that is
 * loopback, so the `Location` a Route Handler sends is
 * http://localhost:3000/start and the seller's browser leaves the deployment
 * on the way out of Sign out.
 *
 * The redirects in proxy.ts get away with the same pattern only because the
 * middleware adapter relativises a Location whose origin matches the request's
 * before it goes out (next/dist/server/web/adapter.js). A Route Handler's
 * response is sent exactly as written, so it has to name the origin itself.
 *
 * APP_URL is the right thing to name it with rather than a header: devbench
 * resolves it per environment (lib/interface.py, `app_origin`), it is already
 * what the OAuth redirect URIs are built from, and unlike a `Host` header it
 * cannot be set by whoever is making the request.
 */
export function redirectTo(path: string, init?: ResponseInit): NextResponse {
  return NextResponse.redirect(new URL(path, env.appUrl), init);
}
