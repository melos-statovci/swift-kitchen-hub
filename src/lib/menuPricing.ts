export type VariantMode = "NONE" | "REQUIRED";

export function requiresExplicitFlatPrice(
  previousMode: VariantMode,
  nextMode: VariantMode,
): boolean {
  return previousMode === "REQUIRED" && nextMode === "NONE";
}

// Mirrors the publish rule: a size-required item with no orderable size is hidden from customers.
export function hiddenForNoOrderableVariant(item: {
  variantMode: VariantMode;
  variants: { available: boolean; archivedAt: string | null }[];
}): boolean {
  return (
    item.variantMode === "REQUIRED" &&
    !item.variants.some((variant) => variant.available && variant.archivedAt === null)
  );
}
