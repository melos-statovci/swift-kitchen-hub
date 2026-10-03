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
import { createMenuFormSchema } from "@/lib/menuFormSchema";
import { appConfig } from "@/lib/config";

// Managers enter currency units; the existing payload converts them to cents.
const schema = createMenuFormSchema(appConfig.currency);

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
  const [saveError, setSaveError] = useState<string | null>(null);

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
    setSaveError(null);
  }, [open, isCreate, item, categories, form]);

  const submit = async (values: Values) => {
    setSaveError(null);
    if (values.variantMode === "REQUIRED") {
      if (variants.length === 0 || !variants.some((variant) => variant.available)) {
        setSaveError("Add at least one available variant.");
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
        setSaveError("Every variant needs a name and a valid price.");
        toast.error("Every variant needs a name and a valid price.");
        return;
      }
    }

    if (values.variantMode === "NONE" && requiresFlatPrice) {
      setSaveError("Enter the new flat price before saving.");
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
      const message = err instanceof Error ? err.message : "Failed to save menu item";
      setSaveError(message);
      toast.error(message);
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
  const submitting = form.formState.isSubmitting;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-1rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-5 pr-10 sm:px-6 sm:pr-10">
          <DialogTitle>{isCreate ? "Add menu item" : "Edit menu item"}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Add a new dish to the menu. It goes live on the customer site immediately if available."
              : "Update this dish. Past orders keep the name and price they were placed with."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(submit)}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            aria-busy={submitting}
          >
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <fieldset disabled={submitting} className="min-w-0 space-y-4">
                <legend className="sr-only">Menu item details</legend>
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
                            form.setValue("price", undefined, {
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
                        Use variants when customers choose a size or option. Existing variants are
                        retained if you switch back to a flat price.
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
                          <FormLabel>Price ({appConfig.currency})</FormLabel>
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
                          Order controls customer display order. Archived variants keep order
                          history.
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
                            className="grid grid-cols-[minmax(0,1fr)_6rem] items-start gap-3 rounded-md border border-border bg-muted/20 p-3"
                          >
                            <div className="min-w-0 space-y-1.5">
                              <label
                                htmlFor={`variant-${variant.key}-name`}
                                className="text-xs font-medium"
                              >
                                Variant {index + 1} name
                              </label>
                              <Input
                                id={`variant-${variant.key}-name`}
                                className="min-w-0"
                                value={variant.name}
                                onChange={(event) =>
                                  updateVariantDraft(variant.key, { name: event.target.value })
                                }
                                placeholder="Variant name"
                              />
                            </div>
                            <div className="min-w-0 space-y-1.5">
                              <label
                                htmlFor={`variant-${variant.key}-price`}
                                className="text-xs font-medium"
                              >
                                Price ({appConfig.currency})
                              </label>
                              <Input
                                id={`variant-${variant.key}-price`}
                                className="min-w-0 tabular-nums"
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
                                aria-label={`Variant ${index + 1} price in ${appConfig.currency}`}
                              />
                            </div>
                            <div className="col-span-2 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Switch
                                  id={`variant-${variant.key}-available`}
                                  checked={variant.available}
                                  onCheckedChange={(available) =>
                                    updateVariantDraft(variant.key, { available })
                                  }
                                  aria-label={`Variant ${index + 1} available`}
                                />
                                <label
                                  htmlFor={`variant-${variant.key}-available`}
                                  className="text-xs text-muted-foreground"
                                >
                                  {variant.available ? "Available" : "Unavailable"}
                                </label>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-11 w-11 sm:h-9 sm:w-9"
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
                                  className="h-11 w-11 sm:h-9 sm:w-9"
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
                                  className="h-11 w-11 sm:h-9 sm:w-9"
                                  onClick={() => removeVariant(variant)}
                                  aria-label={`Remove variant ${index + 1}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
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
              </fieldset>
            </div>
            {saveError && (
              <p
                role="alert"
                className="shrink-0 border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:px-6"
              >
                {saveError}
              </p>
            )}
            <DialogFooter className="shrink-0 gap-2 border-t border-border bg-muted/20 p-4 sm:px-6">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                className="min-h-11 sm:min-h-9"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="min-h-11 sm:min-h-9">
                {submitting ? "Saving…" : isCreate ? "Add item" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
