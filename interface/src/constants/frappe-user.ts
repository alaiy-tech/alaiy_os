// Shared by the client-side (lib/frappe/auth.ts) and server-side
// (lib/frappe/server.ts) user lookups, so both request the same profile
// fields and produce the exact same FrappeUser shape (toFrappeUser).
export const USER_PROFILE_FIELDS = ["full_name", "email", "user_image"] as const;
