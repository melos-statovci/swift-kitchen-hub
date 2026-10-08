import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Category } from "@/lib/types";

type Props = {
  categories: Category[];
  itemCounts: Record<string, number>; // slug -> count of (non-archived) items
  onCreate: (name: string) => Promise<unknown>;
  onRename: (id: string, name: string) => Promise<unknown>;
  onMove: (id: string, direction: "up" | "down") => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
};

export function CategoryManager({
  categories,
  itemCounts,
  onCreate,
  onRename,
  onMove,
  onDelete,
}: Props) {
  const [moving, setMoving] = useState(false);
  const movingRef = useRef(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      await onCreate(name);
      setNewName("");
      toast.success(`Added "${name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add category");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setDraft(c.name);
  };

  const saveEdit = async (c: Category) => {
    const name = draft.trim();
    if (!name || name === c.name) {
      setEditingId(null);
      return;
    }
    try {
      await onRename(c.id, name);
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename category");
    }
  };

  const handleMove = async (id: string, dir: "up" | "down") => {
    if (movingRef.current) return;
    movingRef.current = true;
    setMoving(true);
    try {
      await onMove(id, dir);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder");
    } finally {
      movingRef.current = false;
      setMoving(false);
    }
  };

  const handleDelete = async (c: Category) => {
    try {
      await onDelete(c.id);
      toast.success(`Removed "${c.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove category");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          disabled={moving}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="New category name"
          className="max-w-xs"
          aria-label="New category name"
        />
        <Button onClick={handleAdd} disabled={moving || adding || !newName.trim()}>
          <Plus className="h-4 w-4" />
          Add category
        </Button>
      </div>

      <div className="rounded-md border border-border divide-y divide-border">
        {categories.map((c, i) => {
          const count = itemCounts[c.slug] ?? 0;
          const isEditing = editingId === c.id;
          return (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => handleMove(c.id, "up")}
                  disabled={moving || i === 0}
                  aria-label={`Move ${c.name} up`}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(c.id, "down")}
                  disabled={moving || i === categories.length - 1}
                  aria-label={`Move ${c.name} down`}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      disabled={moving}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(c);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      className="h-8 max-w-xs"
                      aria-label={`Rename ${c.name}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={moving}
                      onClick={() => saveEdit(c)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {count} item{count === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
              </div>

              {!isEditing && (
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={moving}
                    onClick={() => startEdit(c)}
                    aria-label={`Rename ${c.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(c)}
                    disabled={moving || count > 0}
                    title={
                      count > 0 ? "Move its items to another category first" : "Remove category"
                    }
                    aria-label={`Remove ${c.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {categories.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No categories yet. Add one above.
          </p>
        )}
      </div>
    </div>
  );
}
