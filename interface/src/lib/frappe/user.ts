import type { FrappeUser, UserProfileFields } from "@/types/frappe-user";

// Shared by the client-side (auth.ts) and server-side (server.ts) lookups so
// both produce the exact same shape from Frappe's `User` doctype fields.
export function toFrappeUser(userId: string, fields: UserProfileFields | undefined): FrappeUser {
  return {
    id: userId,
    fullName: fields?.full_name ?? userId,
    email: fields?.email ?? userId,
    avatar: fields?.user_image ?? "",
  };
}
