import "server-only";
import { backend } from "@/lib/backend/client";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";
import type {
  ListingHealth,
  ListingsPage,
  ProductGroupDetail,
  UnlinkedPage,
} from "@/lib/product-groups/types";
import type { ChannelId } from "@/lib/backend/types";

/**
 * The Listings tab's reads and writes.
 *
 * One physical product, however many channels sell it. The shapes come from
 * `lib/product-groups/types` rather than from `backend/types` because the
 * Inventory tab reads the same vocabulary — a product group is one idea, and
 * two copies of it would drift the first time one tab learned something the
 * other did not.
 *
 * None of these takes a workspace. The backend derives it from the session and
 * offers no parameter to name another seller's, which matters more here than
 * on a read-only tab: `link` merges two products' stock figures, so a call
 * that could name someone else's product would merge two sellers' catalogues.
 */

const BASE = "/api/method/alaiy_os_self_serve_apis.api.listings";

const OVERVIEW = `${BASE}.overview`;
const UNLINKED = `${BASE}.unlinked`;
const GROUP = `${BASE}.group`;
const LINK = `${BASE}.link`;
const MARK_EXCLUSIVE = `${BASE}.mark_exclusive`;
const UNLINK = `${BASE}.unlink`;
const REBUILD = `${BASE}.rebuild`;

/** Matches api/listings.py's PAGE_SIZE. The backend caps anything larger. */
export const PAGE_SIZE = 50;

export type ListingsQuery = {
  health?: ListingHealth;
  channel?: ChannelId;
  category?: string;
  start?: number;
  limit?: number;
};

/** The unlinked queue's own query. Only the channel filter applies to it. */
export type UnlinkedQuery = {
  channel?: ChannelId;
  start?: number;
  limit?: number;
};

/**
 * An empty page, for the failure path.
 *
 * `sample: false` deliberately. The banner that says "these figures are made
 * up" renders off that flag, and a failed read is not sample data — showing
 * that banner over an outage would misdescribe both.
 */
const EMPTY: ListingsPage = {
  sample: false,
  groups: [],
  total: 0,
  start: 0,
  limit: PAGE_SIZE,
  categories: [],
};

const EMPTY_UNLINKED: UnlinkedPage = {
  rows: [],
  total: 0,
  start: 0,
  limit: PAGE_SIZE,
};

/**
 * Fills in the paging fields if the backend did not send them.
 *
 * For one deploy only: a backend without the paged endpoints answers the old
 * shape, and `total: undefined` reaches the pager as NaN rather than as an
 * error. These two apps deploy together, so this is insurance against the order
 * they are merged in, not a contract.
 */
function paged<T extends { total?: number; start?: number; limit?: number }>(page: T): T {
  return {
    ...page,
    total: page.total ?? 0,
    start: page.start ?? 0,
    limit: page.limit || PAGE_SIZE,
  };
}

export type ListingsResult = { page: ListingsPage; error?: string };

/**
 * One page of product groups, worst health first.
 *
 * Filtering, ordering and paging all happen on the backend rather than here.
 * This tab used to read the whole catalogue in one go — defensible for a
 * comparison table, and fine until a seller had a real catalogue, at which
 * point the read cost a full product scan plus a suggestion computed for every
 * unlinked product against every other one. The filter belongs with the data
 * regardless, so the category list and the filtered set cannot disagree.
 *
 * The unlinked queue is a separate read; see `loadUnlinked`.
 *
 * Returns its failure rather than throwing, like every other reader here: a
 * listings outage should cost the seller this table, not the shell around it.
 */
export async function loadListings(
  query: ListingsQuery = {},
  userToken?: string,
): Promise<ListingsResult> {
  try {
    const page = await backend.get<ListingsPage | null>(OVERVIEW, {
      query: {
        health: query.health,
        channel: query.channel,
        category: query.category,
        start: query.start ?? 0,
        limit: query.limit ?? PAGE_SIZE,
      },
      userToken,
    });
    return { page: page ? paged(page) : EMPTY };
  } catch (error) {
    return { page: EMPTY, error: userFacingError(error, OUR_FAULT) };
  }
}

export type UnlinkedResult = { page: UnlinkedPage; error?: string };

/**
 * One page of the products no group has claimed, each with its suggestion.
 *
 * Its own call rather than a field on the overview, because it is the half of
 * this tab that costs something: every row carries a match computed at read
 * time, so the price is the number of rows scored times the size of the
 * catalogue. Asking for fifty keeps that proportional to the screen, and
 * paging the groups table above no longer recomputes any of it.
 *
 * Fails on its own too. The queue going down should not cost the seller the
 * comparison table, which is the part they came for.
 */
export async function loadUnlinked(
  query: UnlinkedQuery = {},
  userToken?: string,
): Promise<UnlinkedResult> {
  try {
    const page = await backend.get<UnlinkedPage | null>(UNLINKED, {
      query: {
        channel: query.channel,
        start: query.start ?? 0,
        limit: query.limit ?? PAGE_SIZE,
      },
      userToken,
    });
    return { page: page ? paged(page) : EMPTY_UNLINKED };
  } catch (error) {
    return { page: EMPTY_UNLINKED, error: userFacingError(error, OUR_FAULT) };
  }
}

export type GroupResult =
  | { group: ProductGroupDetail; error?: undefined }
  | { group?: undefined; error: string };

/**
 * One product group, both channels, for the side-by-side view.
 *
 * A separate call rather than a find() over the list, because the URL is
 * shareable: `?group=` can name a product the current filters exclude, and a
 * link that opened an empty panel because of a filter the recipient inherited
 * would be baffling.
 */
export async function loadGroup(
  groupId: string,
  userToken?: string,
): Promise<GroupResult> {
  try {
    const group = await backend.get<ProductGroupDetail | null>(GROUP, {
      query: { group_id: groupId },
      userToken,
    });
    if (!group) return { error: "That product could not be found." };
    return { group };
  } catch (error) {
    return { error: userFacingError(error, OUR_FAULT) };
  }
}

/**
 * Join two channel listings into one product.
 *
 * `confidence` is what the matcher scored, passed back when a person is
 * confirming a suggestion rather than picking by hand. The backend stores the
 * difference, which is what would let someone re-examine the machine-suggested
 * links — and move the threshold — if they later prove wrong.
 *
 * Throws rather than swallowing. Unlike the reads, a failed write must not
 * look like it worked: the caller is a Server Action that turns this into a
 * message beside the row.
 */
export async function linkProducts(
  productId: string,
  counterpartId: string,
  confidence: number | undefined,
  userToken?: string,
): Promise<{ group_id: string }> {
  return backend.post<{ group_id: string }>(
    LINK,
    { product_id: productId, counterpart_id: counterpartId, confidence },
    { userToken },
  );
}

/** Record that a product is sold on one channel on purpose. */
export async function markExclusive(
  productId: string,
  userToken?: string,
): Promise<{ group_id: string }> {
  return backend.post<{ group_id: string }>(
    MARK_EXCLUSIVE,
    { product_id: productId },
    { userToken },
  );
}

/**
 * Undo a join.
 *
 * A barcode-matched group comes straight back on the next sync, which is
 * correct rather than a bug: the barcodes still say it is one product, and the
 * place to fix that is the barcode. Worth knowing before wiring this to a
 * button that promises to be permanent.
 */
export async function unlinkGroup(
  groupId: string,
  userToken?: string,
): Promise<void> {
  await backend.post(UNLINK, { group_id: groupId }, { userToken });
}

/** Re-run the automatic joining now instead of waiting for the next sync. */
export async function rebuildGroups(
  userToken?: string,
): Promise<Record<string, number>> {
  return backend.post<Record<string, number>>(REBUILD, {}, { userToken });
}
