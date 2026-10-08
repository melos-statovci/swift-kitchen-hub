import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Category } from "@/lib/types";
import { apiFetch, ApiError, NetworkError } from "@/lib/api";

import { createCategoryMover, sortCategories } from "@/lib/categoryOrder";

type CategoriesResponse = { categories: Category[] };
type CategoryResponse = { category: Category };

/**
 * Admin category management. The list is the public ordered set; mutations hit
 * the admin endpoints. Reorder uses one complete atomic backend operation.
 */
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [reorderPending, setReorderPending] = useState(false);
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
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

  const sorted = useMemo(() => sortCategories(categories), [categories]);

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

  const moveCategory = useMemo(
    () =>
      createCategoryMover({
        read: () => categoriesRef.current,
        apply: setCategories,
        pending: setReorderPending,
        request: (body) =>
          apiFetch<CategoriesResponse>("/api/categories/order", {
            method: "PATCH",
            auth: true,
            body,
          }),
        reload: () => apiFetch<CategoriesResponse>("/api/categories"),
      }),
    [],
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
    reorderPending,
  };
}
