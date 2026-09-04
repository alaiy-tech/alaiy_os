import { contributedProducts } from "./contributed-products";
import type { ProductExtension } from "./product-extension-types";

/**
 * The single Products-screen extension the table actually consults.
 *
 * Usually there are none (a plain base deployment) or one (a client app that
 * reshapes `Item`). More than one is legal but not the case this is designed
 * for, so the merge rule is the same precedence everything else in composition
 * uses — install order, last app wins — applied per capability rather than
 * wholesale, so an app that only contributes quick filters does not blank out
 * another's status rule.
 *
 * `quickFilters` concatenate instead, since two apps adding a filter each is the
 * one case where both answers are wanted at once.
 */
function merge(extensions: ProductExtension[]): ProductExtension {
  return extensions.reduce<ProductExtension>(
    (acc, next) => ({
      app: next.app,
      defaultColumns: next.defaultColumns ?? acc.defaultColumns,
      requiredFields: [...(acc.requiredFields ?? []), ...(next.requiredFields ?? [])],
      status: next.status ?? acc.status,
      hasChildren: next.hasChildren ?? acc.hasChildren,
      loadChildren: next.loadChildren ?? acc.loadChildren,
      childrenEmptyMessage: next.childrenEmptyMessage ?? acc.childrenEmptyMessage,
      quickFilters: [...(acc.quickFilters ?? []), ...(next.quickFilters ?? [])],
    }),
    { app: "" },
  );
}

/**
 * Null on a base deployment, which every consumer reads as "behave as before".
 *
 * Resolved once at module scope rather than per render: `contributedProducts` is
 * a generated constant and cannot change while the app is running.
 */
export const productExtension: ProductExtension | null = resolve();

function resolve(): ProductExtension | null {
  if (contributedProducts.length === 0) return null;
  if (contributedProducts.length === 1) return contributedProducts[0];
  return merge(contributedProducts);
}
