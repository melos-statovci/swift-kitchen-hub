import { useCallback, useEffect, useMemo, useState } from "react";
import type { MenuItem } from "@/lib/types";
import { apiFetch, ApiError, NetworkError } from "@/lib/api";

export type CreateMenuItemInput = {
  name: string;
  description: string | null;
  price: number | null; // cents
  variantMode: "NONE" | "REQUIRED";
  category: string; // category slug
  imageUrl: string | null;
  available: boolean;
};

export type UpdateMenuItemPatch = Partial<CreateMenuItemInput>;

export type SaveVariantInput = {
  id?: string;
  name: string;
  price: number;
  sortOrder: number;
  available: boolean;
};

type MenuListResponse = { items: MenuItem[] };
type MenuItemResponse = { item: MenuItem };

/**
 * Admin menu management. Mirrors useUsers(): initial fetch of the full
 * (non-archived) list including unavailable items, plus optimistic
 * create/update/delete against the admin menu endpoints.
 */
export function useMenuItems() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    setLoading(true);
    setLoadError(null);

    apiFetch<MenuListResponse>("/api/menu/all", { auth: true, signal: ac.signal })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled || ac.signal.aborted) return;
        if (err instanceof NetworkError) {
          setLoadError("Could not reach the server.");
        } else if (err instanceof ApiError) {
          setLoadError(err.message);
        } else {
          setLoadError("Failed to load menu.");
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  // Group-friendly ordering: category, then name.
  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
      ),
    [items],
  );

  const createMenuItem = useCallback(
    async (input: CreateMenuItemInput, variants: SaveVariantInput[]): Promise<MenuItem> => {
      const data = await apiFetch<MenuItemResponse>("/api/menu/aggregate", {
        method: "POST",
        auth: true,
        body: { ...input, variants },
      });
      const item = { ...data.item, variants: data.item.variants ?? [] };
      setItems((prev) => [...prev, item]);
      return item;
    },
    [],
  );

  const updateMenuItem = useCallback(
    async (
      id: string,
      patch: CreateMenuItemInput,
      variants: SaveVariantInput[],
      expectedUpdatedAt: string,
    ): Promise<MenuItem> => {
      const data = await apiFetch<MenuItemResponse>(`/api/menu/${id}/aggregate`, {
        method: "PATCH",
        auth: true,
        body: { ...patch, variants, expectedUpdatedAt },
      });
      const updated = { ...data.item, variants: data.item.variants ?? [] };
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      return updated;
    },
    [],
  );

  const patchMenuItem = useCallback(
    async (id: string, patch: UpdateMenuItemPatch): Promise<MenuItem> => {
      const data = await apiFetch<MenuItemResponse>(`/api/menu/${id}`, {
        method: "PATCH",
        auth: true,
        body: patch,
      });
      const updated = { ...data.item, variants: data.item.variants ?? [] };
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      return updated;
    },
    [],
  );

  const deleteMenuItem = useCallback(async (id: string): Promise<void> => {
    await apiFetch<void>(`/api/menu/${id}`, { method: "DELETE", auth: true });
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  return {
    items: sortedItems,
    loading,
    loadError,
    createMenuItem,
    updateMenuItem,
    patchMenuItem,
    deleteMenuItem,
  };
}
