import type { ProductExtension } from "./product-extension-types";

/**
 * Products-screen extensions contributed by the Frappe apps installed alongside
 * the base.
 *
 * GENERATED FILE — the deployment composer overwrites it with an import of the
 * `extensions.products` module each contributing app declares in its
 * `interface/interface.config.json`. It ships empty in `alaiy_os`, which is what
 * keeps the base client-agnostic: the screen consumes whatever is in this list
 * without knowing which app supplied it, exactly as it does with
 * `contributed-nav.ts`.
 *
 * Do not hand-edit in a composed workspace — the next compose overwrites it.
 * Do not add entries here in `alaiy_os` itself; base-owned behaviour belongs in
 * the screen, not in a contribution.
 */
export const contributedProducts: ProductExtension[] = [];
