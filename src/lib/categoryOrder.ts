import type { Category } from "./types.ts";
export type CategoryOrderRequest = {
  expectedOrder: { id: string; sortOrder: number }[];
  order: { id: string; sortOrder: number }[];
};
export function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
export function buildCategoryMove(
  categories: Category[],
  id: string,
  direction: "up" | "down",
): CategoryOrderRequest | null {
  const ordered = sortCategories(categories),
    index = ordered.findIndex((c) => c.id === id);
  const next = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || next < 0 || next >= ordered.length) return null;
  const expectedOrder = ordered.map(({ id, sortOrder }) => ({ id, sortOrder }));
  [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
  return { expectedOrder, order: ordered.map((c, sortOrder) => ({ id: c.id, sortOrder })) };
}
export function createCategoryMover(options: {
  read: () => Category[];
  apply: (categories: Category[]) => void;
  pending: (value: boolean) => void;
  request: (body: CategoryOrderRequest) => Promise<{ categories: Category[] }>;
  reload: () => Promise<{ categories: Category[] }>;
}) {
  let inFlight = false;
  return async (id: string, direction: "up" | "down"): Promise<void> => {
    if (inFlight) return;
    const body = buildCategoryMove(options.read(), id, direction);
    if (!body) return;
    inFlight = true;
    options.pending(true);
    const before = options.read(),
      byId = new Map(before.map((c) => [c.id, c]));
    options.apply(body.order.map((c) => ({ ...byId.get(c.id)!, sortOrder: c.sortOrder })));
    try {
      options.apply((await options.request(body)).categories);
    } catch (error) {
      try {
        options.apply((await options.reload()).categories);
      } catch {
        options.apply(before);
      }
      throw error;
    } finally {
      inFlight = false;
      options.pending(false);
    }
  };
}
