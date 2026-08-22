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

/** What `loginWithFrappe` (`lib/frappe/auth.ts`) resolves with on success. */
export type FrappeLoginResult = {
  message: string;
  full_name?: string;
  home_page?: string;
};
