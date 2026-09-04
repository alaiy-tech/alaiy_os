export type UserOption = { name: string; full_name: string };

const PAGE_LENGTH = 20;

/** Enabled users matching a typed term, for the agent Run As User picker.
 *
 * Excludes Administrator and Guest: Administrator is offered separately by
 * the picker itself (clearing run_as_user, not selecting a name), and Guest
 * can never legally be a run_as_user. An empty term returns the first page
 * unfiltered, so the dropdown has something to show before anyone types. */
export async function searchRunAsUsers(term: string): Promise<UserOption[]> {
  const query = new URLSearchParams();
  query.set("fields", JSON.stringify(["name", "full_name"]));
  query.set("order_by", "full_name asc");
  query.set("limit_page_length", String(PAGE_LENGTH));
  query.set(
    "filters",
    JSON.stringify([
      ["enabled", "=", 1],
      ["name", "not in", ["Administrator", "Guest"]],
    ]),
  );

  const trimmed = term.trim();
  if (trimmed) {
    query.set(
      "or_filters",
      JSON.stringify([
        ["full_name", "like", `%${trimmed}%`],
        ["name", "like", `%${trimmed}%`],
      ]),
    );
  }

  const res = await fetch(`/api/resource/User?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);

  const data = (await res.json()) as { data: UserOption[] };
  return data.data;
}
