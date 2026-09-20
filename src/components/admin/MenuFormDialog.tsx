import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category, MenuItem } from "@/lib/types";
import type { CreateMenuItemInput, SaveVariantInput } from "@/hooks/useMenuItems";
import { requiresExplicitFlatPrice } from "@/lib/menuPricing";

// `price` here is in EUROS (what the manager types); converted to cents on submit.
const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(1000).optional(),
  price: z.coerce
    .number({ invalid_type_error: "Enter a price" })
    .min(0, "Price can't be negative")
    .max(1000, "Price can't exceed €1,000"),
  variantMode: z.enum(["NONE", "REQUIRED"]),
  category: z.string().min(1, "Select a category"),
  imageUrl: z.string().trim().url("Enter a valid image URL").or(z.literal("")).optional(),
  available: z.boolean(),
});

type Values = z.infer<typeof schema>;

type VariantDraft = {
  id?: string;
  key: string;
  name: string;
  priceEuros: number;
  available: boolean;
};

export type MenuFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  item: MenuItem | null;
  categories: Category[];
  onCreate: (values: CreateMenuItemInput, variants: SaveVariantInput[]) => Promise<MenuItem>;
  onUpdate: (
    id: string,
    values: CreateMenuItemInput,
    variants: SaveVariantInput[],
    expectedUpdatedAt: string,
  ) => Promise<MenuItem>;
};

export function MenuFormDialog({
  open,
  onOpenChange,
  mode,
  item,
  categories,
  onCreate,
  onUpdate,
}: MenuFormDialogProps) {
  const isCreate = mode === "create";
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [requiresFlatPrice, setRequiresFlatPrice] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      variantMode: "NONE",
      category: "",
      imageUrl: "",
      available: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (isCreate || !item) {
      form.reset({
        name: "",
        description: "",
        price: 0,
        variantMode: "NONE",
        category: categories[0]?.slug ?? "",
        imageUrl: "",
        available: true,
      });
    } else {
      form.reset({
        name: item.name,
        description: item.description ?? "",
        price: (item.price ?? 0) / 100, // cents → euros for display
        variantMode: item.variantMode,
        category: item.category,
        imageUrl: item.imageUrl ?? "",
        available: item.available,
      });
    }
    setVariants(
      isCreate || !item
        ? []
        : item.variants.map((variant) => ({
            id: variant.id,
            key: variant.id,
            name: variant.name,
            priceEuros: variant.price / 100,
            available: variant.available,
          })),
    );
    setRequiresFlatPrice(false);
  }, [open, isCreate, item, categories, form]);

  const submit = async (values: Values) => {
    if (values.variantMode === "REQUIRED") {
      if (variants.length === 0 || !variants.some((variant) => variant.available)) {
        toast.error("Add at least one available variant.");
        return;
      }
      if (
        variants.some(
          (variant) =>
            !variant.name.trim() ||
            !Number.isFinite(variant.priceEuros) ||
            variant.priceEuros < 0 ||
            variant.priceEuros > 1000,
        )
      ) {
        toast.error("Every variant needs a name and a valid price.");
        return;
      }
    }

    if (values.variantMode === "NONE" && requiresFlatPrice) {
      toast.error("Enter the new flat price before saving.");
      return;
    }

    const payload: CreateMenuItemInput = {
      name: values.name.trim(),
      description: values.description?.trim() ? values.description.trim() : null,
      price: values.variantMode === "REQUIRED" ? null : Math.round(values.price * 100),
      variantMode: values.variantMode,
      category: values.category,
      imageUrl: values.imageUrl?.trim() ? values.imageUrl.trim() : null,
      available: values.available,
    };
    const variantPayload: SaveVariantInput[] =
      values.variantMode === "REQUIRED"
        ? variants.map((variant, sortOrder) => ({
            ...(variant.id ? { id: variant.id } : {}),
            name: variant.name.trim(),
            price: Math.round(variant.priceEuros * 100),
            sortOrder,
            available: variant.available,
          }))
        : [];
    try {
      if (isCreate) {
        await onCreate(payload, variantPayload);
      } else if (item) {
        await onUpdate(item.id, payload, variantPayload, item.updatedAt);
      } else {
        return;
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save menu item");
    }
  };

  const addVariant = () => {
    setVariants((current) => [
      ...current,
      {
        key: `new-${crypto.randomUUID()}`,
        name: "",
        priceEuros: 0,
        available: true,
      },
    ]);
  };

  const updateVariantDraft = (key: string, patch: Partial<VariantDraft>) => {
    setVariants((current) =>
      current.map((variant) => (variant.key === key ? { ...variant, ...patch } : variant)),
    );
  };

  const removeVariant = (variant: VariantDraft) => {
    setVariants((current) => current.filter((candidate) => candidate.key !== variant.key));
  };

  const moveVariant = (index: number, offset: -1 | 1) => {
    setVariants((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const variantMode = form.watch("variantMode");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isCreate ? "Add menu item" : "Edit menu item"}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Add a new dish to the menu. It goes live on the customer site immediately if available."
              : "Update this dish. Past orders keep the name and price they were placed with."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="variantMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pricing</FormLabel>
                  <Select
                    onValueChange={(nextMode: "NONE" | "REQUIRED") => {
                      if (requiresExplicitFlatPrice(field.value, nextMode)) {
                        form.setValue("price", undefined as never, {
                          shouldDirty: false,
                          shouldValidate: false,
                        });
                        setRequiresFlatPrice(true);
                      } else if (nextMode === "REQUIRED") {
                        setRequiresFlatPrice(false);
                      }
                      field.onChange(nextMode);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="NONE">One flat price</SelectItem>
                      <SelectItem value="REQUIRED">Customer chooses one variant</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Use variants for sizes such as E Vogël, E Mesme, and E Madhe. Existing variants
                    are retained if you switch back to a flat price.
                  </FormDescription>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {variantMode === "NONE" && (
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (€)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1000"
                          inputMode="decimal"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(event) => {
                            const nextPrice = event.target.value;
                            setRequiresFlatPrice(nextPrice === "");
                            field.onChange(nextPrice === "" ? undefined : nextPrice);
                          }}
                          placeholder={requiresFlatPrice ? "Enter new flat price" : undefined}
                        />
                      </FormControl>
                      {requiresFlatPrice && (
                        <FormDescription>
                          Enter a new flat price explicitly before saving this mode change.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.slug}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {variantMode === "REQUIRED" && (
              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Variants</div>
                    <div className="text-xs text-muted-foreground">
                      Order controls customer display order. Archived variants keep order history.
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>

                {variants.length === 0 ? (
                  <p className="rounded-md bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
                    Add at least one available variant before saving.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {variants.map((variant, index) => (
                      <div
                        key={variant.key}
                        className="grid grid-cols-[1fr_7rem_auto] items-center gap-2 rounded-md bg-muted/30 p-2"
                      >
                        <Input
                          value={variant.name}
                          onChange={(event) =>
                            updateVariantDraft(variant.key, { name: event.target.value })
                          }
                          placeholder="Variant name"
                          aria-label={`Variant ${index + 1} name`}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1000"
                          inputMode="decimal"
                          value={variant.priceEuros}
                          onChange={(event) =>
                            updateVariantDraft(variant.key, {
                              priceEuros: Number(event.target.value),
                            })
                          }
                          aria-label={`Variant ${index + 1} price in euros`}
                        />
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={variant.available}
                            onCheckedChange={(available) =>
                              updateVariantDraft(variant.key, { available })
                            }
                            aria-label={`Variant ${index + 1} available`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={index === 0}
                            onClick={() => moveVariant(index, -1)}
                            aria-label={`Move variant ${index + 1} up`}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={index === variants.length - 1}
                            onClick={() => moveVariant(index, 1)}
                            aria-label={`Move variant ${index + 1} down`}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeVariant(variant)}
                            aria-label={`Remove variant ${index + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://…" autoComplete="off" {...field} />
                  </FormControl>
                  <FormDescription>
                    Paste a link to a hosted image. Leave blank for no photo.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="available"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border border-border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Available</FormLabel>
                    <FormDescription>
                      When off, the item is hidden from the customer menu.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{isCreate ? "Add item" : "Save changes"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
