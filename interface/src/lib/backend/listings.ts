import "server-only";
import { backend } from "@/lib/backend/client";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";
import type {
  ListingHealth,
  ListingsPage,
  ProductGroupDetail,
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
const GROUP = `${BASE}.group`;
const LINK = `${BASE}.link`;
const MARK_EXCLUSIVE = `${BASE}.mark_exclusive`;
const UNLINK = `${BASE}.unlink`;
const REBUILD = `${BASE}.rebuild`;

export type ListingsQuery = {
  health?: ListingHealth;
  channel?: ChannelId;
  category?: string;
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
  unlinked: [],
  categories: [],
};

export type ListingsResult = { page: ListingsPage; error?: string };

/**
 * Every product group, plus the products no group has claimed.
 *
 * Filtering happens on the backend rather than here. The seller's catalogue is
 * one page with no paging on this tab — a deliberate simplification, since the
 * table is a comparison rather than a ledger — but the filter still belongs
 * with the data so the category list and the filtered set cannot disagree.
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
      },
      userToken,
    });
    return { page: page ?? EMPTY };
  } catch (error) {
    return { page: EMPTY, error: userFacingError(error, OUR_FAULT) };
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
