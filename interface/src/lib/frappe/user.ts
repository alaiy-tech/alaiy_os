export type FrappeUser = {
  id: string;
  fullName: string;
  email: string;
  avatar: string;
};

export type UserProfileFields = {
  full_name?: string;
  email?: string;
  user_image?: string;
};

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

export const USER_PROFILE_FIELDS = ["full_name", "email", "user_image"] as const;
