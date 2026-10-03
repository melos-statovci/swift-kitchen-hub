import { useCallback, useEffect, useMemo, useState } from "react";
import type { Category } from "@/lib/types";
import { apiFetch, ApiError, NetworkError } from "@/lib/api";

type CategoriesResponse = { categories: Category[] };
type CategoryResponse = { category: Category };

/**
 * Admin category management. The list is the public ordered set; mutations hit
 * the admin endpoints. Reorder is done by swapping sortOrder with a neighbor.
 */
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const retry = useCallback(() => setLoadVersion((version) => version + 1), []);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    setLoading(true);
    setLoadError(null);

    apiFetch<CategoriesResponse>("/api/categories", { signal: ac.signal })
      .then((data) => {
        if (cancelled) return;
        setCategories(data.categories);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled || ac.signal.aborted) return;
        if (err instanceof NetworkError) setLoadError("Could not reach the server.");
        else if (err instanceof ApiError) setLoadError(err.message);
        else setLoadError("Failed to load categories.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [loadVersion]);

  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  const createCategory = useCallback(async (name: string): Promise<Category> => {
    const data = await apiFetch<CategoryResponse>("/api/categories", {
      method: "POST",
      auth: true,
      body: { name: name.trim() },
    });
    setCategories((prev) => [...prev, data.category]);
    return data.category;
  }, []);

  const renameCategory = useCallback(async (id: string, name: string): Promise<Category> => {
    const data = await apiFetch<CategoryResponse>(`/api/categories/${id}`, {
      method: "PATCH",
      auth: true,
      body: { name: name.trim() },
    });
    setCategories((prev) => prev.map((c) => (c.id === id ? data.category : c)));
    return data.category;
  }, []);

  const deleteCategory = useCallback(async (id: string): Promise<void> => {
    await apiFetch<void>(`/api/categories/${id}`, { method: "DELETE", auth: true });
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Swap a category's order with its up/down neighbour (persists both).
  const moveCategory = useCallback(
    async (id: string, direction: "up" | "down"): Promise<void> => {
      const ordered = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = ordered.findIndex((c) => c.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return;

      const a = ordered[idx];
      const b = ordered[swapIdx];
      // Optimistic swap.
      setCategories((prev) =>
        prev.map((c) =>
          c.id === a.id
            ? { ...c, sortOrder: b.sortOrder }
            : c.id === b.id
              ? { ...c, sortOrder: a.sortOrder }
              : c,
        ),
      );
      try {
        await Promise.all([
          apiFetch(`/api/categories/${a.id}`, {
            method: "PATCH",
            auth: true,
            body: { sortOrder: b.sortOrder },
          }),
          apiFetch(`/api/categories/${b.id}`, {
            method: "PATCH",
            auth: true,
            body: { sortOrder: a.sortOrder },
          }),
        ]);
      } catch (err) {
        // Roll back on failure.
        setCategories((prev) =>
          prev.map((c) =>
            c.id === a.id
              ? { ...c, sortOrder: a.sortOrder }
              : c.id === b.id
                ? { ...c, sortOrder: b.sortOrder }
                : c,
          ),
        );
        throw err;
      }
    },
    [categories],
  );

  return {
    categories: sorted,
    loading,
    loadError,
    retry,
    createCategory,
    renameCategory,
    deleteCategory,
    moveCategory,
  };
}
