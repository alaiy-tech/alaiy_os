/**
 * How a preference is persisted client-side alongside the DB write every
 * mode but `"none"` also gets - see `lib/preferences/preferences-config.ts`'s
 * module doc comment for the full picture. A standalone type (not derived
 * from `PREFERENCE_REGISTRY`), so it lives here rather than in that file -
 * unlike `PreferenceKey`/`PreferenceValueMap`, which stay in
 * `preferences-config.ts` because they're `keyof`/mapped-type derivations of
 * `PREFERENCE_REGISTRY` itself and moving them out would just re-import the
 * registry back in, without actually separating anything.
 */
export type PreferencePersistence = "none" | "client-cookie" | "server-cookie" | "localStorage";
