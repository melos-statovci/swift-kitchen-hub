import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, MoreHorizontal, Plus, Search, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RequireRole } from "@/components/RequireRole";
import { MenuFormDialog } from "@/components/admin/MenuFormDialog";
import { DeleteMenuItemDialog } from "@/components/admin/DeleteMenuItemDialog";
import { CategoryManager } from "@/components/admin/CategoryManager";
import {
  useMenuItems,
  type CreateMenuItemInput,
  type SaveVariantInput,
} from "@/hooks/useMenuItems";
import { useCategories } from "@/hooks/useCategories";
import { formatCurrency } from "@/lib/format";
import type { MenuItem } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/menu")({
  component: () => (
    <RequireRole route="admin">
      <MenuDashboard />
    </RequireRole>
  ),
});

type DialogState =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; item: MenuItem }
  | { kind: "delete"; item: MenuItem };

function MenuDashboard() {
  const {
    items,
    loading,
    loadError,
    createMenuItem,
    updateMenuItem,
    patchMenuItem,
    deleteMenuItem,
  } = useMenuItems();
  const {
    categories,
    loading: categoriesLoading,
    loadError: categoriesError,
    retry: retryCategories,
    createCategory,
    renameCategory,
    deleteCategory,
    moveCategory,
  } = useCategories();
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [availabilityPending, setAvailabilityPending] = useState<Set<string>>(new Set());

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput), 200);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const categoryName = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? slug;

  const itemCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items) m[it.category] = (m[it.category] ?? 0) + 1;
    return m;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || categoryName(i.category).toLowerCase().includes(q),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, categories]);

  const close = () => setDialog({ kind: "none" });

  const handleCreate = async (values: CreateMenuItemInput, variants: SaveVariantInput[]) => {
    const created = await createMenuItem(values, variants);
    toast.success(`Added ${created.name}`);
    return created;
  };

  const handleUpdate = async (
    id: string,
    values: CreateMenuItemInput,
    variants: SaveVariantInput[],
    expectedUpdatedAt: string,
  ) => {
    const updated = await updateMenuItem(id, values, variants, expectedUpdatedAt);
    toast.success("Menu item updated");
    return updated;
  };

  const handleToggleAvailable = async (item: MenuItem) => {
    if (availabilityPending.has(item.id)) return;
    setAvailabilityPending((pending) => new Set(pending).add(item.id));
    try {
      await patchMenuItem(item.id, { available: !item.available });
      toast.success(`${item.name} is now ${item.available ? "unavailable" : "available"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update availability");
    } finally {
      setAvailabilityPending((pending) => {
        const next = new Set(pending);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleDelete = async (id: string) => {
    await deleteMenuItem(id);
    toast.success("Item removed from the menu.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Menu</h1>
        <p className="text-sm text-muted-foreground">
          Add, edit, and organize dishes. Changes go live on the customer site.
        </p>
      </div>

      <Tabs defaultValue="items" className="space-y-6">
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        {/* ---- Items ---- */}
        <TabsContent value="items" className="space-y-6">
          {categoriesError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm"
            >
              <p>
                Categories unavailable: {categoriesError} Item editing is unavailable until
                categories load.
              </p>
              <Button variant="outline" onClick={retryCategories} disabled={categoriesLoading}>
                Retry categories
              </Button>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name or category"
                className="pl-9"
                aria-label="Search menu"
              />
            </div>
            <Button
              onClick={() => setDialog({ kind: "create" })}
              disabled={
                loading || categoriesLoading || !!categoriesError || categories.length === 0
              }
            >
              <Plus className="h-4 w-4" />
              Add item
            </Button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Loading menu…</p>
            </div>
          ) : loadError ? (
            <div role="alert" className="space-y-3 text-center py-20 text-destructive">
              <p>{loadError}</p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry menu
              </Button>
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              onAdd={() => setDialog({ kind: "create" })}
              canAdd={categories.length > 0}
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-center">Available</TableHead>
                      <TableHead className="w-12 text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((item) => (
                      <TableRow key={item.id} className={item.available ? "" : "opacity-60"}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{categoryName(item.category)}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.variantMode === "REQUIRED"
                            ? `${item.variants.length} variant${item.variants.length === 1 ? "" : "s"}`
                            : formatCurrency(item.price ?? 0)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={item.available}
                            disabled={availabilityPending.has(item.id)}
                            onCheckedChange={() => handleToggleAvailable(item)}
                            aria-label={`Toggle availability for ${item.name}`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Actions for ${item.name}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                disabled={categoriesLoading || !!categoriesError}
                                onSelect={() => setDialog({ kind: "edit", item })}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => setDialog({ kind: "delete", item })}
                                className="text-destructive focus:text-destructive"
                              >
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {filtered.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">
                  No items match "{search}".
                </p>
              )}
            </>
          )}
        </TabsContent>

        {/* ---- Categories ---- */}
        <TabsContent value="categories">
          {categoriesLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Loading categories…</p>
            </div>
          ) : categoriesError ? (
            <div
              role="alert"
              className="space-y-3 rounded-md border border-destructive/20 bg-destructive/5 p-6 text-center"
            >
              <p className="text-sm text-destructive">{categoriesError}</p>
              <Button variant="outline" onClick={retryCategories}>
                Retry categories
              </Button>
            </div>
          ) : loadError ? (
            <div
              role="alert"
              className="space-y-3 rounded-md border border-destructive/20 bg-destructive/5 p-6 text-center"
            >
              <p className="text-sm">
                Menu item counts are unavailable. Reload the menu before managing categories.
              </p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry menu
              </Button>
            </div>
          ) : (
            <CategoryManager
              categories={categories}
              itemCounts={itemCounts}
              onCreate={createCategory}
              onRename={renameCategory}
              onMove={moveCategory}
              onDelete={deleteCategory}
            />
          )}
        </TabsContent>
      </Tabs>

      <MenuFormDialog
        mode={dialog.kind === "edit" ? "edit" : "create"}
        open={dialog.kind === "create" || dialog.kind === "edit"}
        onOpenChange={(v) => !v && close()}
        item={dialog.kind === "edit" ? dialog.item : null}
        categories={categories}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />
      <DeleteMenuItemDialog
        open={dialog.kind === "delete"}
        onOpenChange={(v) => !v && close()}
        item={dialog.kind === "delete" ? dialog.item : null}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function EmptyState({ onAdd, canAdd }: { onAdd: () => void; canAdd: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold">No menu items yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {canAdd ? "Add your first dish to get started." : "Add a category first, then add dishes."}
      </p>
      {canAdd && (
        <Button className="mt-4" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Add item
        </Button>
      )}
    </div>
  );
}
