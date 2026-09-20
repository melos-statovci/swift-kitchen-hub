import { useCallback, useEffect, useMemo, useState } from "react";
import type { MenuItem, MenuItemVariant } from "@/lib/types";
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

export type CreateVariantInput = {
  name: string;
  price: number;
  sortOrder: number;
  available: boolean;
};

export type UpdateVariantPatch = Partial<CreateVariantInput>;

type MenuListResponse = { items: MenuItem[] };
type MenuItemResponse = { item: MenuItem };
type VariantResponse = { variant: MenuItemVariant };

const sortVariants = (variants: MenuItemVariant[]) =>
  [...variants].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

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

  const createMenuItem = useCallback(async (input: CreateMenuItemInput): Promise<MenuItem> => {
    const data = await apiFetch<MenuItemResponse>("/api/menu", {
      method: "POST",
      auth: true,
      body: input,
    });
    const item = { ...data.item, variants: data.item.variants ?? [] };
    setItems((prev) => [...prev, item]);
    return item;
  }, []);

  const updateMenuItem = useCallback(
    async (id: string, patch: UpdateMenuItemPatch): Promise<MenuItem> => {
      const data = await apiFetch<MenuItemResponse>(`/api/menu/${id}`, {
        method: "PATCH",
        auth: true,
        body: patch,
      });
      let merged = data.item;
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== id) return it;
          merged = { ...it, ...data.item, variants: data.item.variants ?? it.variants };
          return merged;
        }),
      );
      return merged;
    },
    [],
  );

  const deleteMenuItem = useCallback(async (id: string): Promise<void> => {
    await apiFetch<void>(`/api/menu/${id}`, { method: "DELETE", auth: true });
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const createVariant = useCallback(
    async (menuItemId: string, input: CreateVariantInput): Promise<MenuItemVariant> => {
      const data = await apiFetch<VariantResponse>(`/api/menu/${menuItemId}/variants`, {
        method: "POST",
        auth: true,
        body: input,
      });
      setItems((prev) =>
        prev.map((item) =>
          item.id === menuItemId
            ? { ...item, variants: sortVariants([...item.variants, data.variant]) }
            : item,
        ),
      );
      return data.variant;
    },
    [],
  );

  const updateVariant = useCallback(
    async (
      menuItemId: string,
      variantId: string,
      patch: UpdateVariantPatch,
    ): Promise<MenuItemVariant> => {
      const data = await apiFetch<VariantResponse>(
        `/api/menu/${menuItemId}/variants/${variantId}`,
        { method: "PATCH", auth: true, body: patch },
      );
      setItems((prev) =>
        prev.map((item) =>
          item.id === menuItemId
            ? {
                ...item,
                variants: sortVariants(
                  item.variants.map((variant) =>
                    variant.id === variantId ? data.variant : variant,
                  ),
                ),
              }
            : item,
        ),
      );
      return data.variant;
    },
    [],
  );

  const deleteVariant = useCallback(
    async (menuItemId: string, variantId: string): Promise<void> => {
      await apiFetch<void>(`/api/menu/${menuItemId}/variants/${variantId}`, {
        method: "DELETE",
        auth: true,
      });
      setItems((prev) =>
        prev.map((item) =>
          item.id === menuItemId
            ? { ...item, variants: item.variants.filter((variant) => variant.id !== variantId) }
            : item,
        ),
      );
    },
    [],
  );

  return {
    items: sortedItems,
    loading,
    loadError,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    createVariant,
    updateVariant,
    deleteVariant,
  };
}
